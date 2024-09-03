import { vi, describe, it, expect, afterAll, beforeEach } from 'vitest';
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

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('subscribe', () => {
    describe('success', () => {
      it('should successfully subscribe to specific user events', async () => {
        const handler = vi.fn();

        user.subscribe('online', handler);

        expect(socketManagerEmitWithAck).toHaveBeenCalledWith(ClientEvent.AUTH_USER_SUBSCRIBE, {
          subscriptionId: user.clientId,
          event: 'online'
        });
      });

      it('should successfully subscribe to all user events', async () => {
        const handler = vi.fn();

        user.subscribe(handler);

        expect(socketManagerEmitWithAck).toHaveBeenCalledWith(ClientEvent.AUTH_USER_SUBSCRIBE, {
          subscriptionId: user.clientId,
          event: 'all'
        });
      });
    });
  });
});
