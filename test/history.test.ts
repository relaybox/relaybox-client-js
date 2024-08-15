import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { History } from '../lib/history';
import { setupServer } from 'msw/node';
import { HttpResponse, http } from 'msw';
import { mockHistoryNextResponse, mockHistoryResponse } from './mock/history.mock';
import { ValidationError } from '../lib/errors';
import { SocketManager } from '../lib/socket-manager';
import { ClientEvent } from '../lib/types/event.types';

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
        it('should return historical messages for a given room', async () => {
          socketManagerEmitWithAck.mockResolvedValueOnce(mockHistoryResponse);

          const messages = await history.get(defaultHistoryOptions);

          expect(socketManagerEmitWithAck).toHaveBeenCalledWith(ClientEvent.ROOM_HISTORY_GET, {
            ...defaultHistoryOptions,
            nspRoomId: mockNspRoomid
          });

          expect(messages).toHaveLength(defaultHistoryOptions.limit);
          expect(messages[0]).toHaveProperty('timestamp');
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
        it('should return historical messages for a given room', async () => {
          socketManagerEmitWithAck.mockResolvedValueOnce(mockHistoryResponse);
          socketManagerEmitWithAck.mockResolvedValueOnce(mockHistoryNextResponse);

          const page1 = await history.get(defaultHistoryOptions);
          const page2 = await history.next();

          expect(socketManagerEmitWithAck).toHaveBeenCalledWith(ClientEvent.ROOM_HISTORY_GET, {
            ...defaultHistoryOptions,
            nspRoomId: mockNspRoomid
          });

          expect(socketManagerEmitWithAck).toHaveBeenCalledWith(ClientEvent.ROOM_HISTORY_GET, {
            ...defaultHistoryOptions,
            nspRoomId: mockNspRoomid,
            nextPageToken: mockHistoryResponse.nextPageToken
          });

          expect(page1).toHaveLength(defaultHistoryOptions.limit);
          expect(page2).toHaveLength(defaultHistoryOptions.limit);

          expect(socketManagerEmitWithAck).toHaveBeenCalledTimes(2);
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
        it('should return historical messages for a given room', async () => {
          server.use(
            http.get(mockHistoryEndpoint, () => {
              return HttpResponse.json({
                status: 200,
                data: mockHistoryResponse
              });
            })
          );

          const messages = await history.get(defaultHistoryOptions);

          expect(messages).toHaveLength(defaultHistoryOptions.limit);
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

          const page1 = await history.get(defaultHistoryOptions);
          const page2 = await history.next();

          expect(page1).toHaveLength(defaultHistoryOptions.limit);
          expect(page2).toHaveLength(defaultHistoryOptions.limit);
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

          await expect(history.get({ limit: 1000, https: true })).rejects.toThrow(
            `Error getting message history for "${mockNspRoomid}"`
          );
        });
      });
    });
  });
});
