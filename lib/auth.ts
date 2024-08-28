import { logger } from './logger';
import { request } from './request';
import { SocketManager } from './socket-manager';
import { AuthUser, FormattedResponse, HttpMethod, TokenResponse } from './types';
import { validateEmail, validateStringLength } from './validation';

const AUTH_SERVICE_PATHNAME = '/users';
const AUTH_SERVICE_VERIFICATION_CODE_LENGTH = 6;
const AUTH_SERVICE_MIN_PASSWORD_LENGTH = 5;

enum AuthEndpoint {
  CREATE = `/create`,
  LOGIN = `/authenticate`,
  VERIFY = `/verify`
}

export class Auth {
  private readonly socketManager: SocketManager;
  private readonly publicKey: string;
  private readonly rbAuthServiceHost: string;
  #tokenResponse: TokenResponse | null = null;
  #refreshToken: string | null = null;

  constructor(socketManager: SocketManager, publicKey: string, rbAuthServiceHost: string) {
    this.socketManager = socketManager;
    this.publicKey = publicKey;
    this.rbAuthServiceHost = rbAuthServiceHost;
  }

  get tokenResponse(): TokenResponse | null {
    return this.#tokenResponse;
  }

  get authToken(): string | undefined {
    return this.#tokenResponse?.token;
  }

  get refreshToken(): string | null {
    return this.#refreshToken;
  }

  private async authServiceRequest<T>(
    endpoint: AuthEndpoint,
    params: RequestInit = {}
  ): Promise<FormattedResponse<T>> {
    const requestUrl = `${this.rbAuthServiceHost}${AUTH_SERVICE_PATHNAME}${endpoint}`;

    const defaultHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Ds-Key-Name': this.publicKey
    };

    params.headers = {
      ...defaultHeaders,
      ...(params?.headers || {})
    };

    const response = await request<T>(requestUrl, params);

    return response;
  }

  public async create(email: string, password: string): Promise<any> {
    validateEmail(email);
    validateStringLength(password, AUTH_SERVICE_MIN_PASSWORD_LENGTH);

    try {
      const requestBody = {
        email,
        password
      };

      const response = await this.authServiceRequest(AuthEndpoint.CREATE, {
        method: HttpMethod.POST,
        body: JSON.stringify(requestBody)
      });

      if (!response?.data) {
        throw new Error('Failed to create user');
      }

      return true;
    } catch (err: any) {
      logger.logError(err.message);
      throw err;
    }
  }

  public async verify(email: string, code: string): Promise<any> {
    validateEmail(email);
    validateStringLength(code, AUTH_SERVICE_VERIFICATION_CODE_LENGTH, true);

    try {
      const requestBody = {
        email,
        code
      };

      const response = await this.authServiceRequest(AuthEndpoint.VERIFY, {
        method: HttpMethod.POST,
        body: JSON.stringify(requestBody)
      });

      if (!response?.data) {
        throw new Error('Failed to verify user');
      }

      return true;
    } catch (err: any) {
      logger.logError(err.message);
      throw err;
    }
  }

  public async login(email: string, password: string): Promise<any> {
    validateEmail(email);
    validateStringLength(password);

    try {
      const requestBody = {
        email,
        password
      };

      const response = await this.authServiceRequest<TokenResponse>(AuthEndpoint.LOGIN, {
        method: HttpMethod.POST,
        body: JSON.stringify(requestBody)
      });

      if (!response?.data) {
        throw new Error('No token response received');
      }

      const { refreshToken, user, ...tokenResponse } = response.data;

      this.#tokenResponse = tokenResponse;
      this.#refreshToken = refreshToken!;

      return user;
    } catch (err: any) {
      logger.logError(err.message);
      throw err;
    }
  }
}
