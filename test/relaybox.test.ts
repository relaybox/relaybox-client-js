import { describe, it, expect, afterEach, vi, beforeEach, MockInstance } from 'vitest';
import { Relaybox } from '../lib/relaybox';
import { HTTPRequestError, SocketConnectionError, ValidationError } from '../lib/errors';
import { SocketEvent } from '../lib/types/socket.types';
import { ServerEvent } from '../lib/types/event.types';
import { eventEmitter } from './mock/event-emitter.mock';
import * as authModule from '../lib/authentication';

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

vi.mock('../lib/logger', () => ({
  logger: {
    logInfo: vi.fn(),
    logError: vi.fn()
  }
}));

vi.mock('../lib/socket-manager', () => ({
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

describe('Relaybox', () => {
  let relaybox: Relaybox;

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
      expect(() => new Relaybox({})).toThrow(ValidationError);
    });

    it('should throw SocketConnectionError if socket connection times out', async () => {
      vi.useFakeTimers();

      connectSocketMockInstance = vi.fn(() => {
        setTimeout(() => getSocketConnect(), 35000);
        vi.advanceTimersByTime(35000);
      });

      relaybox = new Relaybox({ apiKey: mockApiKey });

      const connectPromise = relaybox.connect();

      await expect(connectPromise).rejects.toThrow(SocketConnectionError);
      await expect(connectPromise).rejects.toThrowError(/Connection timeout after/);
    });
  });

  describe('when connecting using a static api key', () => {
    it('should successfully connect', async () => {
      relaybox = new Relaybox({ apiKey: mockApiKey });

      await relaybox.connect();

      expect(relaybox.clientId).toEqual(mockClientId);
      expect(relaybox.connectionId).toEqual(mockConnectionId);
    });

    it('should throw SocketConnectionError if socket emits error event', async () => {
      connectSocketMockInstance = vi.fn(() => {
        socket.emit(SocketEvent.ERROR);
      });

      relaybox = new Relaybox({ apiKey: mockApiKey });

      await expect(relaybox.connect()).rejects.toThrow(SocketConnectionError);
    });
  });

  describe('when connecting using a client generated auth token', () => {
    it('should successfully connect', async () => {
      vi.spyOn(authModule, 'getAuthTokenResponse').mockResolvedValueOnce({
        token: mockAuthToken,
        expiresIn: 30
      });

      relaybox = new Relaybox({ authEndpoint: mockAuthEndpoint });

      await relaybox.connect();

      expect(relaybox.clientId).toEqual(mockClientId);
      expect(relaybox.connectionId).toEqual(mockConnectionId);
    });

    it('should throw SocketConnectionError if socket emits error event', async () => {
      vi.spyOn(authModule, 'getAuthTokenResponse').mockResolvedValueOnce({
        token: mockAuthToken,
        expiresIn: 30
      });

      connectSocketMockInstance = vi.fn(() => {
        socket.emit(SocketEvent.ERROR);
      });

      relaybox = new Relaybox({ authEndpoint: mockAuthEndpoint });

      await expect(relaybox.connect()).rejects.toThrow(SocketConnectionError);
    });

    it('should throw an error if token request fails', async () => {
      vi.spyOn(authModule, 'getAuthTokenResponse').mockRejectedValueOnce(
        new HTTPRequestError(`fetch failed`)
      );

      relaybox = new Relaybox({ authEndpoint: mockAuthEndpoint });

      await expect(relaybox.connect()).rejects.toThrow(HTTPRequestError);
    });
  });
});
