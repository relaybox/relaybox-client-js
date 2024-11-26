export enum ErrorName {
  VALIDATION_ERROR = 'ValidationError',
  NETWORK_ERROR = 'NetworkError',
  HTTP_REQUEST_ERROR = 'HTTPRequestError',
  HTTP_SERVICE_ERROR = 'HTTPServiceError',
  SIGNATURE_ERROR = 'SignatureError',
  TOKEN_ERROR = 'TokenError',
  SOCKET_CONNECTION_ERROR = 'SocketConnectionError',
  SOCKET_EMIT_ERROR = 'SocketEmitError',
  TIMEOUT_ERROR = 'TimeoutError',
  PASSWORD_REQUIRED_ERROR = 'PasswordRequiredError'
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = ErrorName.VALIDATION_ERROR;
  }
}

export class NetworkError extends Error {
  public status: number;

  constructor(message: string, status?: any) {
    super(message);
    this.status = status;
    this.name = ErrorName.NETWORK_ERROR;
  }
}

export class HTTPRequestError extends Error {
  public status: number;

  constructor(message: string, status?: any) {
    super(message);
    this.status = status;
    this.name = ErrorName.HTTP_REQUEST_ERROR;
  }
}

export class HTTPServiceError extends Error {
  public status: number;
  public data?: unknown;

  constructor(status: number, message: string, err: any) {
    super(message);
    this.status = status;
    this.name = err.name;
    this.data = err.data || null;
  }
}

export class SignatureError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = ErrorName.SIGNATURE_ERROR;
  }
}

export class TokenError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = ErrorName.TOKEN_ERROR;
  }
}

export class SocketConnectionError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = ErrorName.SOCKET_CONNECTION_ERROR;
  }
}

export class SocketEmitError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = ErrorName.SOCKET_EMIT_ERROR;
  }
}

export class TimeoutError extends Error {
  static name = ErrorName.TIMEOUT_ERROR;

  constructor(message: string, public details?: any) {
    super(message);
    this.name = ErrorName.TIMEOUT_ERROR;
  }
}

export class CustomError extends Error {
  constructor(args: { name: string; message: string }) {
    super(args.message);
    this.name = args.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
