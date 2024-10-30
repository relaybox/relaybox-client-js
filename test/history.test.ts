import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { History } from '../lib/history';
import { getMockHistoryResponse } from './mock/history.mock';
import { SocketManager } from '../lib/socket-manager';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { TokenError } from '../lib/errors';

const mockHttpServiceUrl = process.env.HTTP_SERVICE_URL || '';
const mockNspRoomid = 'ewRnbOj5f2yR:config';
const mockRoomId = 'config';

const server = setupServer();

vi.mock('../lib/logger', () => ({
  logger: {
    logInfo: vi.fn(),
    logError: vi.fn()
  }
}));

const socketManagerEmitWithAck = vi.fn();

vi.mock('../lib/socket-manager', () => ({
  SocketManager: vi.fn(() => ({
    emitWithAck: socketManagerEmitWithAck
  }))
}));

describe('History', () => {
  let socketManager: SocketManager;

  describe('http service request', () => {
    const defaultRequestOptions = {
      limit: 2
    };

    beforeAll(() => {
      server.use(
        http.get<any, any, any>(
          `${mockHttpServiceUrl}/history/${mockRoomId}/messages`,
          async ({ request }) => {
            const authHeader = request.headers.get('Authorization');
            const bearerToken = authHeader?.substring(7);

            if (!bearerToken || parseInt(bearerToken) === 1) {
              return new HttpResponse(null, { status: 401 });
            }

            return HttpResponse.json(getMockHistoryResponse(2));
          }
        )
      );

      server.listen();
    });

    afterAll(() => {
      server.close();
      vi.restoreAllMocks();
    });

    beforeEach(() => {
      socketManager = {} as SocketManager;
    });

    describe('get()', () => {
      describe('success', () => {
        it('should retieve history for a given room', async () => {
          const history = new History(
            socketManager,
            mockNspRoomid,
            mockRoomId,
            mockHttpServiceUrl,
            () => `${Date.now()}`
          );

          await expect(history.get(defaultRequestOptions)).resolves.toBeDefined();
        });
      });

      describe('error', () => {
        it('should throw TokenError if response is 4xx', async () => {
          const history = new History(
            socketManager,
            mockNspRoomid,
            mockRoomId,
            mockHttpServiceUrl,
            () => '1'
          );

          await expect(history.get(defaultRequestOptions)).rejects.toThrow(Error);
        });

        it('should throw TokenError if no auth token is provided', async () => {
          const history = new History(
            socketManager,
            mockNspRoomid,
            mockRoomId,
            mockHttpServiceUrl,
            () => null
          );

          await expect(history.get(defaultRequestOptions)).rejects.toThrow(TokenError);
        });
      });
    });
  });
});
