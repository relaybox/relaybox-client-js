import { SocketManager } from './socket-manager';
import { SubscriptionManager } from './subscription-manager';
import { AuthUserPublic, SocketEventHandler } from './types';
import { ClientEvent } from './types/event.types';

const SUBSCRIPTION_NAMESPACE = 'users';
const PLATFORM_RESERVED_NAMESPACE = '$';

type UserEvents =
  | 'user:connection:status'
  | 'user:connect'
  | 'user:disconnect'
  | 'user:status:update';

export class User extends SubscriptionManager<UserEvents> {
  public readonly id: string;
  public readonly clientId: string;
  public readonly username: string;
  public readonly createdAt: string;
  public readonly orgId: string;

  public isOnline: boolean;
  public lastOnline: string;
  public updatedAt: string;

  protected get subscriptionId(): string {
    return this.clientId;
  }

  constructor(socketManager: SocketManager, user: AuthUserPublic) {
    super(socketManager);

    this.id = user.id;
    this.clientId = user.clientId;
    this.username = user.username;
    this.createdAt = user.createdAt;
    this.updatedAt = user.updatedAt;
    this.orgId = user.orgId;
    this.isOnline = user.isOnline;
    this.lastOnline = user.lastOnline;
  }

  setIsOnline(isOnline: boolean): void {
    this.isOnline = isOnline;
  }

  protected getSubscriptionName(event: string): string {
    return `${SUBSCRIPTION_NAMESPACE}:${this.clientId}:${PLATFORM_RESERVED_NAMESPACE}:${event}`;
  }

  protected get subscribeClientEventType(): ClientEvent {
    return ClientEvent.AUTH_USER_SUBSCRIBE;
  }

  protected get unsubscribeClientEventType(): ClientEvent {
    return ClientEvent.AUTH_USER_UNSUBSCRIBE;
  }

  protected get unsubscribeAllClientEventType(): ClientEvent {
    return ClientEvent.AUTH_USER_UNSUBSCRIBE_ALL;
  }

  onConnectionEvent(handler: SocketEventHandler): Promise<SubscriptionManager> {
    return this.subscribe('user:connection:status', handler);
  }

  onConnect(handler: SocketEventHandler): Promise<SubscriptionManager> {
    return this.subscribe('user:connect', handler);
  }

  onDisconnect(handler: SocketEventHandler): Promise<SubscriptionManager> {
    return this.subscribe('user:disconnect', handler);
  }

  onStatusUpdate(handler: SocketEventHandler): Promise<SubscriptionManager> {
    return this.subscribe('user:status:update', handler);
  }
}
