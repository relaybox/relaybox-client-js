import { logger } from './logger';
import { defaultHeaders, serviceRequest } from './request';
import { ClientEvent, HttpMethod, HttpMode } from './types';
import {
  IntellectOptions,
  IntellectQueryOptions,
  IntellectResponse
} from './types/intellect.types';
import { SubscriptionManager } from './subscription-manager';
import { SocketManager } from './socket-manager';

const SUBSCRIPTION_NAMESPACE = 'intellect';
const PLATFORM_RESERVED_NAMESPACE = '$';

type UserEvents = 'thinking' | 'response';

export class Intellect extends SubscriptionManager<UserEvents> {
  private opts?: IntellectOptions | null = null;

  constructor(
    socketManager: SocketManager,
    private nspRoomId: string,
    private readonly roomId: string,
    private readonly stateServiceUrl: string,
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

  async set(opts: IntellectOptions): Promise<IntellectOptions> {
    logger.logInfo(`Saving intellect options ${this.roomId}`);

    try {
      const authToken = this.getAuthToken();

      if (!authToken) {
        throw new Error('No auth token found');
      }

      const requestParams: RequestInit = {
        method: HttpMethod.PUT,
        mode: HttpMode.CORS,
        body: JSON.stringify(opts),
        headers: {
          ...defaultHeaders,
          Authorization: `Bearer ${authToken}`
        }
      };

      const requestUrl = `${this.stateServiceUrl}/rooms/${this.roomId}`;

      const response = await serviceRequest<IntellectOptions>(requestUrl, requestParams);

      this.opts = response;

      return response;
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }

  async get(): Promise<IntellectOptions> {
    logger.logInfo(`Getting intellect options ${this.roomId}`);

    if (this.opts) {
      return this.opts;
    }

    try {
      const authToken = this.getAuthToken();

      if (!authToken) {
        throw new Error('No auth token found');
      }

      const requestParams: RequestInit = {
        method: HttpMethod.GET,
        mode: HttpMode.CORS,
        headers: {
          ...defaultHeaders,
          Authorization: `Bearer ${authToken}`
        }
      };

      const requestUrl = `${this.stateServiceUrl}/rooms/${this.roomId}`;

      const response = await serviceRequest<IntellectOptions>(requestUrl, requestParams);

      this.opts = response;

      return response;
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }
}
