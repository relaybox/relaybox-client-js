import { ClientEvent } from './types/event.types';
import { SocketEventHandler } from './types/socket.types';
import { Presence } from './presence';
import { logger } from './logger';
import { MetricsFactory, PresenceFactory } from './factory';
import { validateUserData } from './validation';
import { Metrics } from './metrics';
import { EventRegistry } from './event-registry';
import { SocketManager } from './socket-manager';

export class Room {
  private readonly socketManager: SocketManager;
  private readonly presenceFactory: PresenceFactory;
  private readonly metricsFactory: MetricsFactory;
  private readonly eventRegistry = new EventRegistry();
  private nspRoomId: string | null = null;

  public readonly roomId: string;
  public presence: Presence | null = null;
  public metrics: Metrics | null = null;

  constructor(
    roomId: string,
    socketManager: SocketManager,
    presencefactory: PresenceFactory,
    metricsFactory: MetricsFactory
  ) {
    this.roomId = roomId;
    this.socketManager = socketManager;
    this.presenceFactory = presencefactory;
    this.metricsFactory = metricsFactory;
  }

  async create(): Promise<Room> {
    logger.logInfo(`Creating room "${this.roomId}"`);

    const data = { roomId: this.roomId };

    try {
      const nspRoomId = await this.socketManager.emitWithAck<string>(ClientEvent.ROOM_JOIN, data);

      logger.logInfo(`Successfully joined room "${nspRoomId}"`);

      this.nspRoomId = nspRoomId;

      this.presence = this.presenceFactory.createPresence(
        this.socketManager,
        this.roomId,
        nspRoomId
      );

      this.metrics = this.metricsFactory.createMetrics(this.socketManager, this.roomId);

      return this;
    } catch (err: any) {
      logger.logError(err.message, err);
      throw new Error(err.message);
    }
  }

  getEventAndHandler(
    eventOrHandler?: string | SocketEventHandler,
    eventHandler?: SocketEventHandler
  ): { event: string | undefined; handler: SocketEventHandler } {
    if (typeof eventOrHandler === 'function') {
      return {
        event: '$:subscribe:all',
        handler: eventOrHandler
      };
    }

    return {
      event: eventOrHandler,
      handler: eventHandler!
    };
  }

  async subscribe(
    eventOrHandler: string | SocketEventHandler,
    eventHandler?: SocketEventHandler
  ): Promise<this> {
    const { event, handler } = this.getEventAndHandler(eventOrHandler, eventHandler);

    if (!event) {
      throw new Error('No event or handler provided');
    }

    logger.logInfo(`Binding handler "${this.nspRoomId}:${event}"`);

    const existingHandlers = this.eventRegistry.getHandlersForEvent(event);

    this.pushEventHandler(event, handler);

    if (!existingHandlers) {
      logger.logInfo(`Syncing event "${this.nspRoomId}:${event}"`);

      const data = { roomId: this.roomId, event };

      try {
        await this.socketManager.emitWithAck<string>(ClientEvent.ROOM_SUBSCRIPTION_BIND, data);
        return this;
      } catch (err: any) {
        this.removeEventHandler(event, handler);
        logger.logError(err.message);
        throw new Error(err.message);
      }
    }

    return this;
  }

  async unsubscribe(
    eventOrHandler?: string | SocketEventHandler,
    eventHandler?: SocketEventHandler
  ): Promise<this> {
    const { event, handler } = this.getEventAndHandler(eventOrHandler, eventHandler);

    logger.logInfo(`Unbinding handler ${this.nspRoomId}:${event}`);

    if (!event) {
      await this.clearAllSync();
      return this;
    }

    const existingHandlers = this.eventRegistry.getHandlersForEvent(event);

    if (!existingHandlers) {
      return this;
    }

    if (handler) {
      this.removeEventHandler(event, handler);
    }

    if (!handler || !existingHandlers.size) {
      await this.unbindAllSync(event, handler);
    }

    return this;
  }

  private async clearAllSync(): Promise<void> {
    logger.logInfo(`Unbinding all handlers, syncing ${this.nspRoomId}`);

    const data = { roomId: this.roomId };

    try {
      this.clearEventHandlers();
      await this.socketManager.emitWithAck<string>(ClientEvent.ROOM_SUBSCRIPTION_UNBIND, data);
    } catch (err: any) {
      logger.logError(err.message);
      throw new Error(err.message);
    }
  }

  private async unbindAllSync(event: string, handler?: SocketEventHandler): Promise<void> {
    logger.logInfo(`All handlers unbound, syncing ${this.nspRoomId}:${event}`);

    const data = { roomId: this.roomId, event };

    try {
      this.unbindAll(event);
      await this.socketManager.emitWithAck<string>(ClientEvent.ROOM_SUBSCRIPTION_UNBIND, data);
    } catch (err: any) {
      if (handler) {
        this.pushEventHandler(event, handler);
      }

      logger.logError(err.message);
      throw new Error(err.message);
    }
  }

  async publish<T>(event: string, userData: T): Promise<any> {
    validateUserData(userData);

    const data = {
      roomId: this.roomId,
      event,
      data: userData
    };

    try {
      const messageData = await this.socketManager.emitWithAck<T>(ClientEvent.PUBLISH, data);
      return messageData;
    } catch (err: any) {
      logger.logError(err.message);
      throw new Error(err.message);
    }
  }

  async leave(): Promise<void> {
    const data = { roomId: this.roomId };

    try {
      const nspRoomId = await this.socketManager.emitWithAck<string>(ClientEvent.ROOM_LEAVE, data);

      await this.presence?.unsubscribe();
      await this.metrics?.unsubscribe();

      this.clearEventHandlers();

      logger.logInfo(`Left room: ${nspRoomId}`);
    } catch (err: any) {
      logger.logError(err.message);
      throw new Error(err.message);
    }
  }

  disconnect() {
    this.socketManager.disconnectSocket();
  }

  connect() {
    this.socketManager.connectSocket();
  }

  private pushEventHandler(event: string, handler: SocketEventHandler): void {
    const subscription = this.getSubscriptionName(event);

    logger.logInfo(`Pushing event handler to ${subscription}`);

    this.eventRegistry.attachHandler(event, handler);
    this.socketManager?.on(subscription, handler);
  }

  private removeEventHandler(event: string, handler: SocketEventHandler): void {
    const subscription = this.getSubscriptionName(event);

    logger.logInfo(`Removing event handler from ${subscription}`);

    const refCount = this.eventRegistry.detachHandlers(event, handler);

    if (refCount > 0) {
      for (let i = refCount; i > 0; i--) {
        this.socketManager?.off(subscription, handler);
      }
    }
  }

  private clearEventHandlers(): void {
    logger.logInfo(`Removing all handler refs map - ${this.nspRoomId}`);

    this.eventRegistry.getAllHandlers()?.forEach((_, event) => {
      this.unbindAll(event);
    });

    this.eventRegistry.clearHandlers();
  }

  private unbindAll(event: string): void {
    const subscription = this.getSubscriptionName(event);

    logger.logInfo(`Unbinding all listeners - ${subscription}`);

    this.socketManager.off(subscription);
    this.eventRegistry.deleteHandler(event);
  }

  private getSubscriptionName(event: string): string {
    return `${this.nspRoomId}::${event}`;
  }
}
