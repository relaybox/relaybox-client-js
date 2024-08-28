import { logger } from './logger';
import { request } from './request';
import { SocketManager } from './socket-manager';
import { FormattedResponse, HttpMethod, TokenResponse } from './types';
import { validateEmail, validateStringLength } from './validation';

const AUTH_SERVICE_PATHNAME = '/users';

enum AuthEndpoint {
  CREATE = `/create`,
  LOGIN = `/authenticate`
}

export class Auth {
  private readonly socketManager: SocketManager;
  private readonly publicKey: string;
  private readonly rbAuthServiceHost: string;
  #tokenResponse: TokenResponse | null = null;

  constructor(socketManager: SocketManager, publicKey: string, rbAuthServiceHost: string) {
    this.socketManager = socketManager;
    this.publicKey = publicKey;
    this.rbAuthServiceHost = rbAuthServiceHost;
  }

  get tokenResponse(): TokenResponse | null {
    return this.#tokenResponse;
  }

  private async fetch<T>(
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
    validateStringLength(password);

    try {
      const response = await this.fetch(AuthEndpoint.CREATE, {
        method: HttpMethod.POST
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

  public async login(email: string, password: string): Promise<any> {
    validateEmail(email);
    validateStringLength(password);

    try {
      const response = await this.fetch<TokenResponse>(AuthEndpoint.LOGIN, {
        method: HttpMethod.POST
      });

      if (!response?.data) {
        throw new Error('No token response received');
      }

      this.#tokenResponse = response.data;

      return this.#tokenResponse;
    } catch (err: any) {
      logger.logError(err.message);
      throw err;
    }
  }
}
