import { logger } from './logger';
import {
  HistoryClientResponse,
  HistoryGetOptions,
  HistoryOrder,
  HistoryResponse
} from './types/history.types';
import { ValidationError } from './errors';
import { SocketManager } from './socket-manager';
import { ClientEvent } from './types/event.types';

const HISTORY_MAX_REQUEST_LIMIT = 100;

/**
 * The History class handles fetching message history for a specific room.
 */
export class History {
  private readonly nspRoomId: string;
  private readonly socketManager: SocketManager;
  private start?: number;
  private end?: number;
  private seconds?: number;
  private limit?: number;
  private order?: HistoryOrder;
  private https?: boolean;
  private nextPageToken: string | null = null;
  private itemsRemaining?: number;
  private iterationInProgress: boolean = false;

  /**
   * Creates an instance of History.
   * @param {SocketManager} socketManager - The socket manager to handle socket connections.
   * @param {string} uwsHttpHost - The base URL of the WebSocket HTTP server.
   * @param {string} nspRoomId - The ID of the room for which metrics are being managed.
   */
  constructor(socketManager: SocketManager, nspRoomId: string) {
    this.socketManager = socketManager;
    this.nspRoomId = nspRoomId;
  }

  /**
   * Fetches message history for the specified room.
   * @param {HistoryGetOptions} opts - The options for fetching history, including the number of seconds and the limit.
   * @param {string} [nextPageToken] - The token for fetching the next page of results, if available.
   * @returns {Promise<HistoryClientResponse>} - A promise that resolves to a list of items with associated iterator method.
   * @throws {Error} - Throws an error if the request fails.
   */
  async get(opts?: HistoryGetOptions, nextPageToken?: string): Promise<HistoryClientResponse> {
    const { start, end, seconds, limit, https, items, order } = opts || {};

    this.start = start;
    this.end = end;
    this.seconds = seconds;
    this.limit = limit ?? HISTORY_MAX_REQUEST_LIMIT;
    this.order = order;
    this.https = https;
    this.iterationInProgress = true;

    return this.getHistoryWs(start, end, seconds, limit, items, order, nextPageToken);
  }

  /**
   * Fetches message history using WebSocket communication.
   * @param {number} [seconds] - The number of seconds of history to retrieve.
   * @param {number} [limit] - The maximum number of messages to retrieve.
   * @param {string} [nextPageToken] - The token for fetching the next page of results, if available.
   * @returns {Promise<HistoryClientResponse>} - A promise that resolves to a list of items with associated iterator method.
   * @throws {Error} - Throws an error if the request fails.
   */
  private async getHistoryWs(
    start?: number,
    end?: number,
    seconds?: number,
    limit?: number,
    items?: number,
    order?: HistoryOrder,
    nextPageToken?: string
  ): Promise<HistoryClientResponse> {
    logger.logInfo(`Fetching message history for room "${this.nspRoomId}" (ws)`);

    try {
      const historyRequestData = {
        nspRoomId: this.nspRoomId,
        start,
        end,
        seconds,
        limit,
        items,
        nextPageToken,
        order
      };

      const historyResponseData = await this.socketManager.emitWithAck<HistoryResponse>(
        ClientEvent.ROOM_HISTORY_GET,
        historyRequestData
      );

      return this.handleHistoryResponse(historyResponseData);
    } catch (err: any) {
      const message = `Error getting message history for "${this.nspRoomId}"`;
      logger.logError(message, err);
      throw new Error(message);
    }
  }

  /**
   * Fetches the next page of message history for the specified room.
   * @returns {Promise<HistoryClientResponse>} - A promise that resolves to a list of items with associated iterator method.
   * @throws {ValidationError} - Throws a ValidationError if called before `get()`
   * @throws {Error} - Throws an error if the request fails.
   */
  async next(): Promise<HistoryClientResponse> {
    if (!this.iterationInProgress) {
      throw new ValidationError('history.next() called before history.get()');
    }

    if (!this.nextPageToken) {
      return this.handleHistoryResponse();
    }

    logger.logInfo(
      `Fetching next page of message history for room "${this.nspRoomId}" (${
        this.https ? 'https' : 'ws'
      })`
    );

    const historyOptions = {
      seconds: this.seconds,
      start: this.start,
      end: this.end,
      limit: this.limit,
      https: this.https,
      order: this.order,
      items: this.itemsRemaining
    };

    return this.get(historyOptions, this.nextPageToken);
  }

  /**
   * Handles the response from a history request.
   * @param {HistoryResponse} [historyResponseData] - The data returned from the history request.
   * @returns {ClientMessage[]} - An array of client messages extracted from the history response.
   */
  private handleHistoryResponse(historyResponseData?: HistoryResponse): HistoryClientResponse {
    this.nextPageToken = null;
    this.itemsRemaining = undefined;

    const historyClientResponse: HistoryClientResponse = {
      items: []
    };

    if (historyResponseData) {
      const { messages, nextPageToken, itemsRemaining } = historyResponseData;

      historyClientResponse.items = messages || [];

      if (nextPageToken) {
        historyClientResponse.next = this.next.bind(this);
        this.nextPageToken = nextPageToken;
      }

      this.itemsRemaining = itemsRemaining;
    }

    return historyClientResponse;
  }
}
