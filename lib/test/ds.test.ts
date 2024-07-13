import { describe, it, expect, afterEach, vi, beforeEach, MockInstance } from 'vitest';
import { Ds } from '../ds';
import { HTTPRequestError, SocketConnectionError, ValidationError } from '../errors';
import { SocketEvent } from '../types/socket.types';
import { ServerEvent } from '../types/event.types';
import { eventEmitter } from '../mock/event-emitter.mock';
import * as authModule from '../authentication';

const mockApiKey = 'appId.keyId:secret';
const mockClientId = 'G2-xcysmPiVz';
const mockConnectionId = '_pSOuC2GvW4O';
const mockAuthEndpoint = 'https://api.example.com/ds/auth';
const mockAuthToken = 'eyJhb.eyJrZXlOYW1lIjoiRz.5hg9z5Gd4YI9jSw1Y66gz6q';

let socket: any;
let getSocketMockInstance: MockInstance;
let connectSocketMockInstance: MockInstance;

async function getSocketConnect() {
  eventEmitter.emit(SocketEvent.CONNECT);
  socket.emit(ServerEvent.CONNECTION_ACKNOWLEDGED, {
    clientId: mockClientId,
    connectionId: mockConnectionId
  });
}

vi.mock('../logger', () => ({
  logger: {
    logInfo: vi.fn(),
    logError: vi.fn()
  }
}));

vi.mock('../socket-manager', () => ({
  SocketManager: vi.fn(() => ({
    eventEmitter,
    getSocket: getSocketMockInstance,
    connectSocket: connectSocketMockInstance,
    apiKeyInitSocket: vi.fn(),
    authTokenInitSocket: vi.fn(),
    initializeSocket: vi.fn(),
    disconnectSocket: vi.fn(),
    updateSocketConnectionId: vi.fn((connectionId: string) => {
      socket.auth.connectionId = connectionId;
    })
  }))
}));

describe('Ds', () => {
  let ds: Ds;

  beforeEach(() => {
    socket = { ...eventEmitter, auth: {} as any };
    getSocketMockInstance = vi.fn().mockReturnValueOnce(null).mockReturnValueOnce(socket);
    connectSocketMockInstance = vi.fn(getSocketConnect);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    eventEmitter.clearAll();
  });

  describe('when connecting using either api key or auth token', () => {
    it('should throw ValidationError if neither "apiKey" nor "authEndpoint" is provided', () => {
      expect(() => new Ds({})).toThrow(ValidationError);
    });

    it('should throw SocketConnectionError if socket connection times out', async () => {
      vi.useFakeTimers();

      connectSocketMockInstance = vi.fn(() => {
        setTimeout(() => getSocketConnect(), 35000);
        vi.advanceTimersByTime(35000);
      });

      ds = new Ds({ apiKey: mockApiKey });

      const connectPromise = ds.connect();

      await expect(connectPromise).rejects.toThrow(SocketConnectionError);
      await expect(connectPromise).rejects.toThrowError(/Connection timeout after/);
    });
  });

  describe('when connecting using a static api key', () => {
    it('should successfully connect', async () => {
      ds = new Ds({ apiKey: mockApiKey });

      await ds.connect();

      expect(ds.clientId).toEqual(mockClientId);
      expect(ds.connectionId).toEqual(mockConnectionId);
    });

    it('should throw SocketConnectionError if socket emits error event', async () => {
      connectSocketMockInstance = vi.fn(() => {
        socket.emit(SocketEvent.ERROR);
      });

      ds = new Ds({ apiKey: mockApiKey });

      await expect(ds.connect()).rejects.toThrow(SocketConnectionError);
    });
  });

  describe('when connecting using a client generated auth token', () => {
    it('should successfully connect', async () => {
      vi.spyOn(authModule, 'getAuthTokenResponse').mockResolvedValueOnce({
        token: mockAuthToken,
        expiresIn: 30
      });

      ds = new Ds({ authEndpoint: mockAuthEndpoint });

      await ds.connect();

      expect(ds.clientId).toEqual(mockClientId);
      expect(ds.connectionId).toEqual(mockConnectionId);
    });

    it('should throw SocketConnectionError if socket emits error event', async () => {
      vi.spyOn(authModule, 'getAuthTokenResponse').mockResolvedValueOnce({
        token: mockAuthToken,
        expiresIn: 30
      });

      connectSocketMockInstance = vi.fn(() => {
        socket.emit(SocketEvent.ERROR);
      });

      ds = new Ds({ authEndpoint: mockAuthEndpoint });

      await expect(ds.connect()).rejects.toThrow(SocketConnectionError);
    });

    it('should throw an error if token request fails', async () => {
      vi.spyOn(authModule, 'getAuthTokenResponse').mockRejectedValueOnce(
        new HTTPRequestError(`fetch failed`)
      );

      ds = new Ds({ authEndpoint: mockAuthEndpoint });

      await expect(ds.connect()).rejects.toThrow(HTTPRequestError);
    });
  });
});
