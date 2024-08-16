import { logger } from './logger';
import { request } from './request';
import { FormattedResponse, HttpMethod, HttpMode } from './types/request.types';
import { HistoryClientResponse, HistoryGetOptions, HistoryResponse } from './types/history.types';
import { ValidationError } from './errors';
import { SocketManager } from './socket-manager';
import { ClientEvent } from './types/event.types';

const HISTORY_MAX_REQUEST_LIMIT = 100;

/**
 * The History class handles fetching message history for a specific room.
 */
export class History {
  private readonly nspRoomId: string;
  private readonly uwsHttpHost: string;
  private readonly socketManager: SocketManager;
  private seconds?: number;
  private limit?: number;
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
  constructor(socketManager: SocketManager, uwsHttpHost: string, nspRoomId: string) {
    this.socketManager = socketManager;
    this.uwsHttpHost = uwsHttpHost;
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
    const { seconds, limit, https, items } = opts || {};

    this.seconds = seconds;
    this.limit = limit ?? HISTORY_MAX_REQUEST_LIMIT;
    this.https = https;
    this.iterationInProgress = true;

    return https
      ? this.getHistoryHttps(seconds, limit, items, nextPageToken)
      : this.getHistoryWs(seconds, limit, items, nextPageToken);
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
    seconds?: number,
    limit?: number,
    items?: number,
    nextPageToken?: string
  ): Promise<HistoryClientResponse> {
    logger.logInfo(`Fetching message history for room "${this.nspRoomId}" (ws)`);

    try {
      const historyRequestData = {
        seconds,
        limit,
        items,
        nextPageToken,
        nspRoomId: this.nspRoomId
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
   * Fetches message history using HTTPS communication.
   * @param {number} [seconds] - The number of seconds of history to retrieve.
   * @param {number} [limit] - The maximum number of messages to retrieve.
   * @param {string} [nextPageToken] - The token for fetching the next page of results, if available.
   * @returns {Promise<HistoryClientResponse>} - A promise that resolves to a list of items with associated iterator method.
   * @throws {Error} - Throws an error if the request fails.
   */
  private async getHistoryHttps(
    seconds?: number,
    limit?: number,
    items?: number,
    nextPageToken?: string
  ): Promise<HistoryClientResponse> {
    logger.logInfo(`Fetching message history for room "${this.nspRoomId}" (https)`);

    const historyRequestUrl = this.getHistoryRequestUrl(seconds, limit, items, nextPageToken);
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
      limit: this.limit,
      https: this.https,
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

  /**
   * Constructs the URL for fetching message history.
   * @param {number} [seconds] - The number of seconds of history to retrieve.
   * @param {number} [limit] - The maximum number of messages to retrieve.
   * @param {string} [nextPageToken] - The token for fetching the next page of results, if available.
   * @returns {URL} - The constructed URL for the history request.
   */
  private getHistoryRequestUrl(
    seconds?: number,
    limit?: number,
    items?: number,
    nextPageToken?: string
  ): URL {
    const pathname = `/rooms/${this.nspRoomId}/messages`;

    const url = new URL(pathname, this.uwsHttpHost);

    if (seconds) {
      url.searchParams.set('seconds', seconds.toString());
    }

    if (limit) {
      url.searchParams.set('limit', limit.toString());
    }

    if (items) {
      url.searchParams.set('items', items.toString());
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
        'Content-Type': 'application/json',
        Accept: 'application/json'
      }
    };
  }
}
