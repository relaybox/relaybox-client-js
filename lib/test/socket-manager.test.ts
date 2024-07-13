import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import MockWebSocket from '../mock/mock-websocket';
import { SocketManager } from '../socket-manager';
import { SocketEvent } from '../types/socket.types';
import { ClientEvent, ServerEvent } from '../types/event.types';

const mockAuthToken = 'eyJhb.eyJrZXlOYW1lIjoiRz.5hg9z5Gd4YI9jSw1Y66gz6q';
const mockTokenResponse = {
  token: mockAuthToken,
  expiresIn: 30
};

describe('SocketManager tests', () => {
  let socketManager: SocketManager;

  beforeEach(() => {
    socketManager = new SocketManager();
    global.WebSocket = MockWebSocket as any;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should connect websocket and trigger open event', async () => {
    socketManager.authTokenInitSocket(mockTokenResponse);
    socketManager.connectSocket();

    const connectPromise = new Promise<void>((resolve) => {
      socketManager.on(SocketEvent.CONNECT, () => {
        expect(socketManager.getSocket().connected).toBe(true);
        resolve();
      });
    });

    vi.runAllTimers();

    await connectPromise;
  });

  it('should emit a message and receive acknowledgement', async () => {
    socketManager.authTokenInitSocket(mockTokenResponse);
    socketManager.connectSocket();

    const testMessage = {
      body: 'test body'
    };

    const defaultAckId = '123';

    const emitPromise = new Promise<void>((resolve) => {
      socketManager.on(SocketEvent.CONNECT, async () => {
        socketManager
          .emitWithAck(ClientEvent.PUBLISH, testMessage, defaultAckId)
          .then((response) => {
            expect(response).toEqual(testMessage);
            resolve();
          });

        setTimeout(() => {
          const ackMessage = {
            type: ServerEvent.MESSAGE_ACKNOWLEDGED,
            body: {
              ackId: '123',
              data: testMessage,
              err: null
            }
          };

          const event = 'message' as unknown as Event;
          const data = JSON.stringify(ackMessage);

          // @ts-ignore
          socketManager.getConnection()?.dispatchEvent(event, data);
        }, 20);
      });
    });

    vi.runAllTimers();

    await emitPromise;
  });

  it('should handle websocket reconnection', async () => {
    socketManager.authTokenInitSocket(mockTokenResponse);
    socketManager.connectSocket();

    const disconnectPromise = new Promise<void>((resolve) => {
      socketManager.eventEmitter.on(SocketEvent.DISCONNECT, () => {
        expect(socketManager.getSocket().connected).toBe(false);
        resolve();
      });
    });

    const reconnectingPromise = new Promise<void>((resolve) => {
      socketManager.eventEmitter.on(SocketEvent.RECONNECTING, (attempts) => {
        if (attempts === 1) {
          expect(attempts).toBe(1);
          resolve();
        }
      });
    });

    const event = 'close' as unknown as CloseEvent;

    setTimeout(() => {
      socketManager.getConnection()?.dispatchEvent(event);
    }, 20);

    vi.runAllTimers();

    await disconnectPromise;
    await reconnectingPromise;
  });
});
