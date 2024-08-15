import { logger } from './logger';
import { request } from './request';
import { FormattedResponse, HttpMethod, HttpMode } from './types/request.types';
import { HistoryGetOptions, HistoryResponse } from './types/history.types';
import { ClientMessage } from './types/message.types';
import { ValidationError } from './errors';

/**
 * The History class handles fetching historical messages for a specific room.
 */
export class History {
  private readonly nspRoomId: string;
  private readonly uwsHttpHost: string;
  private nextPageToken?: string;
  private seconds?: number;
  private limit?: number;

  /**
   * Creates an instance of History.
   * @param {string} uwsHttpHost - The base URL of the WebSocket HTTP server.
   * @param {string} nspRoomid - The ID of the room for which metrics are being managed.
   */
  constructor(uwsHttpHost: string, nspRoomid: string) {
    this.nspRoomId = nspRoomid;
    this.uwsHttpHost = uwsHttpHost;
  }

  /**
   * Fetches historical messages for the specified room.
   * @param {HistoryGetOptions} opts - The options for fetching history, including the number of seconds and the limit.
   * @param {string} [nextPageToken] - The token for fetching the next page of results, if available.
   * @returns {Promise<ClientMessage[]>} - A promise that resolves to an array of client messages.
   * @throws {Error} - Throws an error if the request fails.
   */
  async get(opts?: HistoryGetOptions, nextPageToken?: string): Promise<ClientMessage[]> {
    logger.logInfo(`Fetching historical messages for room "${this.nspRoomId}"`);

    const { seconds, limit } = opts || {};

    this.seconds = seconds;
    this.limit = limit;

    const historyRequestUrl = this.getHistoryRequestUrl(seconds, limit, nextPageToken);
    const historyRequestParams = this.getHistoryRequestParams();

    try {
      const { data: historyResponseData } = await request<FormattedResponse<HistoryResponse>>(
        historyRequestUrl,
        historyRequestParams
      );

      if (historyResponseData?.data) {
        const { messages, nextPageToken } = historyResponseData.data;

        if (nextPageToken) {
          this.nextPageToken = nextPageToken;
        }

        return messages;
      }

      return [];
    } catch (err: any) {
      logger.logError(err.message);
      throw err;
    }
  }

  /**
   * Fetches the next page of historical messages for the specified room.
   * @returns {Promise<ClientMessage[]>} - A promise that resolves to an array of client messages.
   * @throws {ValidationError} - Throws a ValidationError if called before `get()`
   * @throws {Error} - Throws an error if the request fails.
   */
  async next(): Promise<ClientMessage[]> {
    if (!this.nextPageToken) {
      throw new ValidationError('history.next() called before history.get()');
    }

    logger.logInfo(`Fetching next page of historical messages for room "${this.nspRoomId}"`);

    const historyOptions = {
      seconds: this.seconds,
      limit: this.limit
    };

    return this.get(historyOptions, this.nextPageToken);
  }

  /**
   * Constructs the URL for fetching historical messages.
   * @param {number} [seconds] - The number of seconds of history to retrieve.
   * @param {number} [limit] - The maximum number of messages to retrieve.
   * @param {string} [nextPageToken] - The token for fetching the next page of results, if available.
   * @returns {URL} - The constructed URL for the history request.
   */
  private getHistoryRequestUrl(seconds?: number, limit?: number, nextPageToken?: string): URL {
    const pathname = `/rooms/${this.nspRoomId}/messages`;

    const url = new URL(pathname, this.uwsHttpHost);

    if (seconds) {
      url.searchParams.set('seconds', seconds.toString());
    }

    if (limit) {
      url.searchParams.set('limit', limit.toString());
    }

    if (nextPageToken) {
      url.searchParams.set('nextPageToken', nextPageToken);
    }

    return url;
  }

  /**
   * Constructs the parameters for the history request.
   * @returns {RequestInit} - The parameters for the fetch request, including method, mode, and headers.
   */
  private getHistoryRequestParams(): RequestInit {
    return {
      method: HttpMethod.GET,
      mode: HttpMode.CORS as RequestMode,
      headers: {
        'Content-Type': 'application/json'
      }
    };
  }
}
