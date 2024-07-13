export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NetworkError extends Error {
  public status: number;

  constructor(message: string, status?: any) {
    super(message);
    this.status = status;
    this.name = 'NetworkError';
  }
}

export class HTTPRequestError extends Error {
  public status: number;

  constructor(message: string, status?: any) {
    super(message);
    this.status = status;
    this.name = 'HTTPRequestError';
  }
}

export class SignatureError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'SignatureError';
  }
}

export class TokenError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'TokenError';
  }
}

export class SocketConnectionError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'SocketConnectionError';
  }
}

export class SocketEmitError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'SocketEmitError';
  }
}
