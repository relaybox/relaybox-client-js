import { logger } from './logger';
import { ClientEvent } from './types/event.types';
import { SocketEventHandler } from './types/socket.types';
import { SocketManager } from './socket-manager';

export enum DsMetricsEventAllowedValue {
  ALL = 'all'
}

export class Metrics {
  private readonly socketManager: SocketManager;
  private readonly roomId: string;
  private subscription: string;
  private handlerRefs: Map<SocketEventHandler, number> = new Map();

  constructor(socketManager: SocketManager, roomId: string) {
    this.socketManager = socketManager;
    this.roomId = roomId;
  }

  async subscribe(handler: SocketEventHandler) {
    this.incrementHandlerRefCount(handler);

    if (this.subscription) {
      logger.logInfo(`Binding additional handler to existing subscription ${this.subscription}`);
      this.bindSubscriptionHandler(this.subscription, handler);
      return;
    }

    const data = { roomId: this.roomId, event: DsMetricsEventAllowedValue.ALL };

    try {
      const subscription = await this.socketManager.emitWithAck<string>(
        ClientEvent.ROOM_METRICS_SUBSCRIBE,
        data
      );

      this.bindSubscriptionHandler(subscription, handler);

      this.subscription = subscription;

      logger.logInfo(`Sucessfully subscribed to "${subscription}"`);
    } catch (err: any) {
      this.decrementHandlerRefCount(handler);
      logger.logError(err.message);
      throw new Error(err.message);
    }
  }

  async unsubscribe(handler?: SocketEventHandler) {
    const data = { roomId: this.roomId, event: DsMetricsEventAllowedValue.ALL };

    try {
      this.unbindSubscriptionHandlers(this.subscription, handler);

      if (!this.handlerRefs.size) {
        const subscription = await this.socketManager.emitWithAck<string>(
          ClientEvent.ROOM_METRICS_UNSUBSCRIBE,
          data
        );

        logger.logInfo(`Sucessfully unsubscribed from "${subscription}"`);
      }
    } catch (err: any) {
      logger.logError(err.message);
      throw new Error(err.message);
    }
  }

  private bindSubscriptionHandler(subscription: string, handler: SocketEventHandler): void {
    this.socketManager.on(subscription, handler);
  }

  private unbindSubscriptionHandlers(subscription: string, handler?: SocketEventHandler): void {
    if (handler) {
      const refCount = this.handlerRefs.get(handler) || 0;

      for (let i = refCount; i > 0; i--) {
        this.socketManager.off(subscription, handler);
      }

      this.handlerRefs.delete(handler);

      logger.logInfo(`Unbound ${subscription} handler (${handler.name})`);
    } else {
      this.socketManager.off(subscription);
      this.handlerRefs.clear();
      logger.logInfo(`Unbound all ${subscription} handlers`);
    }
  }

  private incrementHandlerRefCount(handler: SocketEventHandler): void {
    const handlerRef = this.handlerRefs.get(handler) || 0;
    this.handlerRefs.set(handler, handlerRef + 1);
  }

  private decrementHandlerRefCount(handler: SocketEventHandler): void {
    const handlerRef = this.handlerRefs.get(handler) || 0;

    if (handlerRef > 0) {
      const newRef = handlerRef - 1;
      this.handlerRefs.set(handler, newRef);

      if (newRef === 0) {
        this.handlerRefs.delete(handler);
      }
    }
  }
}
