import { logger } from './logger';
import {
  HistoryClientResponse,
  HistoryGetOptions,
  HistoryGetOptionsV2,
  HistoryOrder,
  HistoryQueryParam,
  HistoryResponse,
  PaginatedHistoryClientResponse
} from './types/history.types';
import { TokenError, ValidationError } from './errors';
import { SocketManager } from './socket-manager';
import { ClientEvent } from './types/event.types';
import { HttpMethod, HttpMode } from './types';
import { serviceRequest } from './request';

const HISTORY_MAX_REQUEST_LIMIT = 100;
const HISTORY_SERVICE_PATHNAME = '/history';

/**
 * The History class handles fetching message history for a specific room.
 */
export class History {
  private readonly nspRoomId: string;
  private readonly roomId: string;
  private readonly socketManager: SocketManager;
  private readonly httpServiceUrl: string;
  private start?: number;
  private end?: number;
  private seconds?: number;
  private limit?: number;
  private order?: HistoryOrder;
  private https?: boolean;
  private nextPageToken: string | null = null;
  private itemsRemaining?: number;
  private iterationInProgress: boolean = false;
  private getAuthToken: () => string | null;

  /**
   * Creates an instance of History.
   * @param {SocketManager} socketManager - The socket manager to handle socket connections.
   * @param {string} nspRoomId - The ID of the room for which metrics are being managed.
   */
  constructor(
    socketManager: SocketManager,
    nspRoomId: string,
    roomId: string,
    httpServiceUrl: string,
    getAuthToken: () => string | null
  ) {
    this.socketManager = socketManager;
    this.nspRoomId = nspRoomId;
    this.roomId = roomId;
    this.httpServiceUrl = httpServiceUrl;
    this.getAuthToken = getAuthToken;
  }

  /**
   * Fetches message history for the specified room.
   * @param {HistoryGetOptions} opts - The options for fetching history, including the number of seconds and the limit.
   * @param {string} [nextPageToken] - The token for fetching the next page of results, if available.
   * @returns {Promise<HistoryClientResponse>} - A promise that resolves to a list of items with associated iterator method.
   * @throws {Error} - Throws an error if the request fails.
   */
  async _get(opts?: HistoryGetOptions, nextPageToken?: string): Promise<HistoryClientResponse> {
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
   * Fetches message history for the specified room.
   * @param {HistoryGetOptions} opts - The options for fetching history, including the number of seconds and the limit.
   * @param {string} [nextPageToken] - The token for fetching the next page of results, if available.
   * @returns {Promise<HistoryClientResponse>} - A promise that resolves to a list of items with associated iterator method.
   * @throws {Error} - Throws an error if the request fails.
   */
  async get(
    opts?: HistoryGetOptionsV2,
    nextPageToken?: string
  ): Promise<PaginatedHistoryClientResponse> {
    const { start, end, offset, limit, seconds, order } = opts || {};

    this.start = start;
    this.end = end;
    this.seconds = seconds;
    this.limit = limit ?? HISTORY_MAX_REQUEST_LIMIT;
    this.order = order;
    this.iterationInProgress = true;

    return this.getHistoryHttps(start, end, offset, limit, order);
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
   * Fetches paginated message history for the room via HTTPS.
   *
   * Constructs and sends an HTTP GET request with the provided query
   * parameters to retrieve message history. Requires an authentication token.
   *
   * @private
   * @async
   * @param {number} [start] - Start timestamp for messages.
   * @param {number} [end] - End timestamp for messages.
   * @param {number} [offset] - Pagination offset.
   * @param {number} [limit] - Maximum number of messages to retrieve.
   * @param {HistoryOrder} [order] - Sort order ('asc' or 'desc').
   * @returns {Promise<PaginatedHistoryClientResponse>} Resolves with paginated message history.
   * @throws {TokenError} If no authentication token is provided.
   * @throws {Error} On request failure.
   */
  private async getHistoryHttps(
    start?: number,
    end?: number,
    offset?: number,
    limit?: number,
    order?: HistoryOrder
  ): Promise<PaginatedHistoryClientResponse> {
    logger.logInfo(`Fetching message history for room "${this.roomId}" (https)`);

    try {
      const queryParams = this.getHistoryQueryParams(start, end, offset, limit, order);
      const queryString = new URLSearchParams(queryParams).toString();
      const requestUrl = `${this.httpServiceUrl}${HISTORY_SERVICE_PATHNAME}/${this.roomId}/messages?${queryString}`;

      const params: RequestInit = {
        method: HttpMethod.GET,
        mode: HttpMode.CORS
      };

      const authToken = this.getAuthToken();

      if (!authToken) {
        throw new TokenError('No authentication token provided');
      }

      params.headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      };

      const response = await serviceRequest<PaginatedHistoryClientResponse>(requestUrl, params);

      return response;
    } catch (err: any) {
      const message = `Error getting message history for "${this.roomId}"`;
      logger.logError(message, err);
      throw err;
    }
  }

  /**
   * Builds query parameters for message history requests.
   *
   * Returns an object with non-undefined values for filtering messages
   * by start/end timestamps, pagination, and sort order.
   *
   * @private
   * @param {number} [start] - Start timestamp for filtering messages.
   * @param {number} [end] - End timestamp for filtering messages.
   * @param {number} [offset] - Pagination offset.
   * @param {number} [limit] - Maximum number of messages to retrieve.
   * @param {HistoryOrder} [order] - Sort order ('asc' or 'desc').
   * @returns {Record<string, string>} Query parameters object.
   */
  private getHistoryQueryParams(
    start?: number,
    end?: number,
    offset?: number,
    limit?: number,
    order?: HistoryOrder
  ) {
    const queryParams: Record<string, string> = {};

    if (start) {
      queryParams[HistoryQueryParam.START] = start.toString();
    }

    if (end) {
      queryParams[HistoryQueryParam.END] = end.toString();
    }

    if (offset) {
      queryParams[HistoryQueryParam.OFFSET] = offset.toString();
    }

    if (limit) {
      queryParams[HistoryQueryParam.LIMIT] = limit.toString();
    }

    if (order) {
      queryParams[HistoryQueryParam.ORDER] = order;
    }

    return queryParams;
  }

  /**
   * Fetches the next page of message history for the specified room.
   * @returns {Promise<HistoryClientResponse>} - A promise that resolves to a list of items with associated iterator method.
   * @throws {ValidationError} - Throws a ValidationError if called before `get()`
   * @throws {Error} - Throws an error if the request fails.
   */
  async next(): Promise<any> {
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
