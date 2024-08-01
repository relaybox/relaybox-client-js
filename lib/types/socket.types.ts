export interface SocketSession {
  id: string;
  appKey: string;
  exp: number;
  iat: number;
}

export interface SocketAuth {
  token?: string;
  expiresIn?: number;
  uid?: string;
  clientId?: string | number;
  connectionId?: string;
}

export interface SocketHandshake {
  session: SocketSession;
}

export enum SocketTransport {
  WEBSOCKET = 'websocket',
  POLLING = 'polling'
}

export interface SocketHandshake {
  clientId?: string;
  connectionId: string;
}

export enum SocketEvent {
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  ERROR = 'error',
  RECONNECT = 'reconnect',
  CONNECT_ERROR = 'connect_error',
  CONNECT_FAILED = 'connect_failed',
  RECONNECTING = 'reconnecting',
  RECONNECTED = 'reconnected',
  RECONNECT_FAILED = 'reconnect_failed',
  AUTH_TOKEN_EXPIRED = 'auth_token_expired',
  REAUTHENTICATING = 'reauthenticating'
}

export type SocketEventTypes =
  | 'connect'
  | 'disconnect'
  | 'error'
  | 'reconnect'
  | 'connect_error'
  | 'connect_failed'
  | 'reconnecting'
  | 'disconnect'
  | 'reconnected'
  | 'reconnect_failed'
  | 'auth_token_expired'
  | 'reauthenticating';

export enum SocketState {
  CCONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  DISCONNECTED = 'disconnected'
}

export enum SocketIoEvent {
  ERROR = 'error'
}

export type SocketEventHandler = (...args: any[]) => void;

export interface SocketRoomEventHandlers {
  on: (event: string, fn: SocketEventHandler) => void;
  off: (event: string, fn?: SocketEventHandler) => void;
  leave: () => void;
}

export interface ServerMessage {
  data: string;
}

export interface ServerEventData {
  type: string;
  body: any;
}

export interface SocketErrorResponse {
  message: string;
  status?: number;
}

export interface SocketManagerListener {
  event: SocketEvent;
  handler: SocketEventHandler;
}
