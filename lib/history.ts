import { logger } from './logger';
import { request } from './request';
import { FormattedResponse, HttpMethod, HttpMode } from './types/request.types';
import { HistoryGetOptions, HistoryResponse } from './types/history.types';
import { ClientMessage } from './types/message.types';
import { ValidationError } from './errors';
import { SocketManager } from './socket-manager';
import { ClientEvent } from './types/event.types';

/**
 * The History class handles fetching historical messages for a specific room.
 */
export class History {
  private readonly nspRoomId: string;
  private readonly uwsHttpHost: string;
  private readonly socketManager: SocketManager;
  private nextPageToken?: string;
  private seconds?: number;
  private limit?: number;
  private https?: boolean;

  /**
   * Creates an instance of History.
   * @param {string} uwsHttpHost - The base URL of the WebSocket HTTP server.
   * @param {string} nspRoomid - The ID of the room for which metrics are being managed.
   */
  constructor(socketManager: SocketManager, uwsHttpHost: string, nspRoomid: string) {
    this.socketManager = socketManager;
    this.uwsHttpHost = uwsHttpHost;
    this.nspRoomId = nspRoomid;
  }

  /**
   * Fetches historical messages for the specified room.
   * @param {HistoryGetOptions} opts - The options for fetching history, including the number of seconds and the limit.
   * @param {string} [nextPageToken] - The token for fetching the next page of results, if available.
   * @returns {Promise<ClientMessage[]>} - A promise that resolves to an array of client messages.
   * @throws {Error} - Throws an error if the request fails.
   */
  async get(opts?: HistoryGetOptions, nextPageToken?: string): Promise<ClientMessage[]> {
    const { seconds, limit, https } = opts || {};

    this.seconds = seconds;
    this.limit = limit;
    this.https = https;

    if (opts?.https) {
      return this.getHistoryHttps(seconds, limit, nextPageToken);
    } else {
      return this.getHistoryWs(seconds, limit, nextPageToken);
    }
  }

  private async getHistoryWs(
    seconds?: number,
    limit?: number,
    nextPageToken?: string
  ): Promise<ClientMessage[]> {
    logger.logInfo(`Fetching message history for room "${this.nspRoomId}" (ws)`);

    try {
      const data = {
        seconds,
        limit,
        nextPageToken,
        nspRoomId: this.nspRoomId
      };

      const historyResponseData = await this.socketManager.emitWithAck<HistoryResponse>(
        ClientEvent.ROOM_HISTORY_GET,
        data
      );

      return this.handleHistoryResponse(historyResponseData);
    } catch (err: any) {
      const message = `Error getting message history for "${this.nspRoomId}"`;
      logger.logError(message, err);
      throw new Error(message);
    }
  }

  private async getHistoryHttps(
    seconds?: number,
    limit?: number,
    nextPageToken?: string
  ): Promise<ClientMessage[]> {
    logger.logInfo(`Fetching message history for room "${this.nspRoomId}" (https)`);

    const historyRequestUrl = this.getHistoryRequestUrl(seconds, limit, nextPageToken);
    const historyRequestParams = this.getHistoryRequestParams();

    try {
      const { data: historyResponseData } = await request<FormattedResponse<HistoryResponse>>(
        historyRequestUrl,
        historyRequestParams
      );

      return this.handleHistoryResponse(historyResponseData?.data);
    } catch (err: any) {
      const message = `Error getting message history for "${this.nspRoomId}"`;
      logger.logError(message, err);
      throw new Error(message);
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

    logger.logInfo(
      `Fetching next page of message history for room "${this.nspRoomId}" (${
        this.https ? 'https' : 'ws'
      })`
    );

    const historyOptions = {
      seconds: this.seconds,
      limit: this.limit,
      https: this.https
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

  private handleHistoryResponse(historyResponseData?: HistoryResponse): ClientMessage[] {
    if (historyResponseData) {
      const { messages, nextPageToken } = historyResponseData;

      if (nextPageToken) {
        this.nextPageToken = nextPageToken;
      }

      return messages;
    }

    return [];
  }
}
