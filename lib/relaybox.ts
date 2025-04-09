/*
MIT License

Copyright (c) 2024 Relaybox Ltd

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
import EventEmitter from 'eventemitter3';
import { getAuthTokenResponse } from './authentication';
import { ClientEvent, ServerEvent } from './types/event.types';
import { OfflineOptions, RelayBoxOptions } from './types/relaybox.types';
import { Room } from './room';
import {
  SocketEvent,
  SocketEventHandler,
  SocketHandshake,
  SocketManagerListener
} from './types/socket.types';
import { logger } from './logger';
import { PresenceFactory, MetricsFactory, HistoryFactory } from './factory';
import { ErrorName, SocketConnectionError, TokenError, ValidationError } from './errors';
import { SocketManager } from './socket-manager';
import { AuthKeyData, AuthRequestOptions } from './types/auth.types';
import { HttpMethod, HttpMode, PaginatedResponse, TokenResponse } from './types/request.types';
import { Auth } from './auth';
import {
  defaultRoomJoinOptions,
  RoomAttachOptions,
  RoomCreateOptions,
  RoomEvent,
  RoomJoinOptions,
  RoomListOptions
} from './types/room.types';
import { serviceRequest } from './request';

const CORE_SERVICE_URL = process.env.CORE_SERVICE_URL || '';
const HTTP_SERVICE_URL = process.env.HTTP_SERVICE_URL || '';
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || '';
const STATE_SERVICE_URL = process.env.STATE_SERVICE_URL || '';
const SOCKET_CONNECTION_ACK_TIMEOUT_MS = 2000;
const AUTH_TOKEN_REFRESH_BUFFER_SECONDS = 20;
const AUTH_TOKEN_REFRESH_RETRY_MS = 10000;
const AUTH_TOKEN_REFRESH_JITTER_RANGE_MS = 2000;

/**
 * Offline defaults
 */
const DEFAULT_OFFLINE_AUTH_HOST = 'http://localhost';
const DEFAULT_OFFLINE_AUTH_PATH = 'auth';
const DEFAULT_OFFLINE_HTTP_HOST = 'http://localhost';
const DEFAULT_OFFLINE_HTTP_PATH = 'core';
const DEFAULT_OFFLINE_STATE_HOST = 'http://localhost';
const DEFAULT_OFFLINE_STATE_PATH = 'state';
const DEFAULT_OFFLINE_CORE_HOST = 'ws://localhost';
const DEFAULT_OFFLINE_CORE_PATH = 'core';
const DEFAULT_OFFLINE_PORT = 9000;

/**
 * API pathnames
 */
const ROOM_SERVICE_PATHNAME = 'rooms';

/**
 * Convenience interface for room members actions
 */
interface RoomActions {
  /**
   * Create a room with predefined options.
   * @param roomId The ID of the room to create.
   * @param opts Room create options, see RoomOptions.
   */
  create: (roomId: string, opts?: RoomCreateOptions) => Promise<RoomAttachOptions>;
  /**
   * Joins a room, creating it if it doesn't exist.
   * @param {string} roomId - The ID of the room to join.
   * @param opts Room join options, see RoomJoinOptions.
   * @throws Will throw an error if room creation fails.
   */
  join: (roomId: string, opts?: RoomJoinOptions) => Promise<Room>;
  /**
   * List rooms available to the user
   */
  list: (opts?: RoomListOptions) => Promise<PaginatedResponse<Room>>;
}

/**
 * RelayBox manages the connection and communication with a remote server
 * via WebSocket, handling authentication and socket events.
 */
export default class RelayBox extends EventEmitter {
  private readonly socketManager: SocketManager;
  private readonly presenceFactory: PresenceFactory;
  private readonly metricsFactory: MetricsFactory;
  private readonly historyFactory: HistoryFactory;
  private readonly authEndpoint?: string;
  private readonly authHeaders?: Record<string, unknown> | null;
  private readonly authParams?: Record<string, unknown> | null;
  private readonly authRequestOptions?: AuthRequestOptions;
  private readonly authAction?: (params?: any) => Promise<TokenResponse | undefined>;
  private readonly apiKey?: string;
  private readonly publicKey?: string;
  private readonly authServiceUrl: string;
  private readonly coreServiceUrl: string;
  private readonly httpServiceUrl: string;
  private readonly stateServiceUrl: string;
  private socketManagerListeners: SocketManagerListener[] = [];
  private refreshTimeout: NodeJS.Timeout | number | null = null;
  private tokenResponse: TokenResponse | null = null;

  public readonly connection: EventEmitter;
  public clientId?: string | number;
  public connectionId: string | null = null;
  public auth: Auth;
  public isConnected: boolean;

  /**
   * Rooms actions helper
   */
  readonly rooms: RoomActions = {
    create: this.create.bind(this),
    list: this.list.bind(this),
    join: this.join.bind(this)
  };

  /**
   * Creates an instance of RelayBox.
   * @param {RelayBoxOptions} opts - The options for configuring the RelayBox instance.
   * @throws {ValidationError} If neither `authEndpoint` nor `apiKey` is provided.
   */
  constructor(opts: RelayBoxOptions) {
    super();

    if (!opts.apiKey && !opts.authEndpoint && !opts.authAction && !opts.publicKey) {
      throw new ValidationError(
        `Please provide either "authEndpoint", "apiKey", "authAction" or "publicKey"`
      );
    }

    const { authServiceUrl, coreServiceUrl, httpServiceUrl, stateServiceUrl } =
      this.getOfflineServiceUrls(opts.offline);

    this.apiKey = opts.apiKey;
    this.publicKey = opts.publicKey;
    this.clientId = opts.clientId;
    this.authEndpoint = opts.authEndpoint;
    this.authAction = opts.authAction;
    this.authServiceUrl = authServiceUrl || AUTH_SERVICE_URL;
    this.coreServiceUrl = coreServiceUrl || CORE_SERVICE_URL;
    this.httpServiceUrl = httpServiceUrl || HTTP_SERVICE_URL;
    this.stateServiceUrl = stateServiceUrl || STATE_SERVICE_URL;
    this.socketManager = new SocketManager(this.coreServiceUrl);
    this.presenceFactory = new PresenceFactory();
    this.metricsFactory = new MetricsFactory();
    this.historyFactory = new HistoryFactory();
    this.connection = new EventEmitter();
    this.authHeaders =
      typeof opts.authHeaders === 'function' ? opts.authHeaders() : opts.authHeaders;
    this.authParams = typeof opts.authParams === 'function' ? opts.authParams() : opts.authParams;
    this.authRequestOptions = opts.authRequestOptions;
    this.isConnected = false;

    this.auth = this.createAuthInstance(
      this.socketManager,
      this.publicKey || null,
      this.authServiceUrl
    );

    this.registerSocketManagerListeners();
  }

  /**
   * Retrieves the current authentication token from either...
   * a) Auth service session if exists
   * b) Token response from auth endpoint or auth action
   *
   * @returns {string | null} The authentication token or null if not authenticated.
   */
  get authToken(): string | null {
    return this.auth?.token ?? this.tokenResponse?.token ?? null;
  }

  private getOfflineServiceUrls({
    enabled = false,
    port = 0,
    authServiceUrl = null,
    coreServiceUrl = null,
    httpServiceUrl = null,
    stateServiceUrl = null
  }: OfflineOptions = {}): {
    authServiceUrl: string | null;
    httpServiceUrl: string | null;
    coreServiceUrl: string | null;
    stateServiceUrl: string | null;
  } {
    if (enabled || port || authServiceUrl || coreServiceUrl) {
      port = port || DEFAULT_OFFLINE_PORT;

      return {
        authServiceUrl:
          authServiceUrl ?? `${DEFAULT_OFFLINE_AUTH_HOST}:${port}/${DEFAULT_OFFLINE_AUTH_PATH}`,
        coreServiceUrl:
          coreServiceUrl ?? `${DEFAULT_OFFLINE_CORE_HOST}:${port}/${DEFAULT_OFFLINE_CORE_PATH}`,
        httpServiceUrl:
          httpServiceUrl ?? `${DEFAULT_OFFLINE_HTTP_HOST}:${port}/${DEFAULT_OFFLINE_HTTP_PATH}`,
        stateServiceUrl:
          stateServiceUrl ?? `${DEFAULT_OFFLINE_STATE_HOST}:${port}/${DEFAULT_OFFLINE_STATE_PATH}`
      };
    }

    return {
      authServiceUrl,
      coreServiceUrl,
      httpServiceUrl,
      stateServiceUrl
    };
  }

  private createAuthInstance(
    socketManager: SocketManager,
    publicKey: string | null,
    authServiceUrl: string
  ): Auth {
    return new Auth(socketManager, publicKey, authServiceUrl);
  }

  /**
   * Manages socket event listeners by registering them with the event emitter.
   * @param {SocketEvent} event - The socket event to listen for.
   * @param {SocketEventHandler} handler - The handler to call when the event occurs.
   */
  private registerSocketManagerListener(event: SocketEvent, handler: SocketEventHandler): void {
    this.socketManager.eventEmitter.on(event, handler);
    this.socketManagerListeners.push({ event, handler });
  }

  /**
   * Registers the default socket event listeners to propagate events to the connection.
   */
  private registerSocketManagerListeners() {
    this.registerSocketManagerListener(SocketEvent.CONNECTING, () => {
      this.isConnected = false;
      this.connection.emit(SocketEvent.CONNECTING);
    });

    this.registerSocketManagerListener(SocketEvent.CONNECT, () => {
      this.isConnected = true;
      this.connection.emit(SocketEvent.CONNECT);
    });

    this.registerSocketManagerListener(SocketEvent.RECONNECTED, (attempts: number) => {
      this.isConnected = true;
      this.connection.emit(SocketEvent.RECONNECTED, attempts);
    });

    this.registerSocketManagerListener(SocketEvent.DISCONNECT, (reason: string) => {
      this.isConnected = false;
      this.connection.emit(SocketEvent.DISCONNECT, reason);
    });

    this.registerSocketManagerListener(SocketEvent.RECONNECTING, (attempt: number) => {
      this.isConnected = false;
      this.connection.emit(SocketEvent.RECONNECTING, attempt);
    });

    this.registerSocketManagerListener(SocketEvent.ERROR, (err: any) => {
      this.isConnected = false;
      this.connection.emit(SocketEvent.ERROR, err);
    });

    this.registerSocketManagerListener(SocketEvent.CONNECT_ERROR, (err: any) => {
      this.isConnected = false;
      this.connection.emit(SocketEvent.CONNECT_ERROR, err);
    });

    this.registerSocketManagerListener(SocketEvent.CONNECT_FAILED, (err: any) => {
      this.isConnected = false;
      this.connection.emit(SocketEvent.CONNECT_FAILED, err);
    });

    this.registerSocketManagerListener(SocketEvent.RECONNECT_FAILED, (err: any) => {
      this.isConnected = false;
      this.connection.emit(SocketEvent.RECONNECT_FAILED, err);
    });

    this.registerSocketManagerListener(SocketEvent.AUTH_TOKEN_EXPIRED, (tokenExpiryUtc: number) => {
      this.connect(true);
      this.connection.emit(SocketEvent.REAUTHENTICATING, tokenExpiryUtc);
    });
  }

  /**
   * Establishes a quick connection to the server using the existing socket.
   * @returns {Promise<void>}
   */
  async quickConnect(): Promise<void> {
    this.socketManager.connectSocket();
  }

  /**
   * Connects to the server, optionally forcing a new connection.
   * @param {boolean} [forceNewConnection=false] - Whether to force a new connection.
   * @returns {Promise<void>}
   * @throws Will throw an error if the connection fails.
   */
  async connect(forceNewConnection?: boolean): Promise<void> {
    if (this.socketManager.getSocket() && !forceNewConnection) {
      logger.logInfo('Socket connection exists');
      return;
    }

    try {
      if (this.apiKey) {
        await this.handleApiKeyConnect();
      } else if (this.authAction) {
        await this.handleAuthActionConnect();
      } else if (this.auth?.token) {
        await this.handleAuthServiceConnect(forceNewConnection);
      } else if (this.authEndpoint) {
        await this.handleAuthTokenConnect();
      } else {
        throw new Error('No authentication method provided');
      }

      await this.waitForStableConnection();
    } catch (err: any) {
      logger.logError(`Socket connection failed`, err);
      throw err;
    }
  }

  /**
   * Handles connecting to the server using an authentication token.
   * @param {boolean} [refresh=false] - Whether this is a token refresh attempt.
   * @returns {Promise<void>}
   * @throws Will throw an error if the authentication fails.
   */
  private async handleAuthTokenConnect(refresh?: boolean): Promise<void> {
    logger.logInfo(`Fetching auth token response from auth endpoint`);

    const tokenResponse = await getAuthTokenResponse(
      this.authEndpoint,
      this.authHeaders,
      this.authParams,
      this.authRequestOptions,
      this.clientId
    );

    if (!tokenResponse) {
      throw new TokenError(`No token response received`);
    }

    this.tokenResponse = tokenResponse;

    if (refresh) {
      this.socketManager.updateSocketAuth(tokenResponse);
    } else {
      this.socketManager.authTokenInitSocket(tokenResponse);
    }

    this.setAuthTokenRefreshTimeout(tokenResponse.expiresIn);
  }

  /**
   * Handles connecting to the server using an authentication action (NextJS App Router).
   * @param {boolean} [refresh=false] - Whether this is a token refresh attempt.
   * @returns {Promise<void>}
   * @throws Will throw an error if the authentication fails.
   */
  private async handleAuthActionConnect(refresh?: boolean): Promise<void> {
    logger.logInfo(`Fetching auth token response from server action`);

    if (!this.authAction) {
      throw new ValidationError(`No authentication function provided`);
    }

    const tokenResponse = await this.authAction(this.authParams);

    if (!tokenResponse) {
      throw new TokenError(`No token response received`);
    }

    this.tokenResponse = tokenResponse;

    if (refresh) {
      this.socketManager.updateSocketAuth(tokenResponse);
    } else {
      this.socketManager.authTokenInitSocket(tokenResponse);
    }

    this.setAuthTokenRefreshTimeout(tokenResponse.expiresIn);
  }

  /**
   * Handles connecting to the server using an API key.
   * @returns {Promise<void>}
   */
  private async handleApiKeyConnect(): Promise<void> {
    const keyData: AuthKeyData = {
      apiKey: this.apiKey!
    };

    if (this.clientId) {
      keyData.clientId = this.clientId;
    }

    this.socketManager.apiKeyInitSocket(keyData);
  }

  /**
   * Handles connecting to the server using an authentication service.
   * @param {boolean} [refresh=false] - Whether this is a token refresh attempt.
   * @returns {Promise<void>}
   * @throws Will throw an error if the auth service is not configured.
   * @throws Will throw an error if the auth service returns an invalid token response.
   */
  private async handleAuthServiceConnect(refresh?: boolean): Promise<void> {
    if (!this.auth) {
      throw new Error(`Auth service not configured`);
    }

    if (refresh) {
      await this.auth.tokenRefresh();
    }

    const tokenResponse = this.auth.tokenResponse;

    if (!tokenResponse) {
      throw new TokenError(`No token response found`);
    }

    this.socketManager.authTokenInitSocket(tokenResponse);
  }

  /**
   * Waits for a stable connection to be established by ensuring both the socket connection
   * and the acknowledgment of the connection are successful.
   * @returns {Promise<unknown>}
   * @throws {SocketConnectionError} If the connection times out.
   */
  private waitForStableConnection(): Promise<unknown> {
    const connectionPromises = [this.waitForSocketConnect(), this.waitForConnectionAck()];

    const connectionTimeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () =>
          reject(
            new SocketConnectionError(
              `Connection timeout after ${SOCKET_CONNECTION_ACK_TIMEOUT_MS} ms`
            )
          ),
        SOCKET_CONNECTION_ACK_TIMEOUT_MS
      );
    });

    const connectionRacePromises = Promise.race([
      Promise.all(connectionPromises),
      connectionTimeoutPromise
    ]);

    this.socketManager.connectSocket();

    return connectionRacePromises;
  }

  /**
   * Waits for the socket to emit a connection event.
   * @returns {Promise<unknown>}
   * @throws {SocketConnectionError} If the socket encounters an error during connection.
   */
  private async waitForSocketConnect(): Promise<unknown> {
    let connectHandler: (value: unknown) => void;
    let errorHandler: (value: unknown) => void;

    return new Promise((resolve, reject) => {
      connectHandler = resolve;

      errorHandler = () => {
        reject(new SocketConnectionError('Socket connection error'));
      };

      this.socketManager.eventEmitter.once(SocketEvent.CONNECT, connectHandler);
      this.socketManager.eventEmitter.once(SocketEvent.ERROR, errorHandler);
    }).finally(() => {
      this.socketManager.eventEmitter.off(SocketEvent.CONNECT, connectHandler);
      this.socketManager.eventEmitter.off(SocketEvent.ERROR, errorHandler);
    });
  }

  /**
   * Waits for the server to acknowledge the connection, updating client and connection IDs.
   * @returns {Promise<void>}
   * @throws Will throw an error if the socket disconnects before acknowledgment.
   */
  private async waitForConnectionAck(): Promise<unknown> {
    let ackHandler: (handshake: SocketHandshake) => void;
    let disconnectHandler: () => void;

    return new Promise<void>((resolve, reject) => {
      ackHandler = ({ clientId, connectionId }: SocketHandshake) => {
        this.clientId = clientId;
        this.connectionId = connectionId;

        this.socketManager.updateSocketConnectionId(connectionId);

        resolve();
      };

      disconnectHandler = () => {
        reject(new Error('Socket disconnected before acknowledgment'));
      };

      this.socketManager.eventEmitter.once(ServerEvent.CONNECTION_ACKNOWLEDGED, ackHandler);
      this.socketManager.eventEmitter.once(SocketEvent.DISCONNECT, disconnectHandler);
    }).finally(() => {
      this.socketManager.eventEmitter.off(ServerEvent.CONNECTION_ACKNOWLEDGED, ackHandler);
      this.socketManager.eventEmitter.off(SocketEvent.DISCONNECT, disconnectHandler);
    });
  }

  /**
   * Sets a timeout to refresh the authentication token before it expires.
   * @param {number} expiresIn - The token expiration time in seconds.
   * @param {number} [retryMs] - Optional retry time in milliseconds.
   */
  private setAuthTokenRefreshTimeout(expiresIn: number, retryMs?: number): void {
    const refreshBufferSeconds = AUTH_TOKEN_REFRESH_BUFFER_SECONDS;
    const timeout = retryMs || (expiresIn - refreshBufferSeconds) * 1000;

    if (!this.authAction && !this.authEndpoint) {
      logger.logWarning('No authentication method provided');
      return;
    }

    this.refreshTimeout = setTimeout(async () => {
      try {
        if (this.authAction) {
          await this.handleAuthActionConnect(true);
        } else if (this.authEndpoint) {
          await this.handleAuthTokenConnect(true);
        }
      } catch (err) {
        const jitter =
          Math.floor(Math.random() * AUTH_TOKEN_REFRESH_JITTER_RANGE_MS) +
          AUTH_TOKEN_REFRESH_RETRY_MS;

        logger.logError(`Failed to refresh token...retrying in ${jitter}ms`, err);

        this.setAuthTokenRefreshTimeout(0, jitter);
      }
    }, timeout);
  }

  /**
   * Create a room with predefined options.
   * @param roomId The ID of the room to create.
   * @param opts Room create options, see RoomOptions.
   * @returns
   */
  async create(roomId: string, opts?: RoomCreateOptions): Promise<RoomAttachOptions> {
    if (opts) {
      const { visibility, password } = opts;

      if (visibility === 'protected' && !password) {
        throw new Error('Password is required for protected rooms');
      }
    }

    try {
      const room = await this.socketManager.emitWithAck<Room>(ClientEvent.ROOM_CREATE, {
        roomId,
        ...opts
      });

      return {
        ...room,
        join: (opts?: RoomJoinOptions) => this.join.bind(this, roomId, opts)
      };
    } catch (err: any) {
      logger.logError(err.message);
      throw err;
    }
  }

  /**
   * Joins a room, creating it if it doesn't exist.
   * @param {string} roomId - The ID of the room to join.
   * @param opts Room join options, see RoomJoinOptions.
   * @returns {Promise<Room>} The created or joined room instance.
   * @throws Will throw an error if room creation fails.
   */
  async join(roomId: string, opts?: RoomJoinOptions): Promise<Room> {
    const getAuthToken = () => this.authToken;

    const room = new Room(
      roomId,
      this.socketManager,
      this.presenceFactory,
      this.metricsFactory,
      this.historyFactory,
      this.httpServiceUrl,
      this.stateServiceUrl,
      getAuthToken
    );

    try {
      return await room.create(opts || defaultRoomJoinOptions);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === ErrorName.PASSWORD_REQUIRED_ERROR) {
        this.emit(RoomEvent.PROTECTED_PASSWORD_REQUIRED, roomId);
      }

      throw err;
    }
  }

  /**
   * List rooms available to the user
   * @returns {Promise<Room[]>}
   */
  async list(opts: RoomListOptions = {}): Promise<PaginatedResponse<any>> {
    try {
      if (!this.authToken) {
        throw new TokenError('No authentication token provided');
      }

      const requestParams: RequestInit = {
        method: HttpMethod.GET,
        mode: HttpMode.CORS,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.authToken}`
        }
      };

      const queryParams = new URLSearchParams(opts as Record<string, string>);

      const requestUrl = `${this.httpServiceUrl}/${ROOM_SERVICE_PATHNAME}${
        queryParams.size && `?${queryParams.toString()}`
      }`;

      const response = await serviceRequest<PaginatedResponse<any>>(requestUrl, requestParams);

      return response;
    } catch (err: any) {
      const message = `Error getting room list`;
      logger.logError(message, err);
      throw err;
    }
  }

  /**
   * Disconnects from the server, cleaning up resources and removing listeners.
   */
  disconnect(): void {
    if (this.refreshTimeout !== null) {
      clearTimeout(this.refreshTimeout as number);
      this.refreshTimeout = null;
    }

    this.socketManagerListeners.forEach(({ event, handler }) => {
      this.socketManager.eventEmitter.off(event, handler);
    });

    this.socketManagerListeners = [];
    this.socketManager.disconnectSocket();
  }

  reconnect() {
    this.socketManager.disconnectSocket();
  }
}
