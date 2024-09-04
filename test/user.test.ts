import { vi, describe, it, expect, afterAll, beforeEach, afterEach } from 'vitest';
import { SocketManager } from '../lib/socket-manager';
import { User } from '../lib/user';
import { getMockAuthUserPublic } from './mock/user.mock';
import { ClientEvent } from '../lib/types';

const mockAuthUserPublic = getMockAuthUserPublic();

const socketManagerOn = vi.fn();
const socketManagerOff = vi.fn();
const socketManagerEmitWithAck = vi.fn();

vi.mock('../lib/socket-manager', () => ({
  SocketManager: vi.fn(() => ({
    emitWithAck: socketManagerEmitWithAck,
    on: socketManagerOn,
    off: socketManagerOff,
    emit: vi.fn()
  }))
}));

vi.mock('../lib/logger', () => ({
  logger: {
    logInfo: vi.fn(),
    logError: vi.fn()
  }
}));

describe('User', () => {
  let user: User;
  let socketManager: SocketManager;

  beforeEach(() => {
    socketManager = new SocketManager();
    user = new User(socketManager, mockAuthUserPublic);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('subscribe', () => {
    describe('success', () => {
      it('should successfully subscribe to specific user events', async () => {
        const handler = vi.fn();

        user.subscribe('user:connection:status', handler);

        expect(socketManagerEmitWithAck).toHaveBeenCalledWith(ClientEvent.AUTH_USER_SUBSCRIBE, {
          subscriptionId: user.clientId,
          event: 'user:connection:status'
        });
      });

      it('should successfully subscribe to all user events', async () => {
        const handler = vi.fn();

        user.subscribe(handler);

        expect(socketManagerEmitWithAck).toHaveBeenCalledWith(ClientEvent.AUTH_USER_SUBSCRIBE, {
          subscriptionId: user.clientId,
          event: '$:subscribe:all'
        });
      });

      it('should successfully subscribe to and unsubscribe from all user events', async () => {
        const handler = vi.fn();

        user.subscribe(handler);
        user.unsubscribe();

        expect(socketManagerEmitWithAck).toHaveBeenCalledWith(ClientEvent.AUTH_USER_SUBSCRIBE, {
          subscriptionId: user.clientId,
          event: '$:subscribe:all'
        });

        expect(socketManagerEmitWithAck).toHaveBeenCalledWith(
          ClientEvent.AUTH_USER_UNSUBSCRIBE_ALL,
          {
            subscriptionId: user.clientId
          }
        );
      });
    });
  });

  describe('onConnectionEvent', () => {
    describe('success', () => {
      it('should successfully subscribe to specific user events', async () => {
        const handler = vi.fn();

        user.onConnectionEvent(handler);

        expect(socketManagerEmitWithAck).toHaveBeenCalledWith(ClientEvent.AUTH_USER_SUBSCRIBE, {
          subscriptionId: user.clientId,
          event: 'user:connection:status'
        });
      });
    });
  });

  describe('onConnect', () => {
    describe('success', () => {
      it('should successfully subscribe to specific user events', async () => {
        const handler = vi.fn();

        user.onConnect(handler);

        expect(socketManagerEmitWithAck).toHaveBeenCalledWith(ClientEvent.AUTH_USER_SUBSCRIBE, {
          subscriptionId: user.clientId,
          event: 'user:connect'
        });
      });
    });
  });

  describe('onDisconnect', () => {
    describe('success', () => {
      it('should successfully subscribe to specific user events', async () => {
        const handler = vi.fn();

        user.onDisconnect(handler);

        expect(socketManagerEmitWithAck).toHaveBeenCalledWith(ClientEvent.AUTH_USER_SUBSCRIBE, {
          subscriptionId: user.clientId,
          event: 'user:disconnect'
        });
      });
    });
  });
});
