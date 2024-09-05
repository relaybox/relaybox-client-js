import EventEmitter from 'eventemitter3';
import {
  ServerEventData,
  SocketAuth,
  SocketErrorResponse,
  SocketEvent,
  SocketEventHandler,
  SocketState
} from './types/socket.types';
import { logger } from './logger';
import { ClientEvent, ServerEvent } from './types/event.types';
import { KeyData, TokenResponse } from './types/request.types';

const UWS_SERVER_HOST = process.env.UWS_SERVER_HOST;
const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY_MS = 500;
const MAX_RECONNECT_DELAY_MS = 10000;

export class SocketManager {
  private socket: any;
  private socketAuth: SocketAuth | null = null;
  private connection: WebSocket | null = null;
  private connectionString: string | null = null;
  private tokenResponse: TokenResponse | null = null;
  private reconnectAttempts: number = 0;
  private reconnectionTimeout: NodeJS.Timeout | number | null = null;
  private pendingAcknowledgements: Map<string, SocketEventHandler> = new Map();
  private tokenExpiryUnix: number | null = null;

  public id?: string;
  public eventEmitter: EventEmitter;

  constructor() {
    this.eventEmitter = new EventEmitter();
  }

  private initializeSocket(auth: TokenResponse | KeyData): void {
    this.disconnectSocket();
    this.socketAuth = auth;
  }

  getConnectionString(): string {
    const searchParams = new URLSearchParams(this.socketAuth as unknown as Record<string, string>);
    const queryString = searchParams.toString();

    return `${UWS_SERVER_HOST}?${queryString}`;
  }

  connectSocket(): void {
    if (this.tokenExpired()) {
      this.eventEmitter.emit(SocketEvent.AUTH_TOKEN_EXPIRED, this.tokenExpiryUnix);
    } else {
      this.connectionString = this.getConnectionString();
      this.connection = new WebSocket(this.connectionString!);
      this.registerSocketStateEventListeners();

      logger.logInfo('Connecting socket');
    }
  }

  registerSocketStateEventListeners() {
    if (!this.connection) {
      return;
    }

    this.connection.onopen = this.handleSocketOpenEvent.bind(this);
    this.connection.onmessage = this.handleSocketMessageEvent.bind(this);
    this.connection.onclose = this.handleSocketCloseEvent.bind(this);
    this.connection.onerror = this.handleSocketErrorEvent.bind(this);
  }

  private handleSocketOpenEvent() {
    this.socket = {};
    this.socket.connected = true;
    this.setSocketState(SocketState.CONNECTED);

    logger.logInfo('Socket connected');

    this.eventEmitter.emit(SocketEvent.CONNECT);

    if (this.reconnectAttempts > 0) {
      this.eventEmitter.emit(SocketEvent.RECONNECTED, this.reconnectAttempts);
    }

    this.reconnectAttempts = 0;
  }

  private handleSocketCloseEvent(event: CloseEvent) {
    if (this.socket) {
      this.socket.connected = false;
      this.setSocketState(SocketState.DISCONNECTED);
    }

    this.eventEmitter.emit(SocketEvent.DISCONNECT);

    if (this.socketAuth) {
      this.handleReconnection();
    }

    logger.logWarning(`Socket disconnected`, event);
  }

  private handleSocketMessageEvent(messageEvent: MessageEvent) {
    const { type, body } = this.parseServerEventData(messageEvent);

    this.eventEmitter.emit(type, body);

    if (type === ServerEvent.MESSAGE_ACKNOWLEDGED) {
      const { ackId, data, err } = body;
      this.handlePendingAcknowledgement(ackId, data, err);
    }
  }

  private handleSocketErrorEvent(err: Event) {
    this.socket.connected = false;
    this.eventEmitter.emit(SocketEvent.ERROR);

    if (this.tokenExpired()) {
      this.handleReconnection();
    }

    logger.logError(`Socket error`, err);
  }

  parseServerEventData(messageEvent: MessageEvent): ServerEventData {
    return JSON.parse(messageEvent.data);
  }

  authTokenInitSocket(tokenResponse: TokenResponse): void {
    if (!tokenResponse) {
      const message = `Invalid token response`;
      logger.logError(message);
      throw new Error(message);
    }

    this.tokenResponse = tokenResponse;
    this.tokenExpiryUnix = tokenResponse.expiresAt || this.getTokenExpiryUnix(tokenResponse);

    if (this.socket) {
      this.updateSocketAuth(tokenResponse);
    } else {
      this.initializeSocket(tokenResponse);
    }
  }

  apiKeyInitSocket(keyData: KeyData): void {
    if (!keyData) {
      const message = `API Keydata not provided`;
      logger.logError(message);
      throw new Error(message);
    }

    if (!this.socket) {
      this.initializeSocket(keyData);
    }
  }

  updateSocketAuth(tokenResponse: TokenResponse): void {
    this.tokenResponse = tokenResponse;
    this.tokenExpiryUnix = this.getTokenExpiryUnix(tokenResponse);

    this.socketAuth = {
      ...this.socketAuth,
      ...tokenResponse
    };
  }

  updateSocketConnectionId(connectionId: string): void {
    if (this.socket) {
      this.socketAuth = {
        ...this.socketAuth,
        connectionId
      };
    }
  }

  private handleReconnection(): void {
    if (this.reconnectionTimeout) {
      clearTimeout(this.reconnectionTimeout);
      this.reconnectionTimeout = null;
    }

    if (this.socket && this.socket.connected) {
      logger.logInfo('Already connected. No need to reconnect.');
      return;
    }

    logger.logInfo(`Reconecting socket`, { connectionId: this.socketAuth?.connectionId });

    this.setSocketState(SocketState.RECONNECTING);

    this.eventEmitter.emit(SocketEvent.RECONNECTING, ++this.reconnectAttempts);

    if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      const exp = Math.pow(2, this.reconnectAttempts) * INITIAL_RECONNECT_DELAY_MS;
      const baseDelay = Math.min(MAX_RECONNECT_DELAY_MS, exp);
      const jitter = Math.random() * baseDelay;
      const delay = baseDelay + jitter;

      this.reconnectionTimeout = setTimeout(() => {
        this.connectSocket();
      }, delay);
    } else {
      logger.logError('Reached maximum reconnection attempts');
      this.eventEmitter.emit(SocketEvent.RECONNECT_FAILED);
    }
  }

  private generateAckId(): string {
    return Date.now() + Math.random().toString(36).substr(2, 9);
  }

  pushPendingAcknowledgement(ackId: string, ackHandler: SocketEventHandler): void {
    this.pendingAcknowledgements.set(ackId, ackHandler);
  }

  handlePendingAcknowledgement(ackId: string, data: any, err: SocketErrorResponse): void {
    const ackHandler = this.pendingAcknowledgements.get(ackId);

    if (ackHandler) {
      ackHandler(data, err);
      this.pendingAcknowledgements.delete(ackId);
    }
  }

  emit(
    type: ClientEvent,
    body?: any,
    ackHandler?: SocketEventHandler,
    defaultAckId?: string
  ): void {
    if (this.socket && this.socket.connected) {
      const ackId = ackHandler ? defaultAckId || this.generateAckId() : undefined;

      const createdAt = new Date().toISOString();

      const data = {
        type,
        body,
        ackId,
        createdAt
      };

      if (ackId && ackHandler) {
        this.pushPendingAcknowledgement(ackId, ackHandler);
      }

      this.connection?.send(JSON.stringify(data));
    } else {
      logger.logError(`Attempt to emit '${type}' when socket is not connected.`);
    }
  }

  emitWithAck<T>(event: ClientEvent, data: any, defaultAckId?: string): Promise<T> {
    data.intiatedAt = new Date().toISOString();

    return new Promise((resolve, reject) => {
      function ackHandler(response: T, err: any) {
        if (err) {
          return reject(new Error(err.message));
        }

        resolve(response);
      }

      this.emit(event, data, ackHandler, defaultAckId);
    });
  }

  on(event: string, handler: SocketEventHandler): void {
    this.eventEmitter.on(event, handler);
  }

  off(event: string, handler?: SocketEventHandler): void {
    if (handler) {
      this.eventEmitter.off(event, handler);
    } else {
      this.eventEmitter.off(event);
    }
  }

  removeAllListeners(event: string) {
    this.eventEmitter.removeAllListeners(event);
  }

  disconnectSocket(): void {
    if (this.socket) {
      this.eventEmitter.removeAllListeners();
      this.connection?.close();
      this.socketAuth = null;
      this.socket = null;

      logger.logInfo('Socket disconnected');
    }

    if (this.reconnectionTimeout) {
      clearTimeout(this.reconnectionTimeout);
      this.reconnectionTimeout = null;
    }
  }

  getSocket(): any {
    return this.socket;
  }

  getConnection(): WebSocket | null {
    return this.connection;
  }

  getTokenResponse(): TokenResponse | null {
    return this.tokenResponse;
  }

  private setSocketState(state: SocketState) {
    this.socket.state = state;
  }

  getSocketState() {
    return this.socket.state;
  }

  private getTokenExpiryUnix(tokenResponse: TokenResponse): number {
    const unixTime = new Date().getTime();
    return unixTime + tokenResponse.expiresIn * 1000;
  }

  private tokenExpired(): boolean {
    if (this.tokenExpiryUnix) {
      const now = new Date().getTime();
      const tokenExpired = this.tokenExpiryUnix <= now;

      if (tokenExpired) {
        logger.logWarning('Socket auth token expired', {
          tokenExpiryUnix: this.tokenExpiryUnix,
          now
        });
      }

      return tokenExpired;
    }

    return false;
  }
}
