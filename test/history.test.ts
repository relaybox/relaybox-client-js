import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { History } from '../lib/history';
import { setupServer } from 'msw/node';
import { HttpResponse, http } from 'msw';
import { mockHistoryNextResponse, mockHistoryResponse } from './mock/history.mock';
import { ValidationError } from '../lib/errors';
import { SocketManager } from '../lib/socket-manager';
import { ClientEvent } from '../lib/types/event.types';

const server = setupServer();
const mockUwsHttpHost = 'http://localhost:9090';
const mockNspRoomid = 'ewRnbOj5f2yR:chat:one:test';
const mockHistoryEndpoint = `${mockUwsHttpHost}/rooms/${mockNspRoomid}/messages`;

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
  let history: History;
  let socketManager: SocketManager;

  beforeEach(() => {
    socketManager = new SocketManager();
    history = new History(socketManager, mockUwsHttpHost, mockNspRoomid);
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

  describe('options: https', () => {
    const defaultHistoryOptions = {
      limit: 2,
      https: true
    };

    beforeAll(() => {
      server.listen();
    });

    afterEach(() => {
      server.resetHandlers();
    });

    afterAll(() => {
      server.close();
    });

    describe('get()', () => {
      describe('success', () => {
        it('should return message history for a given room', async () => {
          server.use(
            http.get(mockHistoryEndpoint, () => {
              return HttpResponse.json({
                status: 200,
                data: mockHistoryResponse
              });
            })
          );

          const historyResponse = await history.get(defaultHistoryOptions);

          expect(historyResponse.items).toHaveLength(defaultHistoryOptions.limit);
        });
      });

      describe('error', () => {
        it('should throw an error if the request fails', async () => {
          server.use(
            http.get(mockHistoryEndpoint, () => {
              return new HttpResponse(null, { status: 400 });
            })
          );

          await expect(history.get({ limit: 1000, https: true })).rejects.toThrow(
            `Error getting message history for "${mockNspRoomid}"`
          );
        });
      });
    });

    describe('next()', () => {
      describe('success', () => {
        beforeEach(() => {
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
        });

        it('should return the next page of message history for a given room', async () => {
          const historyResponse = await history.get(defaultHistoryOptions);
          const nextHistoryResponse = await historyResponse.next!();

          expect(historyResponse.items).toHaveLength(defaultHistoryOptions.limit);
          expect(nextHistoryResponse.items).toHaveLength(defaultHistoryOptions.limit);
          expect(historyResponse.items[0].timestamp).not.toEqual(
            nextHistoryResponse.items[0].timestamp
          );
        });

        it('should iterate through message history for a given room', async () => {
          let historyResponse = await history.get(defaultHistoryOptions);
          expect(historyResponse.items).toHaveLength(defaultHistoryOptions.limit);

          while (historyResponse?.next) {
            historyResponse = await historyResponse.next();
            expect(historyResponse.items).toHaveLength(defaultHistoryOptions.limit);
          }

          expect(historyResponse.next).toBeUndefined();
        });

        it('should iterate through message history for a given room retruning (n) items', async () => {
          server.use(
            http.get(mockHistoryEndpoint, ({ request }) => {
              const searchParams = new URL(request.url).searchParams;

              const itemsRemaining = Number(searchParams.get('items')) - options.limit;

              const responseData = {
                itemsRemaining,
                ...mockHistoryNextResponse,
                ...(itemsRemaining > 0 && { nextPageToken: '123' })
              };

              return HttpResponse.json({
                status: 200,
                data: responseData
              });
            })
          );

          const options = {
            limit: mockHistoryResponse.messages.length,
            https: true,
            items: 10
          };

          let historyResponse = await history.get(options);
          expect(historyResponse.items).toHaveLength(options.limit);
          expect(historyResponse.next).toBeDefined();

          while (historyResponse?.next) {
            historyResponse = await historyResponse.next();
            expect(historyResponse.items).toHaveLength(options.limit);
          }

          expect(historyResponse.next).toBeUndefined();
        });

        it.skip('should iterate through message history for a given room retruning (n) items', async () => {
          const options = {
            limit: 5,
            https: true,
            items: 15
          };

          let historyResponse = await history.get(options);
          console.log(historyResponse.items);
          expect(historyResponse.next).toBeDefined();

          while (historyResponse?.next) {
            historyResponse = await historyResponse.next();
            console.log(historyResponse.items);
          }

          expect(historyResponse.next).toBeUndefined();
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

          await expect(history.get({ limit: 1000, https: true })).rejects.toThrow(
            `Error getting message history for "${mockNspRoomid}"`
          );
        });
      });
    });
  });
});
