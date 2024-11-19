import EventEmitter from 'eventemitter3';
import { logger } from './logger';
import { defaultHeaders, serviceRequest } from './request';
import { HttpMethod, HttpMode } from './types';
import { IntellectQueryOptions, IntellectResponse } from './types/intellect.types';

const QUERIES_PATHNAME = '/queries';

export class Intellect extends EventEmitter {
  constructor(
    private readonly roomId: string,
    private readonly intellectServiceUrl: string,
    private readonly publish: <T>(event: string, userData: T) => Promise<any>,
    private readonly getAuthToken: () => string | null
  ) {
    super();
  }

  /**
   * Create and dispatch a new Intellect service query.
   * Include optional params to refine results
   *
   * @param {string} input - Natural language query relating to current room
   * @param {IntellectQueryOptions} opts - Optional current {conversationId} for RAG context
   * @returns {IntellectResponse}
   */
  async query(input: string, opts?: IntellectQueryOptions): Promise<IntellectResponse> {
    const { conversationId, assetId, streaming } = opts ?? {};

    logger.logInfo(`Running intellect query for ${conversationId}`);

    try {
      const requestBody = {
        input,
        roomId: this.roomId,
        conversationId,
        assetId,
        streaming
      };

      const requestParams: RequestInit = {
        method: HttpMethod.POST,
        mode: HttpMode.CORS,
        body: JSON.stringify(requestBody),
        headers: {
          ...defaultHeaders,
          Authorization: `Bearer ${this.getAuthToken()}`
        }
      };

      const url = `${this.intellectServiceUrl}${QUERIES_PATHNAME}`;

      const response = await serviceRequest<IntellectResponse>(url, requestParams);

      return response;
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }
}
