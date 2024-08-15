import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { History } from '../lib/history';
import { setupServer } from 'msw/node';
import { HttpResponse, http } from 'msw';
import { mockHistoryNextResponse, mockHistoryResponse } from './mock/history.mock';
import { HTTPRequestError, ValidationError } from '../lib/errors';

const server = setupServer();
const mockNspRoomid = 'M3wLrtCTJe8Z:chat:one:test';
const mockUwsHttpHost = 'http://localhost:9090';
const mockHistoryEndpoint = `${mockUwsHttpHost}/rooms/${mockNspRoomid}/messages`;

vi.mock('../lib/logger', () => ({
  logger: {
    logInfo: vi.fn(),
    logError: vi.fn()
  }
}));

beforeAll(() => {
  server.listen();
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe('History', () => {
  let history: History;

  beforeEach(() => {
    history = new History(mockUwsHttpHost, mockNspRoomid);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('get()', () => {
    describe('success', () => {
      it('should return historical messages for a given room', async () => {
        server.use(
          http.get(mockHistoryEndpoint, () => {
            return HttpResponse.json({
              status: 200,
              data: mockHistoryResponse
            });
          })
        );

        const limit = 2;
        const messages = await history.get({ limit });

        expect(messages).toHaveLength(limit);
      });
    });

    describe('error', () => {
      it('should throw an error if the request fails', async () => {
        server.use(
          http.get(mockHistoryEndpoint, () => {
            return new HttpResponse(null, { status: 400 });
          })
        );

        await expect(history.get({ limit: 1000 })).rejects.toThrow(HTTPRequestError);
      });
    });
  });

  describe('next()', () => {
    describe('success', () => {
      it('should return the next page of historical messages for a given room', async () => {
        server.use(
          http.get(mockHistoryEndpoint, ({ request }) => {
            const searchParams = new URL(request.url).searchParams;

            if (searchParams.get('nextPageToken')) {
              return HttpResponse.json({
                status: 200,
                data: mockHistoryNextResponse
              });
            }

            return HttpResponse.json({
              status: 200,
              data: mockHistoryResponse
            });
          })
        );

        const limit = 2;
        const page1 = await history.get({ limit });
        const page2 = await history.next();

        expect(page1).toHaveLength(limit);
        expect(page2).toHaveLength(limit);
        expect(page1[0].timestamp).not.toEqual(page2[0].timestamp);
      });
    });

    describe('error', () => {
      it('should throw an error if history.next() is called before history.get()', async () => {
        await expect(history.next()).rejects.toThrow(ValidationError);
      });

      it('should throw an error if the request fails', async () => {
        server.use(
          http.get(mockHistoryEndpoint, () => {
            return new HttpResponse(null, { status: 400 });
          })
        );

        await expect(history.get({ limit: 1000 })).rejects.toThrow(HTTPRequestError);
      });
    });
  });
});
