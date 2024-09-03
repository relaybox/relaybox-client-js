import { SocketManager } from './socket-manager';
import { SubscriptionManager } from './subscription-manager';

export class User extends SubscriptionManager {
  public readonly id: string;
  public readonly clientId: string;
  public readonly username: string;
  public readonly createdAt: string;
  public readonly updatedAt: string;
  public readonly orgId: string;

  constructor(
    socketManager: SocketManager,
    id: string,
    clientId: string,
    username: string,
    createdAt: string,
    updatedAt: string,
    orgId: string
  ) {
    super(socketManager);

    this.id = id;
    this.clientId = clientId;
    this.username = username;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.orgId = orgId;
  }
}
