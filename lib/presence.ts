import { ClientEvent } from './types/event.types';
import { SocketEventHandler } from './types/socket.types';
import { logger } from './logger';
import { validateUserData } from './validation';
import { EventRegistry } from './event-registry';
import { ValidationError } from './errors';
import { SocketManager } from './socket-manager';
import { PresenceEvent, PresenceEventType } from './types/presence.types';

const USER_DATA_MAX_SIZE_KB = 1024;
const SUBSCRIPTION_NAMESPACE = 'presence';
const PLATFORM_RESERVED_NAMESPACE = '$';

enum DsPresenceEventAllowedValue {
  JOIN = 'join',
  LEAVE = 'leave',
  UPDATE = 'update'
}

export class Presence {
  private readonly socketManager: SocketManager;
  private readonly roomId: string;
  private readonly nspRoomId: string;
  private readonly eventRegistry = new EventRegistry();

  constructor(socketManager: SocketManager, roomId: string, nspRoomId: string) {
    this.socketManager = socketManager;
    this.roomId = roomId;
    this.nspRoomId = nspRoomId;
  }

  async subscribe(
    eventOrHandler: PresenceEventType | SocketEventHandler,
    handler?: SocketEventHandler
  ): Promise<void> {
    this.validateEvent(eventOrHandler);
    const { events, eventHandler } = this.prepareSubscription(eventOrHandler, handler);
    await this.execSubscription(events, eventHandler);
  }

  async unsubscribe(event?: PresenceEventType, handler?: SocketEventHandler): Promise<void> {
    if (event) {
      return this.unsubscribeEvent(event, handler);
    }

    return this.unsubscribeAllEvents();
  }

  private prepareSubscription(
    eventOrHandler: PresenceEventType | SocketEventHandler,
    handler?: SocketEventHandler
  ): { events: PresenceEventType[]; eventHandler: SocketEventHandler } {
    const events =
      typeof eventOrHandler === 'function'
        ? Object.values(DsPresenceEventAllowedValue)
        : [eventOrHandler];

    const eventHandler = handler || <SocketEventHandler>eventOrHandler;

    return { events, eventHandler };
  }

  private async execSubscription(
    events: PresenceEventType[],
    handler: SocketEventHandler
  ): Promise<void> {
    try {
      await Promise.all(events.map((event) => this.subscribeEvent(event, handler)));
      handler();
    } catch (err: any) {
      const message = `Error subscribing to presence events: "${events}"`;
      logger.logError(message, err);
      throw new Error(message);
    }
  }

  private async subscribeEvent(
    event: PresenceEventType,
    handler: SocketEventHandler
  ): Promise<void> {
    logger.logInfo(`Binding handler "${this.nspRoomId}:${event}"`);

    const eventState = this.eventRegistry.getHandlersForEvent(event);

    this.pushEventHandler(event, handler);

    if (!eventState) {
      logger.logInfo(`Syncing event "${this.nspRoomId}:${event}"`);

      const data = { roomId: this.roomId, event };

      try {
        await this.socketManager.emitWithAck<string>(ClientEvent.ROOM_PRESENCE_SUBSCRIBE, data);
      } catch (err: any) {
        this.removeEventHandler(event, handler);
        logger.logError(err.message);
        throw new Error(err.message);
      }
    }
  }

  private async unsubscribeEvent(
    event: PresenceEventType,
    handler?: SocketEventHandler
  ): Promise<void> {
    logger.logInfo(`Unbinding handler ${this.nspRoomId}:${event}`);

    const existingHandler = this.eventRegistry.getHandlersForEvent(event);

    if (!existingHandler) {
      throw new ValidationError(`Client is not subscribed to ${event}`);
    }

    if (handler) {
      this.removeEventHandler(event, handler);
    }

    if (!handler || !existingHandler.size) {
      logger.logInfo(`All handers unbound, syncing ${this.nspRoomId}:${event}`);

      const data = { roomId: this.roomId, event };

      try {
        await this.socketManager.emitWithAck<string>(ClientEvent.ROOM_PRESENCE_UNSUBSCRIBE, data);
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
    logger.logInfo(`Unbinding all event ${this.nspRoomId}`);

    const existingHandlers = this.eventRegistry.getAllHandlers();

    if (!existingHandlers?.size) {
      return;
    }

    const data = { roomId: this.roomId };

    try {
      await this.socketManager.emitWithAck(ClientEvent.ROOM_PRESENCE_UNSUBSCRIBE_ALL, data);

      this.clearEventHandlers();

      logger.logInfo(`Successfully removed all presence subscriptions - ${this.nspRoomId}`);
    } catch (err: any) {
      const message = `Error unsubscribing from all presence events - ${this.nspRoomId}`;
      logger.logError(message, err);
      throw new Error(message);
    }
  }

  async join(userData?: any): Promise<void> {
    validateUserData(userData, USER_DATA_MAX_SIZE_KB);

    const data = { roomId: this.roomId, userData };

    try {
      const res = await this.socketManager.emitWithAck(ClientEvent.ROOM_PRESENCE_JOIN, data);
      logger.logInfo(`Successfully joined room: "${res}"`);
    } catch (err: any) {
      const message = `Error joining room "${this.roomId}"`;
      logger.logError(message, err);
      throw new Error(message);
    }
  }

  async leave(userData?: any): Promise<void> {
    const data = { roomId: this.roomId, userData };

    try {
      const res = await this.socketManager.emitWithAck(ClientEvent.ROOM_PRESENCE_LEAVE, data);
      logger.logInfo(`Successfully left room: "${res}"`);
    } catch (err: any) {
      const message = `Error leaving room "${this.roomId}"`;
      logger.logError(message, err);
      throw new Error(message);
    }
  }

  async update<T>(userData?: T): Promise<void> {
    const data = { roomId: this.roomId, userData };

    try {
      const res = await this.socketManager.emitWithAck(ClientEvent.ROOM_PRESENCE_UPDATE, data);
      logger.logInfo(`Successfully updated room: "${res}"`);
    } catch (err: any) {
      const message = `Error updating room "${this.roomId}"`;
      logger.logError(message, err);
      throw new Error(err.message);
    }
  }

  async get<T>(): Promise<PresenceEvent<T>[]> {
    const data = { roomId: this.roomId };

    try {
      const res = await this.socketManager.emitWithAck<PresenceEvent<T>[]>(
        ClientEvent.ROOM_PRESENCE_GET,
        data
      );

      logger.logInfo(`Successfully fetched room presence: "${this.nspRoomId}"`);

      return res;
    } catch (err: any) {
      const message = `Error getting presence for "${this.nspRoomId}"`;
      logger.logError(message, err);
      throw new Error(message);
    }
  }

  async getCount(): Promise<number> {
    const data = { roomId: this.roomId };

    try {
      const count: number = await this.socketManager.emitWithAck(
        ClientEvent.ROOM_PRESENCE_COUNT,
        data
      );

      logger.logInfo(`Fetched room presence count: "${this.nspRoomId}", ${count} present`);

      return count;
    } catch (err: any) {
      const message = `Error getting presence count for "${this.nspRoomId}"`;
      logger.logError(message, err);
      throw new Error(message);
    }
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
    } else {
      throw new ValidationError(`Defined handler is not attached the ${event} event`);
    }
  }

  private unbindAll(event: string): void {
    const subscription = this.getSubscriptionName(event);

    logger.logInfo(`Unbinding all listeners ${subscription}`);

    this.socketManager.off(subscription);
    this.eventRegistry.deleteHandler(event);
  }

  private clearEventHandlers(): void {
    logger.logInfo(`Removing all handler refs map - ${this.nspRoomId}`);

    this.eventRegistry.getAllHandlers()?.forEach((_, event) => {
      this.unbindAll(event);
    });

    this.eventRegistry.clearHandlers();
  }

  private getSubscriptionName(event: string): string {
    return `${this.nspRoomId}:${PLATFORM_RESERVED_NAMESPACE}:${SUBSCRIPTION_NAMESPACE}:${event}`;
  }

  private validateEvent(eventOrHandler: PresenceEventType | SocketEventHandler) {
    if (typeof eventOrHandler === 'function') {
      return true;
    }

    const allowedValues = ['join', 'leave', 'update'];

    if (!allowedValues.includes(eventOrHandler)) {
      throw new ValidationError('Event must be of type "join", "leave" or "update');
    }
  }
}
