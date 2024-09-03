import EventEmitter from 'eventemitter3';
import { SocketManager } from './socket-manager';
import { EventRegistry } from './event-registry';

export class SubscriptionManager extends EventEmitter {
  readonly #socketManager: SocketManager;
  readonly #eventRegistry = new EventRegistry();

  constructor(socketManager: SocketManager) {
    super();
    this.#socketManager = socketManager;
  }

  async subscribe(): Promise<void> {
    console.log('subscribe');
  }

  async unsubscribe(): Promise<void> {
    console.log('unsubscribe');
  }
}
