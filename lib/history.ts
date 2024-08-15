import { logger } from './logger';
import { request } from './request';
import { FormattedResponse } from './types/request.types';
import { HistoryGetOptions, HistoryResponse } from './types/history.types';

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
   * @param {string} nspRoomid - The ID of the room for which metrics are being managed.
   */
  constructor(uwsHttpHost: string, nspRoomid: string) {
    this.nspRoomId = nspRoomid;
    this.uwsHttpHost = uwsHttpHost;
  }

  async get({ seconds, limit }: HistoryGetOptions, nextPageToken?: string): Promise<any> {
    logger.logInfo(`Fetching historical messages for room "${this.nspRoomId}"`);

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
    } catch (err: any) {
      logger.logError(err.message);
      throw new Error(err.message);
    }
  }

  async next(): Promise<any> {
    if (!this.nextPageToken) {
      throw new Error('history.next() called before history.get()');
    }

    logger.logInfo(`Fetching next page of historical messages for room "${this.nspRoomId}"`);

    try {
      const historyOptions = {
        seconds: this.seconds,
        limit: this.limit
      };

      return this.get(historyOptions, this.nextPageToken);
    } catch (err: any) {
      logger.logError(err.message);
      throw new Error(err.message);
    }
  }

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

  private getHistoryRequestParams(): RequestInit {
    return {
      method: 'GET',
      mode: 'cors' as RequestMode,
      headers: {
        'Content-Type': 'application/json'
      }
    };
  }
}
