import EventEmitter from 'eventemitter3';
import { SocketManager } from './socket-manager';
import { EventRegistry } from './event-registry';
import { SocketEventHandler } from './types/socket.types';
import { logger } from './logger';
import { ClientEvent } from './types';
import { ValidationError } from './errors';

export abstract class SubscriptionManager<
  AllowedEvents extends string = string
> extends EventEmitter {
  protected abstract getSubscriptionName(event: string): string;
  protected abstract get subscriptionId(): string;
  protected abstract get subscribeClientEventType(): ClientEvent;
  protected abstract get unsubscribeClientEventType(): ClientEvent;
  protected abstract get unsubscribeAllClientEventType(): ClientEvent;

  readonly #socketManager: SocketManager;
  readonly #eventRegistry = new EventRegistry();

  constructor(socketManager: SocketManager) {
    super();
    this.#socketManager = socketManager;
  }

  async subscribe(
    eventOrHandler: AllowedEvents | SocketEventHandler,
    handler?: SocketEventHandler
  ): Promise<SubscriptionManager> {
    const { event, eventHandler } = this.prepareSubscription(eventOrHandler, handler);
    await this.execSubscription(event, eventHandler);
    return this;
  }

  async unsubscribe(
    event?: AllowedEvents,
    handler?: SocketEventHandler
  ): Promise<SubscriptionManager> {
    if (event) {
      await this.unsubscribeEvent(event, handler);
    } else {
      await this.unsubscribeAllEvents();
    }

    return this;
  }

  private prepareSubscription(
    eventOrHandler: string | SocketEventHandler,
    handler?: SocketEventHandler
  ): { event: string; eventHandler: SocketEventHandler } {
    const event = typeof eventOrHandler === 'function' ? 'all' : eventOrHandler;

    const eventHandler = handler || <SocketEventHandler>eventOrHandler;

    return {
      event,
      eventHandler
    };
  }

  private async execSubscription(event: string, handler: SocketEventHandler): Promise<void> {
    try {
      await this.subscribeEvent(event, handler);
    } catch (err: any) {
      const message = `Error subscribing to event: "${event}"`;
      logger.logError(message, err);
      throw new Error(message);
    }
  }

  private async subscribeEvent(event: string, handler: SocketEventHandler): Promise<void> {
    logger.logInfo(`Binding handler: ${event}"`);

    const eventState = this.#eventRegistry.getHandlersForEvent(event);

    this.pushEventHandler(event, handler);

    if (!eventState) {
      logger.logInfo(`Syncing event:${event}"`);

      const data = {
        subscriptionId: this.subscriptionId,
        event
      };

      try {
        await this.#socketManager.emitWithAck(this.subscribeClientEventType, data);
      } catch (err: any) {
        this.removeEventHandler(event, handler);
        logger.logError(err.message);
        throw new Error(err.message);
      }
    }
  }

  private async unsubscribeEvent(event: string, handler?: SocketEventHandler): Promise<void> {
    logger.logInfo(`Unbinding handler:${event}`);

    const existingHandler = this.#eventRegistry.getHandlersForEvent(event);

    if (!existingHandler) {
      throw new ValidationError(`Client is not subscribed to ${event}`);
    }

    if (handler) {
      this.removeEventHandler(event, handler);
    }

    if (!handler || !existingHandler.size) {
      logger.logInfo(`All handers unbound, syncing ${event}`);

      const data = {
        subscriptionId: this.subscriptionId,
        event
      };

      try {
        await this.#socketManager.emitWithAck(this.unsubscribeClientEventType, data);
        this.unbindAll(event);
      } catch (err: any) {
        if (handler) {
          this.pushEventHandler(event, handler);
        }

        const message = `Error unsubscribing to event "${event}"`;

        logger.logError(message, err);
        throw new Error(message);
      }
    }
  }

  private async unsubscribeAllEvents(): Promise<void> {
    logger.logInfo(`Unbinding all events`);

    const existingHandlers = this.#eventRegistry.getAllHandlers();

    if (!existingHandlers?.size) {
      return;
    }

    const data = {
      subscriptionId: this.subscriptionId
    };

    try {
      await this.#socketManager.emitWithAck(this.unsubscribeAllClientEventType, data);

      this.clearEventHandlers();

      logger.logInfo(`Successfully removed all subscriptions`);
    } catch (err: any) {
      const message = `Error unsubscribing from all events`;
      logger.logError(message, err);
      throw new Error(message);
    }
  }

  private removeEventHandler(event: string, handler: SocketEventHandler): void {
    const subscription = this.getSubscriptionName(event);

    logger.logInfo(`Removing event handler from ${subscription}`);

    const refCount = this.#eventRegistry.detachHandlers(event, handler);

    if (refCount > 0) {
      for (let i = refCount; i > 0; i--) {
        this.#socketManager?.off(subscription, handler);
      }
    } else {
      throw new ValidationError(`Defined handler is not attached the ${event} event`);
    }
  }

  private pushEventHandler(event: string, handler: SocketEventHandler): void {
    const subscription = this.getSubscriptionName(event);

    logger.logInfo(`Pushing event handler to ${subscription}`);

    this.#eventRegistry.attachHandler(event, handler);
    this.#socketManager?.on(subscription, handler);
  }

  private unbindAll(event: string): void {
    const subscription = this.getSubscriptionName(event);

    logger.logInfo(`Unbinding all listeners ${subscription}`);

    this.#socketManager.off(subscription);
    this.#eventRegistry.deleteHandler(event);
  }

  private clearEventHandlers(): void {
    logger.logInfo(`Removing all handler refs map`);

    this.#eventRegistry.getAllHandlers()?.forEach((_, event) => {
      this.unbindAll(event);
    });

    this.#eventRegistry.clearHandlers();
  }
}
