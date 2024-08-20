import { describe, it, expect, afterEach, vi, beforeEach, MockInstance } from 'vitest';
import { RelayBox } from '../lib/relaybox';
import {
  HTTPRequestError,
  SocketConnectionError,
  TokenError,
  ValidationError
} from '../lib/errors';
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

describe('RelayBox', () => {
  let relayBox: RelayBox;

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
      expect(() => new RelayBox({})).toThrow(ValidationError);
    });

    it('should throw SocketConnectionError if socket connection times out', async () => {
      vi.useFakeTimers();

      connectSocketMockInstance = vi.fn(() => {
        setTimeout(() => getSocketConnect(), 35000);
        vi.advanceTimersByTime(35000);
      });

      relayBox = new RelayBox({ apiKey: mockApiKey });

      const connectPromise = relayBox.connect();

      await expect(connectPromise).rejects.toThrow(SocketConnectionError);
      await expect(connectPromise).rejects.toThrowError(/Connection timeout after/);
    });
  });

  describe('when connecting using a static api key', () => {
    it('should successfully connect', async () => {
      relayBox = new RelayBox({ apiKey: mockApiKey });

      await relayBox.connect();

      expect(relayBox.clientId).toEqual(mockClientId);
      expect(relayBox.connectionId).toEqual(mockConnectionId);
    });

    it('should throw SocketConnectionError if socket emits error event', async () => {
      connectSocketMockInstance = vi.fn(() => {
        socket.emit(SocketEvent.ERROR);
      });

      relayBox = new RelayBox({ apiKey: mockApiKey });

      await expect(relayBox.connect()).rejects.toThrow(SocketConnectionError);
    });
  });

  describe('when connecting using a client generated auth token', () => {
    it('should successfully connect', async () => {
      vi.spyOn(authModule, 'getAuthTokenResponse').mockResolvedValueOnce({
        token: mockAuthToken,
        expiresIn: 30
      });

      relayBox = new RelayBox({ authEndpoint: mockAuthEndpoint });

      await relayBox.connect();

      expect(relayBox.clientId).toEqual(mockClientId);
      expect(relayBox.connectionId).toEqual(mockConnectionId);
    });

    it('should throw SocketConnectionError if socket emits error event', async () => {
      vi.spyOn(authModule, 'getAuthTokenResponse').mockResolvedValueOnce({
        token: mockAuthToken,
        expiresIn: 30
      });

      connectSocketMockInstance = vi.fn(() => {
        socket.emit(SocketEvent.ERROR);
      });

      relayBox = new RelayBox({ authEndpoint: mockAuthEndpoint });

      await expect(relayBox.connect()).rejects.toThrow(SocketConnectionError);
    });

    it('should throw an error if token request fails', async () => {
      vi.spyOn(authModule, 'getAuthTokenResponse').mockRejectedValueOnce(
        new HTTPRequestError(`fetch failed`)
      );

      relayBox = new RelayBox({ authEndpoint: mockAuthEndpoint });

      await expect(relayBox.connect()).rejects.toThrow(HTTPRequestError);
    });

    it('should throw an error if token is undefined', async () => {
      vi.spyOn(authModule, 'getAuthTokenResponse').mockResolvedValueOnce(undefined);

      relayBox = new RelayBox({ authEndpoint: mockAuthEndpoint });

      await expect(relayBox.connect()).rejects.toThrow(TokenError);
    });
  });

  describe.only('when connecting using a server side auth function', () => {
    it('should successfully connect', async () => {
      const authAction = vi.fn().mockResolvedValueOnce({
        token: mockAuthToken,
        expiresIn: 30
      });

      relayBox = new RelayBox({ authAction });

      await relayBox.connect();

      expect(relayBox.clientId).toEqual(mockClientId);
      expect(relayBox.connectionId).toEqual(mockConnectionId);
    });

    it('should successfully connect, calling the auth function with params', async () => {
      const authAction = vi.fn().mockResolvedValueOnce({
        token: mockAuthToken,
        expiresIn: 30
      });

      relayBox = new RelayBox({ authAction, authParams: { foo: 'bar' } });

      await relayBox.connect();

      expect(relayBox.clientId).toEqual(mockClientId);
      expect(relayBox.connectionId).toEqual(mockConnectionId);
      expect(authAction).toHaveBeenCalledWith({ foo: 'bar' });
    });

    it('should throw an error if token is undefined', async () => {
      const authAction = vi.fn().mockResolvedValueOnce(undefined);

      relayBox = new RelayBox({ authAction });

      await expect(relayBox.connect()).rejects.toThrow(TokenError);
    });
  });
});
