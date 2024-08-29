import { TokenError } from './errors';
import { logger } from './logger';
import { serviceRequest } from './request';
import { getItem, setItem } from './storage';
import { AuthUser, FormattedResponse, HttpMethod, ServiceData, TokenResponse } from './types';
import { StorageType } from './types/storage.types';
import { validateEmail, validateStringLength } from './validation';

const AUTH_SERVICE_PATHNAME = '/users';
const AUTH_SERVICE_VERIFICATION_CODE_LENGTH = 6;
const AUTH_SERVICE_MIN_PASSWORD_LENGTH = 5;
export const REFRESH_TOKEN_KEY = 'rb:token:refresh';

enum AuthEndpoint {
  CREATE = `/create`,
  LOGIN = `/authenticate`,
  VERIFY = `/verify`,
  TOKEN_REFRESH = '/token/refresh',
  SESSION = '/session',
  PASSWORD_RESET = '/password-reset',
  PASSWORD_CONFIRM = '/password-confirm'
}

export class Auth {
  private readonly publicKey: string;
  private readonly authServiceHost: string;
  #tokenResponse: TokenResponse | null = null;
  #refreshToken: string | null = null;
  #user: AuthUser | null = null;

  constructor(publicKey: string, authServiceHost: string) {
    this.publicKey = publicKey;
    this.authServiceHost = authServiceHost;
  }

  get tokenResponse(): TokenResponse | null {
    return this.#tokenResponse;
  }

  get token(): string | undefined {
    return this.#tokenResponse?.token;
  }

  get refreshToken(): string | null {
    return this.#refreshToken;
  }

  get user(): AuthUser | null {
    return this.#user;
  }

  set tokenResponse(value: TokenResponse | null) {
    this.#tokenResponse = value;
  }

  set user(value: AuthUser | null) {
    this.#user = value;
  }

  private setRefreshToken(value: string, expiresAt?: number, storageType?: StorageType): void {
    const refreshTokenData = {
      value,
      expiresAt
    };

    setItem(REFRESH_TOKEN_KEY, JSON.stringify(refreshTokenData), storageType);

    this.#refreshToken = value;
  }

  private getRefreshToken(): string | null {
    let refreshTokenData = this.#refreshToken;

    if (!refreshTokenData) {
      refreshTokenData = getItem(REFRESH_TOKEN_KEY, StorageType.SESSION);
    }

    if (!refreshTokenData) {
      refreshTokenData = getItem(REFRESH_TOKEN_KEY, StorageType.PERSIST);
    }

    return refreshTokenData;
  }

  private handleTokenResponse(tokenResponseData: TokenResponse): TokenResponse {
    const { refreshToken, user, destroyAt, authStorageType, ...tokenResponse } = tokenResponseData;

    if (!refreshToken || !user || !tokenResponse) {
      throw new TokenError('Auth token response is invalid');
    }

    this.setRefreshToken(refreshToken, destroyAt, authStorageType);
    this.user = user;
    this.tokenResponse = tokenResponse;

    return tokenResponseData;
  }

  private async authServiceRequest<T>(
    endpoint: AuthEndpoint,
    params: RequestInit = {}
  ): Promise<T> {
    const requestUrl = `${this.authServiceHost}${AUTH_SERVICE_PATHNAME}${endpoint}`;

    const defaultHeaders = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Ds-Key-Name': this.publicKey
    };

    params.headers = {
      ...defaultHeaders,
      ...(params?.headers || {})
    };

    const response = await serviceRequest<T>(requestUrl, params);

    return response;
  }

  public async create(email: string, password: string): Promise<ServiceData> {
    logger.logInfo(`Creating user with email: ${email}`);

    try {
      const requestBody = {
        email,
        password
      };

      const response = await this.authServiceRequest<ServiceData>(AuthEndpoint.CREATE, {
        method: HttpMethod.POST,
        body: JSON.stringify(requestBody)
      });

      return response;
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }

  public async verify(email: string, code: string): Promise<ServiceData> {
    logger.logInfo(`Verifying email: ${email}`);

    try {
      const requestBody = {
        email,
        code
      };

      const response = await this.authServiceRequest<ServiceData>(AuthEndpoint.VERIFY, {
        method: HttpMethod.POST,
        body: JSON.stringify(requestBody)
      });

      return response;
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }

  public async login(email: string, password: string): Promise<TokenResponse> {
    logger.logInfo(`Logging in with email: ${email}`);

    try {
      const requestBody = {
        email,
        password
      };

      const response = await this.authServiceRequest<TokenResponse>(AuthEndpoint.LOGIN, {
        method: HttpMethod.POST,
        body: JSON.stringify(requestBody)
      });

      return this.handleTokenResponse(response);
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }

  public async tokenRefresh(): Promise<TokenResponse> {
    logger.logInfo(`Refreshing auth token`);

    try {
      const response = await this.authServiceRequest<TokenResponse>(AuthEndpoint.TOKEN_REFRESH, {
        method: HttpMethod.GET,
        headers: {
          Authorization: `Bearer ${this.refreshToken}`
        }
      });

      this.tokenResponse = response;

      return response;
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }

  public async getSession(): Promise<TokenResponse | null> {
    logger.logInfo(`Getting auth session`);

    try {
      const currentRefreshToken = this.getRefreshToken();

      if (!currentRefreshToken) {
        return null;
      }

      const response = await this.authServiceRequest<TokenResponse>(AuthEndpoint.SESSION, {
        method: HttpMethod.GET,
        headers: {
          Authorization: `Bearer ${currentRefreshToken}`
        }
      });

      return this.handleTokenResponse(response);
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }

  public async passwordReset(email: string): Promise<ServiceData> {
    logger.logInfo(`Password reset request for email: ${email}`);

    try {
      const requestBody = {
        email
      };

      const response = await this.authServiceRequest<ServiceData>(AuthEndpoint.PASSWORD_RESET, {
        method: HttpMethod.POST,
        body: JSON.stringify(requestBody)
      });

      return response;
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }

  public async passwordConfirm(
    email: string,
    password: string,
    code: string
  ): Promise<ServiceData> {
    logger.logInfo(`Verifying password reset`);

    try {
      const requestBody = {
        email,
        password,
        code
      };

      const response = await this.authServiceRequest<ServiceData>(AuthEndpoint.PASSWORD_CONFIRM, {
        method: HttpMethod.POST,
        body: JSON.stringify(requestBody)
      });

      return response;
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }
}
