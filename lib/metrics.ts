import { logger } from './logger';
import { ClientEvent } from './types/event.types';
import { SocketEventHandler } from './types/socket.types';
import { SocketManager } from './socket-manager';

/**
 * Enum representing allowed values for Metrics events.
 * @enum {string}
 */
export enum MetricsEventAllowedValue {
  ALL = 'all'
}

/**
 * The Metrics class handles subscribing to and unsubscribing from metrics events for a specific room.
 */
export class Metrics {
  private readonly socketManager: SocketManager;
  private readonly roomId: string;
  private subscription: string | null = null;
  private handlerRefs: Map<SocketEventHandler, number> = new Map();

  /**
   * Creates an instance of Metrics.
   * @param {SocketManager} socketManager - The socket manager to handle socket connections.
   * @param {string} roomId - The ID of the room for which metrics are being managed.
   */
  constructor(socketManager: SocketManager, roomId: string) {
    this.socketManager = socketManager;
    this.roomId = roomId;
  }

  /**
   * Subscribes to metrics events for the room and binds the given handler.
   * If already subscribed, it adds the handler to the existing subscription.
   * @param {SocketEventHandler} handler - The event handler to bind to the metrics events.
   * @returns {Promise<void>}
   * @throws Will throw an error if the subscription fails.
   */
  async subscribe(handler: SocketEventHandler): Promise<void> {
    this.incrementHandlerRefCount(handler);

    if (this.subscription) {
      logger.logInfo(`Binding additional handler to existing subscription ${this.subscription}`);
      this.bindSubscriptionHandler(this.subscription, handler);
      return;
    }

    const data = { roomId: this.roomId, event: MetricsEventAllowedValue.ALL };

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

  /**
   * Unsubscribes from metrics events for the room and unbinds the given handler.
   * If no handler is provided, it unbinds all handlers from the subscription.
   * @param {SocketEventHandler} [handler] - The event handler to unbind.
   * @returns {Promise<void>}
   * @throws Will throw an error if the unsubscription fails.
   */
  async unsubscribe(handler?: SocketEventHandler): Promise<void> {
    const data = { roomId: this.roomId, event: MetricsEventAllowedValue.ALL };

    try {
      this.unbindSubscriptionHandlers(this.subscription!, handler);

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

  /**
   * Binds the given handler to the specified subscription.
   * @param {string} subscription - The subscription name.
   * @param {SocketEventHandler} handler - The event handler to bind.
   * @private
   */
  private bindSubscriptionHandler(subscription: string, handler: SocketEventHandler): void {
    this.socketManager.on(subscription, handler);
  }

  /**
   * Unbinds the given handler from the specified subscription.
   * If no handler is provided, unbinds all handlers from the subscription.
   * @param {string} subscription - The subscription name.
   * @param {SocketEventHandler} [handler] - The event handler to unbind.
   * @private
   */
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

  /**
   * Increments the reference count for the given handler.
   * @param {SocketEventHandler} handler - The event handler to increment the reference count for.
   * @private
   */
  private incrementHandlerRefCount(handler: SocketEventHandler): void {
    const handlerRef = this.handlerRefs.get(handler) || 0;
    this.handlerRefs.set(handler, handlerRef + 1);
  }

  /**
   * Decrements the reference count for the given handler.
   * If the reference count reaches zero, the handler is removed.
   * @param {SocketEventHandler} handler - The event handler to decrement the reference count for.
   * @private
   */
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
