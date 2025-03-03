import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { History } from '../lib/history';
import { getMockHistoryResponse } from './mock/history.mock';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { TokenError } from '../lib/errors';

const mockHttpServiceUrl = process.env.HTTP_SERVICE_URL || '';
const mockStateServiceUrl = process.env.STATE_SERVICE_URL || '';
const mockRoomId = 'config';
const mockUrl = `${mockHttpServiceUrl}/history/${mockRoomId}/messages`;

const server = setupServer();

vi.mock('../lib/logger', () => ({
  logger: {
    logInfo: vi.fn(),
    logError: vi.fn()
  }
}));

describe('History', () => {
  describe('http service request', () => {
    const defaultRequestOptions = {
      limit: 2
    };

    beforeAll(() => {
      server.use(
        http.get(mockUrl, ({ request }) => {
          const authHeader = request.headers.get('Authorization');
          const bearerToken = authHeader?.substring(7);

          if (!bearerToken || bearerToken === 'invalid token') {
            return new HttpResponse(null, { status: 401 });
          }

          return HttpResponse.json(getMockHistoryResponse(2));
        })
      );

      server.listen();
    });

    afterAll(() => {
      server.close();
      vi.restoreAllMocks();
    });

    describe('get()', () => {
      describe('success', () => {
        it('should retieve history for a given room', async () => {
          const history = new History(
            mockRoomId,
            mockHttpServiceUrl,
            mockStateServiceUrl,
            () => `${Date.now()}`
          );

          await expect(history.get(defaultRequestOptions)).resolves.toBeDefined();
        });
      });

      describe('error', () => {
        it('should throw TokenError if response is 4xx', async () => {
          const history = new History(
            mockRoomId,
            mockHttpServiceUrl,
            mockStateServiceUrl,
            () => 'invalid token'
          );

          await expect(history.get(defaultRequestOptions)).rejects.toThrow(Error);
        });

        it('should throw TokenError if no auth token is provided', async () => {
          const history = new History(
            mockRoomId,
            mockHttpServiceUrl,
            mockStateServiceUrl,
            () => null
          );

          await expect(history.get(defaultRequestOptions)).rejects.toThrow(TokenError);
        });
      });
    });

    describe('next()', () => {
      describe('success', () => {
        it('should call next iterator following initial get request', async () => {
          const history = new History(
            mockRoomId,
            mockHttpServiceUrl,
            mockStateServiceUrl,
            () => `${Date.now()}`
          );

          const { next } = await history.get(defaultRequestOptions);
          expect(next).toBeInstanceOf(Function);
          await expect(history.next()).resolves.toBeDefined();
        });
      });

      describe('error', () => {
        it('should throw an error if next() is called before get()', async () => {
          const history = new History(
            mockRoomId,
            mockHttpServiceUrl,
            mockStateServiceUrl,
            () => 'valid token'
          );
          await expect(history.next()).rejects.toThrow('Next messages unavailable');
        });
      });
    });
  });
});
