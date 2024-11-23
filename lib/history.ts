import { logger } from './logger';
import {
  HistoryClientResponse,
  HistoryGetOptions,
  HistoryQueryParam,
  PaginatedHistoryClientResponse
} from './types/history.types';
import { TokenError } from './errors';
import { HttpMethod, HttpMode } from './types';
import { serviceRequest } from './request';

const HISTORY_SERVICE_PATHNAME = 'history';

/**
 * The History class handles fetching message history for a specific room.
 */
export class History {
  private nextPageToken: string | null = null;

  /**
   * Creates an instance of History.
   * @param {string} roomId - The room id to fetch history for.
   * @param {string} httpServiceUrl - The url of the core http service.
   * @param {Function} getAuthToken - Function to retreive the current auth token
   */
  constructor(
    private readonly roomId: string,
    private readonly httpServiceUrl: string,
    private getAuthToken: () => string | null
  ) {}

  /**
   * Fetches message history for the specified room.
   * @param {HistoryGetOptions} opts - The options for fetching history, including the number of seconds and the limit.
   * @returns {Promise<HistoryClientResponse>} - A promise that resolves to a list of items with associated iterator method.
   * @throws {Error} - Throws an error if the request fails.
   */
  public async get(opts?: HistoryGetOptions): Promise<HistoryClientResponse> {
    this.nextPageToken = null;
    return this.getHistory(this.nextPageToken, opts);
  }

  /**
   * Fetches next iteration of message history for the specified room using internally stored nextPageToken.
   * @returns {Promise<HistoryClientResponse>} - A promise that resolves to a list of items with associated iterator method.
   * @throws {Error} - Throws an error if the request fails.
   */
  public async next(): Promise<HistoryClientResponse> {
    if (!this.nextPageToken) {
      throw new Error('Next messages unavailable');
    }

    return this.getHistory(this.nextPageToken);
  }

  /**
   * Fetches paginated message history for the room via HTTPS.
   *
   * Constructs and sends an HTTP GET request with the provided query
   * parameters to retrieve message history. Requires an authentication token.
   *
   * @private
   * @async
   * @param {string} [nextPageToken] - Pagination offset.
   * @param {HistoryGetOptions} [opts] - History filter options.
   * @returns {Promise<HistoryClientResponse>} Resolves with message history and next iterator method.
   * @throws {TokenError} If no authentication token is provided.
   * @throws {Error} On request failure.
   */
  private async getHistory(
    nextPageToken: string | null,
    opts?: HistoryGetOptions
  ): Promise<HistoryClientResponse> {
    logger.logInfo(`Fetching message history for room "${this.roomId}" (https)`);

    try {
      const authToken = this.getAuthToken();

      if (!authToken) {
        throw new TokenError('No authentication token provided');
      }

      const requestParams: RequestInit = {
        method: HttpMethod.GET,
        mode: HttpMode.CORS,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        }
      };

      const queryParams = this.getQueryParams(nextPageToken, opts);
      const queryString = new URLSearchParams(queryParams).toString();

      const requestUrl = `${this.httpServiceUrl}/${HISTORY_SERVICE_PATHNAME}/${this.roomId}/messages?${queryString}`;

      const response = await serviceRequest<PaginatedHistoryClientResponse>(
        requestUrl,
        requestParams
      );

      this.nextPageToken = response.nextPageToken;

      return {
        items: response.items,
        next: this.nextPageToken ? this.next.bind(this) : null
      };
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
   * @param {string} [nextPageToken] - Pagination offset.
   * @param {HistoryGetOptions} [opts] - History filter options.
   * @returns {Record<string, string>} Query parameters object.
   */
  private getQueryParams(
    nextPageToken: string | null,
    opts?: HistoryGetOptions
  ): Record<string, string> {
    const queryParams: Record<string, string> = {};
    const { offset, limit, start, end, order } = opts || {};

    if (nextPageToken) {
      queryParams[HistoryQueryParam.NEXT_PAGE_TOKEN] = nextPageToken;
      return queryParams;
    }

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
