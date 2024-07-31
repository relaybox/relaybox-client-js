import EventEmitter from 'eventemitter3';
import { getAuthTokenResponse } from './authentication';
import { ServerEvent } from './types/event.types';
import { RelayBoxOptions } from './types/relaybox.types';
import { Room } from './room';
import {
  SocketEvent,
  SocketEventHandler,
  SocketHandshake,
  SocketManagerListener
} from './types/socket.types';
import { logger } from './logger';
import { PresenceFactory, MetricsFactory } from './factory';
import { SocketConnectionError, ValidationError } from './errors';
import { SocketManager } from './socket-manager';
import { AuthRequestOptions, AuthTokenLifeCycle } from './types/auth.types';

const AUTH_TOKEN_REFRESH_BUFFER_SECONDS = 20;
const AUTH_TOKEN_REFRESH_RETRY_MS = 10000;
const AUTH_TOKEN_REFRESH_JITTER_RANGE_MS = 2000;
const SOCKET_CONNECTION_ACK_TIMEOUT_MS = 2000;

const AUTH_TOKEN_LIFECYCLE_SESSION = 'session';
const AUTH_TOKEN_LIFECYCLE_EXPIRY = 'expiry';

export class RelayBox {
  private readonly socketManager: SocketManager;
  private readonly presenceFactory: PresenceFactory;
  private readonly metricsFactory: MetricsFactory;
  private readonly authEndpoint?: string;
  private readonly authHeaders?: Record<string, unknown> | null;
  private readonly authParams?: Record<string, unknown> | null;
  private readonly authRequestOptions?: AuthRequestOptions;
  private readonly apiKey?: string;
  private readonly authTokenLifeCycle?: AuthTokenLifeCycle = AUTH_TOKEN_LIFECYCLE_SESSION;
  private socketManagerListeners: SocketManagerListener[] = [];
  private refreshTimeout: NodeJS.Timeout | number | null = null;

  public readonly connection: EventEmitter;
  public clientId?: string | number;
  public connectionId: string | null = null;

  constructor(opts: RelayBoxOptions) {
    if (!opts.apiKey && !opts.authEndpoint) {
      throw new ValidationError(`Please provide either "authEndpoint" or "apiKey"`);
    }

    this.apiKey = opts.apiKey;
    this.clientId = opts.clientId;
    this.authEndpoint = opts.authEndpoint;
    this.socketManager = new SocketManager();
    this.presenceFactory = new PresenceFactory();
    this.metricsFactory = new MetricsFactory();
    this.connection = new EventEmitter();
    this.authHeaders =
      typeof opts.authHeaders === 'function' ? opts.authHeaders() : opts.authHeaders;
    this.authParams = typeof opts.authParams === 'function' ? opts.authParams() : opts.authParams;
    this.authRequestOptions = opts.authRequestOptions;
    this.authTokenLifeCycle = opts.authTokenLifeCycle;

    this.registerSocketManagerListeners();
  }

  private manageSocketEventListener(event: SocketEvent, handler: SocketEventHandler): void {
    this.socketManager.eventEmitter.on(event, handler);
    this.socketManagerListeners.push({ event, handler });
  }

  private registerSocketManagerListeners() {
    this.manageSocketEventListener(SocketEvent.CONNECT, () => {
      this.connection.emit(SocketEvent.CONNECT);
    });

    this.manageSocketEventListener(SocketEvent.RECONNECTED, (attempts: number) => {
      this.connection.emit(SocketEvent.RECONNECTED, attempts);
    });

    this.manageSocketEventListener(SocketEvent.DISCONNECT, (reason: string) => {
      this.connection.emit(SocketEvent.DISCONNECT, reason);
    });

    this.manageSocketEventListener(SocketEvent.RECONNECTING, (attempt: number) => {
      this.connection.emit(SocketEvent.RECONNECTING, attempt);
    });

    this.manageSocketEventListener(SocketEvent.ERROR, (err: any) => {
      this.connection.emit(SocketEvent.ERROR, err);
    });

    this.manageSocketEventListener(SocketEvent.CONNECT_ERROR, (err: any) => {
      this.connection.emit(SocketEvent.CONNECT_ERROR, err);
    });

    this.manageSocketEventListener(SocketEvent.CONNECT_FAILED, (err: any) => {
      this.connection.emit(SocketEvent.CONNECT_FAILED, err);
    });

    this.manageSocketEventListener(SocketEvent.RECONNECT_FAILED, (err: any) => {
      this.connection.emit(SocketEvent.RECONNECT_FAILED, err);
    });

    this.manageSocketEventListener(SocketEvent.AUTH_TOKEN_EXPIRED, (tokenExpiryUtc: number) => {
      this.connect(true);
      this.connection.emit(SocketEvent.REAUTHENTICATING, tokenExpiryUtc);
    });
  }

  async quickConnect(): Promise<void> {
    this.socketManager.connectSocket();
  }

  async connect(forceNewConnection?: boolean): Promise<void> {
    if (this.socketManager.getSocket() && !forceNewConnection) {
      logger.logInfo('Socket connection exists');
      return;
    }

    try {
      if (this.apiKey) {
        await this.handleApiKeyConnect();
      } else {
        await this.handleAuthTokenConnect();
      }

      await this.waitForStableConnection();
    } catch (err: any) {
      logger.logError(`Socket connection failed`, err);
      throw err;
    }
  }

  private async handleAuthTokenConnect(refresh?: boolean): Promise<void> {
    logger.logInfo(`Fetching auth token response for new connection`);

    const tokenResponse = await getAuthTokenResponse(
      this.authEndpoint,
      this.authHeaders,
      this.authParams,
      this.authRequestOptions
    );

    if (refresh) {
      this.socketManager.updateSocketAuth(tokenResponse);
    } else {
      this.socketManager.authTokenInitSocket(tokenResponse);
    }

    if (this.authTokenLifeCycle === AUTH_TOKEN_LIFECYCLE_EXPIRY) {
      this.setAuthTokenRefreshTimeout(tokenResponse.expiresIn);
    }
  }

  private async handleApiKeyConnect(): Promise<void> {
    const keyData = {
      apiKey: this.apiKey!,
      clientId: this.clientId
    };

    this.socketManager.apiKeyInitSocket(keyData);
  }

  private waitForStableConnection() {
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

  private setAuthTokenRefreshTimeout(expiresIn: number, retryMs?: number): void {
    const refreshBufferSeconds = AUTH_TOKEN_REFRESH_BUFFER_SECONDS;
    const timeout = retryMs || (expiresIn - refreshBufferSeconds) * 1000;

    this.refreshTimeout = setTimeout(async () => {
      try {
        await this.handleAuthTokenConnect(true);
      } catch (err) {
        const jitter =
          Math.floor(Math.random() * AUTH_TOKEN_REFRESH_JITTER_RANGE_MS) +
          AUTH_TOKEN_REFRESH_RETRY_MS;

        logger.logError(`Failed to refresh token...retrying in ${jitter}ms`, err);

        this.setAuthTokenRefreshTimeout(0, jitter);
      }
    }, timeout);
  }

  async join(roomId: string): Promise<Room> {
    const room = new Room(roomId, this.socketManager, this.presenceFactory, this.metricsFactory);

    try {
      return await room.create();
    } catch (err) {
      throw err;
    }
  }

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
}
