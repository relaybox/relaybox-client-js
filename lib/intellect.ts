import { logger } from './logger';
import { defaultHeaders, serviceRequest } from './request';
import { ClientEvent, HttpMethod, HttpMode } from './types';
import { IntellectQueryOptions, IntellectResponse } from './types/intellect.types';
import { SubscriptionManager } from './subscription-manager';
import { SocketManager } from './socket-manager';

const QUERIES_PATHNAME = 'queries';
const SUBSCRIPTION_NAMESPACE = 'intellect';
const PLATFORM_RESERVED_NAMESPACE = '$';

type UserEvents = 'thinking' | 'response';

export class Intellect extends SubscriptionManager<UserEvents> {
  constructor(
    socketManager: SocketManager,
    private nspRoomId: string,
    private readonly roomId: string,
    private readonly intellectServiceUrl: string,
    private readonly publish: <T>(event: string, userData: T) => Promise<any>,
    private readonly getAuthToken: () => string | null
  ) {
    super(socketManager);
  }

  protected get subscriptionId(): string {
    return this.roomId;
  }

  protected getSubscriptionName(event: string): string {
    return `${this.nspRoomId}:${PLATFORM_RESERVED_NAMESPACE}:${SUBSCRIPTION_NAMESPACE}:${event}`;
  }

  protected get subscribeClientEventType(): ClientEvent {
    return ClientEvent.ROOM_INTELLECT_SUBSCRIBE;
  }

  protected get unsubscribeClientEventType(): ClientEvent {
    return ClientEvent.ROOM_INTELLECT_UNSUBSCRIBE;
  }

  protected get unsubscribeAllClientEventType(): ClientEvent {
    return ClientEvent.ROOM_INTELLECT_UNSUBSCRIBE_ALL;
  }

  /**
   * Create and dispatch a new Intellect service query.
   * Include optional params to refine results
   *
   * @param {string} input - Natural language query relating to current room
   * @param {IntellectQueryOptions} opts - Optional current {conversationId} for RAG context
   * @returns {IntellectResponse}
   */
  // async query(input: string, opts?: IntellectQueryOptions): Promise<IntellectResponse> {
  //   const { conversationId, assetId, streaming } = opts ?? {};

  //   logger.logInfo(`Running intellect query for ${conversationId}`);

  //   try {
  //     const authToken = this.getAuthToken();

  //     if (!authToken) {
  //       throw new Error('No auth token found');
  //     }

  //     const requestBody = {
  //       input,
  //       roomId: this.roomId,
  //       conversationId,
  //       assetId,
  //       streaming
  //     };

  //     const requestParams: RequestInit = {
  //       method: HttpMethod.POST,
  //       mode: HttpMode.CORS,
  //       body: JSON.stringify(requestBody),
  //       headers: {
  //         ...defaultHeaders,
  //         Authorization: `Bearer ${authToken}`
  //       }
  //     };

  //     const url = `${this.intellectServiceUrl}/${QUERIES_PATHNAME}`;

  //     const response = await serviceRequest<IntellectResponse>(url, requestParams);

  //     return response;
  //   } catch (err: any) {
  //     logger.logError(err.message, err);
  //     throw err;
  //   }
  // }
}
