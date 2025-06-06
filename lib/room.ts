import { ClientEvent } from './types/event.types';
import { SocketEventAndHandler, SocketEventHandler } from './types/socket.types';
import { Presence } from './presence';
import { logger } from './logger';
import { HistoryFactory, MetricsFactory, PresenceFactory } from './factory';
import { validateUserData } from './validation';
import { Metrics } from './metrics';
import { History } from './history';
import { EventRegistry } from './event-registry';
import { SocketManager } from './socket-manager';
import { Intellect } from './intellect';
import { CloudStorage } from './cloud-storage';
import {
  RoomJoinOptions,
  RoomJoinResponse,
  RoomMember,
  RoomMemberType,
  RoomPublishOptions,
  RoomVisibility
} from './types/room.types';
import { HttpMethod, HttpMode, PaginatedRequestOptions, PaginatedResponse } from './types';
import { defaultHeaders, serviceRequest } from './request';

/**
 * Convenience interface for room members actions
 */
interface MemberActions {
  /**
   * Get paginated list of members.
   * @param {PaginatedRequestOptions} opts The clientId of the member to add
   * @example
   * await room.members.get({ offset: 0, limit: 10 })
   */
  get: (opts?: PaginatedRequestOptions) => Promise<PaginatedResponse<RoomMember>>;
  /**
   * Add member to private room. Private rooms only.
   * @param {string} clientId The clientId of the member to add
   */
  add: (clientId: string) => Promise<void>;
  /**
   * Remove member from private room. Private rooms only.
   * @param clientId The clientId of the member to delete
   */
  remove: (clientId: string) => Promise<void>;
  /**
   * Set member type for client id.
   * @param clientId The clientId of the member to delete
   * @param memberType The member type to set for this user
   */
  setMemberType: (clientId: string, memberType: RoomMemberType) => Promise<void>;
}

/**
 * The Room class represents a room in a chat or messaging application.
 * It handles event subscriptions, presence management, and communication with the server.
 */
export class Room {
  /**
   * Internal system room identifier in uuid format
   * Set by database at room creation
   */
  private uuid: string | null = null;
  /**
   * Namespaced room id for internal use only
   */
  private nspRoomId: string | null = null;
  /**
   * Pubic room id set at room creation
   * Human readable room id
   */
  public readonly id: string;
  /**
   * Pubic room id set at room creation
   * Human readable room id
   * Same as id, for simple reference requirements
   */
  public readonly roomId: string;
  /**
   * Human readable room name to be included as room metadata
   */
  public roomName: string | null = null;
  /**
   * Event registry for handling events and subscriptions
   */
  private readonly eventRegistry = new EventRegistry();
  /**
   * Room options
   */
  public visibility: RoomVisibility | null = null;
  public memberType: RoomMemberType | null = null;
  /**
   * Room extensions
   */
  public presence!: Presence;
  public metrics!: Metrics;
  public history!: History;
  public intellect!: Intellect;
  public storage!: CloudStorage;

  /**
   * Creates an instance of Room.
   * @param {string} roomId - The ID of the room.
   * @param {SocketManager} socketManager - The socket manager for handling socket connections.
   * @param {PresenceFactory} presenceFactory - The factory for creating presence instances.
   * @param {MetricsFactory} metricsFactory - The factory for creating metrics instances.
   * @param {HistoryFactory} historyFactory - The factory for creating history instances.
   * @param {string} httpServiceUrl - The url for interacting with the core HTTP service.
   * @param {string} stateServiceUrl - The url for interacting with the "storage" service.
   * @param {Function} getAuthToken - Function to retrieve the latest auth token.
   */
  constructor(
    roomId: string,
    private readonly socketManager: SocketManager,
    private readonly presenceFactory: PresenceFactory,
    private readonly metricsFactory: MetricsFactory,
    private readonly historyFactory: HistoryFactory,
    private readonly httpServiceUrl: string,
    private readonly stateServiceUrl: string,
    private getAuthToken: () => string | null
  ) {
    this.roomId = this.id = roomId;
  }

  /**
   * Creates and joins the room, initializing room and event extensions.
   * @returns {Promise<Room>} The created room instance.
   * @throws Will throw an error if the room creation or joining fails.
   */
  async create(opts?: RoomJoinOptions): Promise<Room> {
    logger.logInfo(`Creating room "${this.roomId}"`);

    const data = {
      roomId: this.roomId,
      ...opts
    };

    try {
      const { uuid, nspRoomId, roomName, visibility, memberType } =
        await this.socketManager.emitWithAck<RoomJoinResponse>(ClientEvent.ROOM_JOIN, data);

      logger.logInfo(`Successfully joined room "${nspRoomId}"`);

      this.uuid = uuid;
      this.nspRoomId = nspRoomId;
      this.roomName = roomName;
      this.visibility = visibility as RoomVisibility;
      this.memberType = memberType as RoomMemberType;

      return this.initRoomExtensions();
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }

  /**
   * TODO: Clean this up by passing room instance to each extension rather than named vars
   */
  private initRoomExtensions(): Room {
    const { nspRoomId, socketManager, roomId, httpServiceUrl, stateServiceUrl, getAuthToken } =
      this;

    this.presence = this.presenceFactory.createInstance(socketManager, roomId, nspRoomId!);
    this.metrics = this.metricsFactory.createInstance(socketManager, roomId);
    this.history = this.historyFactory.createInstance(
      roomId,
      httpServiceUrl,
      stateServiceUrl,
      getAuthToken
    );

    return this;
  }

  /**
   * Retrieves the event name and handler based on the provided parameters.
   * If first argument is a function, it is assumed to be the event handler and subscribe to all events.
   * @param {string | SocketEventHandler} [eventOrHandler] - The event name or handler function.
   * @param {SocketEventHandler} [eventHandler] - The event handler function.
   * @returns {SocketEventAndHandler} The event name and handler.
   */
  getEventAndHandler(
    eventOrHandler?: string | SocketEventHandler,
    eventHandler?: SocketEventHandler
  ): SocketEventAndHandler {
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

    const data = {
      roomId: this.roomId,
      event
    };

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
  async publish<T>(event: string, userData: T, opts?: RoomPublishOptions): Promise<any> {
    validateUserData(userData);

    const data = {
      uuid: this.uuid,
      roomId: this.roomId,
      event,
      data: userData,
      opts
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
      // TODO: UNSUBSCRIBE FROM INTELLECT

      this.clearEventHandlers();

      logger.logInfo(`Left room: ${nspRoomId}`);
    } catch (err: any) {
      logger.logError(err.message);
      throw new Error(err.message);
    }
  }

  /**
   * Updates protected room password. Operation is only allowed for protected rooms
   * @param password The new password for the room
   */
  async updatePassword(password: string): Promise<void> {
    if (this.visibility !== 'protected') {
      throw new Error(
        `Room visibility must be protected to update password, currently ${this.visibility}`
      );
    }

    const data = {
      roomId: this.roomId,
      password
    };

    try {
      await this.socketManager.emitWithAck(ClientEvent.ROOM_PASSWORD_UPDATE, data);
    } catch (err: any) {
      logger.logError(err.message);
      throw new Error(err.message);
    }
  }

  /**
   * Get room members as a paginated list
   * @param {PaginatedRequestOptions} opts The clientId of the member to add
   */
  private async getMembers({ offset = 0, limit = 10 }: PaginatedRequestOptions = {}): Promise<
    PaginatedResponse<RoomMember>
  > {
    try {
      const authToken = this.getAuthToken();

      if (!authToken) {
        throw new Error('No auth token found');
      }

      const requestParams: RequestInit = {
        method: HttpMethod.GET,
        mode: HttpMode.CORS,
        headers: {
          ...defaultHeaders,
          Authorization: `Bearer ${authToken}`
        }
      };

      const queryParams = {
        offset: offset.toString(),
        limit: limit.toString()
      };

      const queryString = new URLSearchParams(queryParams).toString();
      const requestUrl = `${this.stateServiceUrl}/rooms/${this.roomId}/members?${queryString}`;
      const response = await serviceRequest<any>(requestUrl, requestParams);

      return response;
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }

  /**
   * Add member to private room.
   * This operation is only allowed for private rooms
   * @param clientId The clientId of the member to add
   */
  private async addMember(clientId: string): Promise<void> {
    if (!clientId) {
      throw new Error('No clientId provided');
    }

    const data = {
      roomId: this.roomId,
      clientId
    };

    try {
      await this.socketManager.emitWithAck(ClientEvent.ROOM_MEMBER_ADD, data);
    } catch (err: any) {
      logger.logError(err.message);
      throw new Error(err.message);
    }
  }

  /**
   * Remove member from room.
   * This operation will soft delete the member from the room blocking access
   * @param clientId The clientId of the member to delete
   */
  private async removeMember(clientId: string): Promise<void> {
    if (!clientId) {
      throw new Error('No clientId provided');
    }

    const data = {
      roomId: this.roomId,
      clientId
    };

    try {
      await this.socketManager.emitWithAck(ClientEvent.ROOM_MEMBER_REMOVE, data);
    } catch (err: any) {
      logger.logError(err.message);
      throw new Error(err.message);
    }
  }

  /**
   * Set room member type.
   * This operation will change the member type for the user
   * @param clientId The clientId of the member to delete
   * @param memberType The member type to set for this user
   */
  private async setMemberType(clientId: string, memberType: RoomMemberType): Promise<void> {
    if (!clientId || !memberType) {
      throw new Error('No clientId or memberType provided');
    }

    const data = {
      roomId: this.roomId,
      clientId,
      memberType
    };

    try {
      await this.socketManager.emitWithAck(ClientEvent.ROOM_MEMBER_TYPE, data);
    } catch (err: any) {
      logger.logError(err.message);
      throw new Error(err.message);
    }
  }

  /**
   * Member actions helper
   * Convenience interface for room members actions
   */
  readonly members: MemberActions = {
    get: this.getMembers.bind(this),
    add: this.addMember.bind(this),
    remove: this.removeMember.bind(this),
    setMemberType: this.setMemberType.bind(this)
  };

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

  /**
   * Set room visibility
   * @param {string} visibility The new visibility for the room
   * @param {string} password Optional, the new password for the room (protected rooms only)
   */
  async setVisibility(visibility: RoomVisibility, password?: string): Promise<any> {
    logger.logInfo(`Saving room visibility ${this.roomId}`);

    try {
      const authToken = this.getAuthToken();

      if (!authToken) {
        throw new Error('No auth token found');
      }

      const requestBody = {
        visibility,
        password
      };

      const requestParams: RequestInit = {
        method: HttpMethod.PUT,
        mode: HttpMode.CORS,
        body: JSON.stringify(requestBody),
        headers: {
          ...defaultHeaders,
          Authorization: `Bearer ${authToken}`
        }
      };

      const requestUrl = `${this.stateServiceUrl}/rooms/${this.roomId}/visibility`;
      const response = await serviceRequest<any>(requestUrl, requestParams);

      this.visibility = response.visibility;

      return response;
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }
}
