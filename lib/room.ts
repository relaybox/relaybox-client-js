import { ClientEvent } from './types/event.types';
import { SocketEventHandler } from './types/socket.types';
import { Presence } from './presence';
import { logger } from './logger';
import { HistoryFactory, MetricsFactory, PresenceFactory } from './factory';
import { validateUserData } from './validation';
import { Metrics } from './metrics';
import { History } from './history';
import { EventRegistry } from './event-registry';
import { SocketManager } from './socket-manager';
import RelayBox from './relaybox';
import { TokenResponse } from './types';

/**
 * The Room class represents a room in a chat or messaging application.
 * It handles event subscriptions, presence management, and communication with the server.
 */
export class Room {
  private readonly socketManager: SocketManager;
  private readonly presenceFactory: PresenceFactory;
  private readonly metricsFactory: MetricsFactory;
  private readonly historyFactory: HistoryFactory;
  private readonly eventRegistry = new EventRegistry();
  private readonly httpServiceUrl: string;
  private nspRoomId: string | null = null;
  private getAuthToken: () => string | null;

  public readonly id: string;
  public readonly roomId: string;
  public presence: Presence | null = null;
  public metrics: Metrics | null = null;
  public history: History | null = null;

  /**
   * Creates an instance of Room.
   * @param {string} roomId - The ID of the room.
   * @param {SocketManager} socketManager - The socket manager for handling socket connections.
   * @param {PresenceFactory} presencefactory - The factory for creating presence instances.
   * @param {MetricsFactory} metricsFactory - The factory for creating metrics instances.
   * @param {HistoryFactory} historyFactory - The factory for creating history instances.
   */
  constructor(
    roomId: string,
    socketManager: SocketManager,
    presencefactory: PresenceFactory,
    metricsFactory: MetricsFactory,
    historyFactory: HistoryFactory,
    httpServiceUrl: string,
    getAuthToken: () => string | null
  ) {
    this.roomId = this.id = roomId;
    this.socketManager = socketManager;
    this.presenceFactory = presencefactory;
    this.metricsFactory = metricsFactory;
    this.historyFactory = historyFactory;
    this.httpServiceUrl = httpServiceUrl;
    this.getAuthToken = getAuthToken;
  }

  /**
   * Creates and joins the room, initializing presence and metrics.
   * @returns {Promise<Room>} The created room instance.
   * @throws Will throw an error if the room creation or joining fails.
   */
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
      this.history = this.historyFactory.createHistory(
        this.socketManager,
        this.nspRoomId,
        this.roomId,
        this.httpServiceUrl,
        this.getAuthToken
      );

      return this;
    } catch (err: any) {
      logger.logError(err.message, err);
      throw new Error(err.message);
    }
  }

  /**
   * Retrieves the event name and handler based on the provided parameters.
   * @param {string | SocketEventHandler} [eventOrHandler] - The event name or handler function.
   * @param {SocketEventHandler} [eventHandler] - The event handler function.
   * @returns {{ event: string | undefined; handler: SocketEventHandler }} The event name and handler.
   */
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

  /**
   * Subscribes to an event with the given handler.
   * @param {string | SocketEventHandler} eventOrHandler - The event name or handler function.
   * @param {SocketEventHandler} [eventHandler] - The event handler function.
   * @returns {Promise<this>} The Room instance.
   * @throws Will throw an error if no event or handler is provided.
   */
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

  /**
   * Unsubscribes from an event, removing the handler if provided.
   * @param {string | SocketEventHandler} [eventOrHandler] - The event name or handler function.
   * @param {SocketEventHandler} [eventHandler] - The event handler function.
   * @returns {Promise<this>} The Room instance.
   */
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

  /**
   * Clears all event handlers and syncs the unbinding with the server.
   * @returns {Promise<void>}
   * @throws Will throw an error if the unbinding fails.
   */
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

  /**
   * Unbinds all handlers for a specific event and syncs the unbinding with the server.
   * @param {string} event - The event name to unbind.
   * @param {SocketEventHandler} [handler] - The handler to remove.
   * @returns {Promise<void>}
   * @throws Will throw an error if the unbinding fails.
   */
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

  /**
   * Publishes an event with user data to the room.
   * @template T
   * @param {string} event - The event name.
   * @param {T} userData - The data to send with the event.
   * @returns {Promise<any>} The server's response to the published event.
   * @throws Will throw an error if the publication fails.
   */
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

  /**
   * Leaves the room, unsubscribing from presence and metrics, and clearing event handlers.
   * @returns {Promise<void>}
   * @throws Will throw an error if the leave operation fails.
   */
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

  /**
   * Disconnects the socket manager from the server.
   */
  disconnect() {
    this.socketManager.disconnectSocket();
  }

  /**
   * Connects the socket manager to the server.
   */
  connect() {
    this.socketManager.connectSocket();
  }

  /**
   * Adds an event handler for a specific event and binds it to the socket manager.
   * @param {string} event - The event name.
   * @param {SocketEventHandler} handler - The handler function.
   */
  private pushEventHandler(event: string, handler: SocketEventHandler): void {
    const subscription = this.getSubscriptionName(event);

    logger.logInfo(`Pushing event handler to ${subscription}`);

    this.eventRegistry.attachHandler(event, handler);
    this.socketManager?.on(subscription, handler);
  }

  /**
   * Removes an event handler for a specific event and unbinds it from the socket manager.
   * @param {string} event - The event name.
   * @param {SocketEventHandler} handler - The handler function.
   */
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

  /**
   * Clears all event handlers for the room.
   */
  private clearEventHandlers(): void {
    logger.logInfo(`Removing all handler refs map - ${this.nspRoomId}`);

    this.eventRegistry.getAllHandlers()?.forEach((_, event) => {
      this.unbindAll(event);
    });

    this.eventRegistry.clearHandlers();
  }

  /**
   * Unbinds all event handlers for a specific event from the socket manager.
   * @param {string} event - The event name.
   */
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
