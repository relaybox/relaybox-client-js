import EventEmitter from 'eventemitter3';
import { ClientEvent } from './types/event.types';
import { SocketEventHandler } from './types/socket.types';
import { logger } from './logger';
import { validateUserData } from './validation';
import { EventRegistry } from './event-registry';
import { ValidationError } from './errors';
import { SocketManager } from './socket-manager';
import {
  PresenceEvent,
  PresenceEventAllowedValue,
  PresenceEventType,
  PresenceGetOptions
} from './types/presence.types';

const USER_DATA_MAX_SIZE_KB = 1024;
const SUBSCRIPTION_NAMESPACE = 'presence';
const PLATFORM_RESERVED_NAMESPACE = '$';

/**
 * The Presence class manages presence-related events such as joining, leaving, and updating
 * user presence in a specific room.
 */
export class Presence extends EventEmitter {
  private readonly eventRegistry = new EventRegistry();

  /**
   * Creates an instance of Presence.
   * @param {SocketManager} socketManager - The socket manager to handle socket connections.
   * @param {string} roomId - The ID of the room for which presence is being managed.
   * @param {string} nspRoomId - The namespaced room ID used for event subscriptions.
   */
  constructor(
    private readonly socketManager: SocketManager,
    private readonly roomId: string,
    private readonly nspRoomId: string
  ) {
    super();
  }

  /**
   * Subscribes to presence events for the room.
   * @param {PresenceEventType | SocketEventHandler} eventOrHandler - The event type or handler function.
   * @param {SocketEventHandler} [handler] - The event handler function.
   * @returns {Promise<void>}
   * @throws Will throw an error if the subscription fails.
   */
  async subscribe(
    eventOrHandler: PresenceEventType | SocketEventHandler,
    handler?: SocketEventHandler
  ): Promise<void> {
    this.validateEvent(eventOrHandler);

    const { events, eventHandler } = this.prepareSubscription(eventOrHandler, handler);

    await this.execSubscription(events, eventHandler);
  }

  /**
   * Unsubscribes from presence events for the room.
   * @param {PresenceEventType} [event] - The event type to unsubscribe from.
   * @param {SocketEventHandler} [handler] - The handler function to remove.
   * @returns {Promise<void>}
   * @throws Will throw an error if unsubscribing fails.
   */
  async unsubscribe(event?: PresenceEventType, handler?: SocketEventHandler): Promise<void> {
    if (event) {
      return this.unsubscribeEvent(event, handler);
    }

    return this.unsubscribeAllEvents();
  }

  /**
   * Prepares the subscription process by determining the events and handler.
   * @private
   * @param {PresenceEventType | SocketEventHandler} eventOrHandler - The event type or handler function.
   * @param {SocketEventHandler} [handler] - The event handler function.
   * @returns {{ events: PresenceEventType[]; eventHandler: SocketEventHandler }} The events and event handler.
   */
  private prepareSubscription(
    eventOrHandler: PresenceEventType | SocketEventHandler,
    handler?: SocketEventHandler
  ): { events: PresenceEventType[]; eventHandler: SocketEventHandler } {
    const events =
      typeof eventOrHandler === 'function'
        ? Object.values(PresenceEventAllowedValue)
        : [eventOrHandler];

    const eventHandler = handler || <SocketEventHandler>eventOrHandler;

    return { events, eventHandler };
  }

  /**
   * Executes the subscription for the provided events and handler.
   * @private
   * @param {PresenceEventType[]} events - The events to subscribe to.
   * @param {SocketEventHandler} handler - The event handler function.
   * @returns {Promise<void>}
   * @throws Will throw an error if subscription fails.
   */
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

  /**
   * Subscribes to a specific presence event with the provided handler.
   * @private
   * @param {PresenceEventType} event - The event to subscribe to.
   * @param {SocketEventHandler} handler - The event handler function.
   * @returns {Promise<void>}
   * @throws Will throw an error if subscription fails.
   */
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

  /**
   * Unsubscribes from a specific presence event, optionally removing a handler.
   * @private
   * @param {PresenceEventType} event - The event to unsubscribe from.
   * @param {SocketEventHandler} [handler] - The handler function to remove.
   * @returns {Promise<void>}
   * @throws Will throw an error if the unsubscription fails.
   */
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

  /**
   * Unsubscribes from all presence events in the room.
   * @private
   * @returns {Promise<void>}
   * @throws Will throw an error if the unsubscription fails.
   */
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

  /**
   * Joins the room with optional user data.
   * @param {any} [userData] - The user data to send when joining.
   * @returns {Promise<void>}
   * @throws Will throw an error if joining the room fails.
   */
  async join(userData?: any): Promise<void> {
    if (userData) {
      validateUserData(userData, USER_DATA_MAX_SIZE_KB);
    }

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

  /**
   * Leaves the room with optional user data.
   * @param {any} [userData] - The user data to send when leaving.
   * @returns {Promise<void>}
   * @throws Will throw an error if leaving the room fails.
   */
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

  /**
   * Updates the user's presence in the room with the provided data.
   * @template T
   * @param {T} [userData] - The user data to update.
   * @returns {Promise<void>}
   * @throws Will throw an error if updating presence fails.
   */
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

  /**
   * Retrieves the current presence set for the room.
   * @template T
   * @returns {Promise<PresenceEvent<T>[]>} A promise that resolves to an array of presence members.
   * @throws Will throw an error if fetching presence events fails.
   */
  async get<T>(opts: PresenceGetOptions = {}): Promise<PresenceEvent<T>[]> {
    const data = { roomId: this.roomId, ...opts };

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

  /**
   * Retrieves the count of members present in the room.
   * @returns {Promise<number>} A promise that resolves to the count of members present.
   * @throws Will throw an error if fetching the presence count fails.
   */
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

  /**
   * Adds an event handler for a specific event and binds it to the socket manager.
   * @private
   * @param {string} event - The event name.
   * @param {SocketEventHandler} handler - The handler function to bind.
   */
  private pushEventHandler(event: string, handler: SocketEventHandler): void {
    const subscription = this.getSubscriptionName(event);

    logger.logInfo(`Pushing event handler to ${subscription}`);

    this.eventRegistry.attachHandler(event, handler);
    this.socketManager?.on(subscription, handler);
  }

  filter(event: string, handler: SocketEventHandler): void {
    this.on(event, handler);
  }

  /**
   * Removes an event handler for a specific event and unbinds it from the socket manager.
   * @private
   * @param {string} event - The event name.
   * @param {SocketEventHandler} handler - The handler function to remove.
   * @throws {ValidationError} If the handler is not attached to the event.
   */
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

  /**
   * Unbinds all event handlers for a specific event from the socket manager.
   * @private
   * @param {string} event - The event name.
   */
  private unbindAll(event: string): void {
    const subscription = this.getSubscriptionName(event);

    logger.logInfo(`Unbinding all listeners ${subscription}`);

    this.socketManager.off(subscription);
    this.eventRegistry.deleteHandler(event);
  }

  /**
   * Clears all event handlers for the room.
   * @private
   */
  private clearEventHandlers(): void {
    logger.logInfo(`Removing all handler refs map - ${this.nspRoomId}`);

    this.eventRegistry.getAllHandlers()?.forEach((_, event) => {
      this.unbindAll(event);
    });

    this.eventRegistry.clearHandlers();
  }

  /**
   * Constructs the subscription name for a specific event in the room.
   * @private
   * @param {string} event - The event name.
   * @returns {string} The constructed subscription name.
   */
  private getSubscriptionName(event: string): string {
    return `${this.nspRoomId}:${PLATFORM_RESERVED_NAMESPACE}:${SUBSCRIPTION_NAMESPACE}:${event}`;
  }

  /**
   * Validates if the provided event is valid.
   * @private
   * @param {PresenceEventType | SocketEventHandler} eventOrHandler - The event type or handler function.
   * @throws {ValidationError} If the event type is invalid.
   */
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
