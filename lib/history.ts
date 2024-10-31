import { logger } from './logger';
import {
  HistoryGetOptionsV2,
  HistoryOrder,
  HistoryQueryParam,
  PaginatedHistoryClientResponse
} from './types/history.types';
import { TokenError } from './errors';
import { SocketManager } from './socket-manager';
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
  private offset?: number;
  private limit?: number;
  private start?: number;
  private end?: number;
  private order?: HistoryOrder;
  private https?: boolean;
  private nextPageToken: string | null = null;
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
  async get(
    opts?: HistoryGetOptionsV2,
    nextPageToken?: string
  ): Promise<PaginatedHistoryClientResponse> {
    const { offset, limit, start, end, order } = opts || {};

    this.offset = offset;
    this.limit = limit ?? HISTORY_MAX_REQUEST_LIMIT;
    this.start = start;
    this.end = end;
    this.order = order;

    return this.getHistoryHttps(offset, limit, start, end, order);
  }

  /**
   * Fetches paginated message history for the room via HTTPS.
   *
   * Constructs and sends an HTTP GET request with the provided query
   * parameters to retrieve message history. Requires an authentication token.
   *
   * @private
   * @async
   * @param {number} [offset] - Pagination offset.
   * @param {number} [limit] - Maximum number of messages to retrieve.
   * @param {number} [start] - Start timestamp for messages.
   * @param {number} [end] - End timestamp for messages.
   * @param {HistoryOrder} [order] - Sort order ('asc' or 'desc').
   * @returns {Promise<PaginatedHistoryClientResponse>} Resolves with paginated message history.
   * @throws {TokenError} If no authentication token is provided.
   * @throws {Error} On request failure.
   */
  private async getHistoryHttps(
    offset?: number,
    limit?: number,
    start?: number,
    end?: number,
    order?: HistoryOrder
  ): Promise<PaginatedHistoryClientResponse> {
    logger.logInfo(`Fetching message history for room "${this.roomId}" (https)`);

    try {
      const queryParams = this.getHistoryQueryParams(offset, limit, start, end, order);
      const queryString = new URLSearchParams(queryParams).toString();
      console.log(queryString);
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
   * @param {number} [offset] - Pagination offset.
   * @param {number} [limit] - Maximum number of messages to retrieve.
   * @param {number} [start] - Start timestamp for filtering messages.
   * @param {number} [end] - End timestamp for filtering messages.
   * @param {HistoryOrder} [order] - Sort order ('asc' or 'desc').
   * @returns {Record<string, string>} Query parameters object.
   */
  private getHistoryQueryParams(
    offset?: number,
    limit?: number,
    start?: number,
    end?: number,
    order?: HistoryOrder
  ): Record<string, string> {
    const queryParams: Record<string, string> = {};

    if (offset) {
      queryParams[HistoryQueryParam.OFFSET] = offset.toString();
    }

    if (limit) {
      queryParams[HistoryQueryParam.LIMIT] = limit.toString();
    }

    if (start) {
      queryParams[HistoryQueryParam.START] = start.toString();
    }

    if (end) {
      queryParams[HistoryQueryParam.END] = end.toString();
    }

    if (order) {
      queryParams[HistoryQueryParam.ORDER] = order;
    }

    return queryParams;
  }
}
