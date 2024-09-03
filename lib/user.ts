import { SocketManager } from './socket-manager';
import { SubscriptionManager } from './subscription-manager';
import { ClientEvent } from './types/event.types';

const SUBSCRIPTION_NAMESPACE = 'users';
const PLATFORM_RESERVED_NAMESPACE = '$';

type UserEvents = 'online' | 'offline' | 'update' | 'all';

export class User extends SubscriptionManager<UserEvents> {
  public readonly id: string;
  public readonly clientId: string;
  public readonly username: string;
  public readonly createdAt: string;
  public readonly updatedAt: string;
  public readonly orgId: string;
  public readonly isOnline: boolean;
  public readonly lastOnline: string;

  protected get subscriptionId(): string {
    return this.clientId;
  }

  constructor(
    socketManager: SocketManager,
    id: string,
    clientId: string,
    username: string,
    createdAt: string,
    updatedAt: string,
    orgId: string,
    isOnline: boolean,
    lastOnline: string
  ) {
    super(socketManager);

    this.id = id;
    this.clientId = clientId;
    this.username = username;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.orgId = orgId;
    this.isOnline = isOnline;
    this.lastOnline = lastOnline;
  }

  protected getSubscriptionName(event: string): string {
    return `${this.clientId}:${PLATFORM_RESERVED_NAMESPACE}:${SUBSCRIPTION_NAMESPACE}:${event}`;
  }

  protected get subscribeClientEventType(): ClientEvent {
    return ClientEvent.AUTH_USER_SUBSCRIBE;
  }

  protected get unsubscribeClientEventType(): ClientEvent {
    return ClientEvent.AUTH_USER_UNSUBSCRIBE;
  }
}
