import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { History } from '../lib/history';
import {
  getMockHistoryResponse,
  mockHistoryNextResponse,
  mockHistoryResponse
} from './mock/history.mock';
import { SocketManager } from '../lib/socket-manager';
import { ClientEvent } from '../lib/types/event.types';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const mockCoreServiceUrl = process.env.CORE_SERVICE_URL || '';
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

function getMockApiErrorResponse() {
  return HttpResponse.json(
    { name: 'Error', message: 'failed', data: { schema: false } },
    { status: 400 }
  );
}

describe('History', () => {
  let history: History;
  let socketManager: SocketManager;

  beforeEach(() => {
    socketManager = new SocketManager(mockCoreServiceUrl);
    history = new History(socketManager, mockNspRoomid, mockRoomId);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('options: default (websocket)', () => {
    const defaultHistoryOptions = {
      limit: 2
    };

    describe('get()', () => {
      describe('success', () => {
        it('should return message history for a given room', async () => {
          socketManagerEmitWithAck.mockResolvedValueOnce(mockHistoryResponse);

          const historyResponse = await history.get(defaultHistoryOptions);

          expect(socketManagerEmitWithAck).toHaveBeenCalledWith(ClientEvent.ROOM_HISTORY_GET, {
            ...defaultHistoryOptions,
            nspRoomId: mockNspRoomid
          });

          expect(historyResponse.items).toHaveLength(defaultHistoryOptions.limit);
          expect(historyResponse.items[0]).toHaveProperty('timestamp');
        });
      });

      describe('error', () => {
        it('should throw an error if the request fails', async () => {
          socketManagerEmitWithAck.mockRejectedValueOnce(new Error());

          await expect(history.get()).rejects.toThrow(
            `Error getting message history for "${mockNspRoomid}"`
          );
        });
      });
    });

    describe('next()', () => {
      describe('success', () => {
        it('should return message history an next page iterator for a given room', async () => {
          socketManagerEmitWithAck.mockResolvedValueOnce(mockHistoryResponse);
          socketManagerEmitWithAck.mockResolvedValueOnce(mockHistoryNextResponse);

          const historyResponse = await history.get(defaultHistoryOptions);
          const nextHistoryResponse = await historyResponse.next!();

          expect(socketManagerEmitWithAck).toHaveBeenCalledWith(ClientEvent.ROOM_HISTORY_GET, {
            ...defaultHistoryOptions,
            nspRoomId: mockNspRoomid
          });

          expect(socketManagerEmitWithAck).toHaveBeenCalledWith(ClientEvent.ROOM_HISTORY_GET, {
            ...defaultHistoryOptions,
            nspRoomId: mockNspRoomid,
            nextPageToken: mockHistoryResponse.nextPageToken
          });

          expect(historyResponse.items).toHaveLength(defaultHistoryOptions.limit);
          expect(nextHistoryResponse.items).toHaveLength(defaultHistoryOptions.limit);
          expect(historyResponse.items[0].timestamp).not.toEqual(
            nextHistoryResponse.items[0].timestamp
          );

          expect(socketManagerEmitWithAck).toHaveBeenCalledTimes(2);
        });

        it('should iterate through message history for a given room', async () => {
          socketManagerEmitWithAck.mockResolvedValueOnce(mockHistoryResponse);
          socketManagerEmitWithAck.mockResolvedValueOnce(mockHistoryNextResponse);

          let historyResponse = await history.get(defaultHistoryOptions);
          expect(historyResponse.items).toHaveLength(defaultHistoryOptions.limit);

          while (historyResponse?.next) {
            historyResponse = await historyResponse.next();
            expect(historyResponse.items).toHaveLength(defaultHistoryOptions.limit);
          }

          expect(historyResponse.next).toBeUndefined();
          expect(socketManagerEmitWithAck).toHaveBeenCalledWith(ClientEvent.ROOM_HISTORY_GET, {
            ...defaultHistoryOptions,
            nspRoomId: mockNspRoomid
          });
          expect(socketManagerEmitWithAck).toHaveBeenCalledWith(ClientEvent.ROOM_HISTORY_GET, {
            ...defaultHistoryOptions,
            nspRoomId: mockNspRoomid,
            nextPageToken: mockHistoryResponse.nextPageToken
          });
        });
      });

      describe('error', () => {
        it('should throw an error if the request fails', async () => {
          socketManagerEmitWithAck.mockResolvedValueOnce(mockHistoryResponse);
          socketManagerEmitWithAck.mockRejectedValueOnce(new Error());

          await history.get(defaultHistoryOptions);
          await expect(history.next()).rejects.toThrow(
            `Error getting message history for "${mockNspRoomid}"`
          );
        });

        it('should throw an error if history.next() is called before history.get()', async () => {
          await expect(history.next()).rejects.toThrow(
            `history.next() called before history.get()`
          );
        });
      });
    });
  });

  describe.only('v2, http', () => {
    const defaultHistoryOptions = {
      limit: 2
    };

    beforeAll(() => {
      server.use(
        http.get<never, any, any>(
          `${mockHttpServiceUrl}/history/${mockRoomId}/messages`,
          async ({ request }) => {
            console.log('here');
            return HttpResponse.json(getMockHistoryResponse());
            return getMockApiErrorResponse();
          }
        )
      );
    });

    beforeEach(() => {
      socketManager = {} as SocketManager;
      history = new History(socketManager, mockNspRoomid, mockRoomId, mockHttpServiceUrl);
    });

    describe('get()', () => {
      it('should sucessfullt fetch history for a given room', async () => {
        const response = await history.get(defaultHistoryOptions);
        console.log(response);
      });
    });
  });
});
