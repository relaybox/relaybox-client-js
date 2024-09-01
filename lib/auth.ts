import EventEmitter from 'eventemitter3';
import { TokenError } from './errors';
import { logger } from './logger';
import { serviceRequest } from './request';
import { getItem, removeItem, setItem } from './storage';
import {
  AuthCreateOptions,
  AuthEvent,
  AuthEventAllowedValues,
  AuthEventHandler,
  AuthLoginOptions,
  AuthMfaApi,
  AuthMfaChallengeOptions,
  AuthMfaChallengeResponse,
  AuthMfaEnrollOptions,
  AuthMfaEnrollResponse,
  AuthMfaVerifyOptions,
  AuthPasswordConfirmOptions,
  AuthPasswordResetOptions,
  AuthResendVerificationOptions,
  AuthSessionOptions,
  AuthSignInWithProviderOptions,
  AuthUser,
  AuthVerifyOptions,
  HttpMethod,
  ServiceResponseData,
  TokenResponse
} from './types';
import { StorageType } from './types/storage.types';

const AUTH_SERVICE_PATHNAME = '/users';
export const REFRESH_TOKEN_KEY = 'rb:token:refresh';
const AUTH_POPUP_MESSAGE_EVENT = 'message';

enum AuthEndpoint {
  CREATE = `/create`,
  LOGIN = `/authenticate`,
  VERIFY = `/verify`,
  TOKEN_REFRESH = '/token/refresh',
  SESSION = '/session',
  PASSWORD_RESET = '/password-reset',
  PASSWORD_CONFIRM = '/password-confirm',
  GENERATE_VERIFICATION_CODE = '/generate-verification-code',
  MFA_ENROLL = '/mfa/enroll',
  MFA_CHALLENGE = '/mfa/challenge',
  MFA_VERIFY = '/mfa/verify'
}

export class Auth extends EventEmitter {
  private readonly publicKey: string;
  private readonly authServiceUrl: string;
  private readonly authServiceHost: string;
  #session: TokenResponse | null = null;
  mfa: AuthMfaApi;

  constructor(publicKey: string, authServiceUrl: string, authServiceHost: string) {
    super();
    this.publicKey = publicKey;
    this.authServiceUrl = authServiceUrl;
    this.authServiceHost = authServiceHost;

    this.mfa = {
      enroll: this.mfaEnroll.bind(this),
      challenge: this.mfaChallenge.bind(this),
      verify: this.mfaVerify.bind(this)
    };
  }

  get tokenResponse(): TokenResponse | null {
    if (!this.#session) {
      return null;
    }

    return {
      token: this.#session?.token,
      expiresAt: this.#session?.expiresAt,
      expiresIn: this.#session?.expiresIn
    };
  }

  get token(): string | null {
    return this.#session?.token || null;
  }

  get refreshToken(): string | null {
    return this.#session?.refreshToken || null;
  }

  get user(): AuthUser | null {
    return this.#session?.user || null;
  }

  private setRefreshToken(value: string, expiresAt?: number, storageType?: StorageType): void {
    const refreshTokenData = {
      value,
      expiresAt
    };

    setItem(REFRESH_TOKEN_KEY, JSON.stringify(refreshTokenData), storageType);
  }

  private getRefreshToken(): string | null {
    let refreshTokenData = this.refreshToken;

    if (!refreshTokenData) {
      refreshTokenData = getItem(REFRESH_TOKEN_KEY, StorageType.SESSION);
    }

    if (!refreshTokenData) {
      refreshTokenData = getItem(REFRESH_TOKEN_KEY, StorageType.PERSIST);
    }

    return refreshTokenData;
  }

  private removeRefreshToken(): void {
    removeItem(REFRESH_TOKEN_KEY, this.#session?.authStorageType);
  }

  private handleTokenResponse(tokenResponseData: TokenResponse): TokenResponse {
    const { refreshToken, user, destroyAt, authStorageType, ...tokenResponse } = tokenResponseData;

    if (!refreshToken || !user || !tokenResponse) {
      throw new TokenError('Auth token response is invalid');
    }

    this.setRefreshToken(refreshToken, destroyAt, authStorageType);
    this.#session = tokenResponseData;

    return tokenResponseData;
  }

  private async authServiceRequest<T>(
    endpoint: AuthEndpoint,
    params: RequestInit = {}
  ): Promise<T> {
    const requestUrl = `${this.authServiceUrl}${AUTH_SERVICE_PATHNAME}${endpoint}`;

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

  public async signUp({ email, password }: AuthCreateOptions): Promise<ServiceResponseData> {
    logger.logInfo(`Creating user with email: ${email}`);

    try {
      const requestBody = {
        email,
        password
      };

      const response = await this.authServiceRequest<ServiceResponseData>(AuthEndpoint.CREATE, {
        method: HttpMethod.POST,
        body: JSON.stringify(requestBody)
      });

      this.emit(AuthEvent.SIGN_UP, response);

      return response;
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }

  public async verify({ email, code }: AuthVerifyOptions): Promise<ServiceResponseData> {
    logger.logInfo(`Verifying email: ${email}`);

    try {
      const requestBody = {
        email,
        code
      };

      const response = await this.authServiceRequest<ServiceResponseData>(AuthEndpoint.VERIFY, {
        method: HttpMethod.POST,
        body: JSON.stringify(requestBody)
      });

      this.emit(AuthEvent.VERIFY, response);

      return response;
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }

  public async resendVerification({
    email
  }: AuthResendVerificationOptions): Promise<ServiceResponseData> {
    logger.logInfo(`Resending verifcation email: ${email}`);

    try {
      const requestBody = {
        email
      };

      const response = await this.authServiceRequest<ServiceResponseData>(
        AuthEndpoint.GENERATE_VERIFICATION_CODE,
        {
          method: HttpMethod.POST,
          body: JSON.stringify(requestBody)
        }
      );

      this.emit(AuthEvent.RESEND_VERIFICATION, response);

      return response;
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }

  public async signIn({ email, password }: AuthLoginOptions): Promise<TokenResponse> {
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

      this.emit(AuthEvent.SIGN_IN, response);

      return this.handleTokenResponse(response);
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }

  public signOut(): void {
    this.removeRefreshToken();

    this.emit(AuthEvent.SIGN_OUT, this.user);
    this.#session = null;
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

      this.#session = {
        ...this.#session,
        ...response
      };

      this.emit(AuthEvent.TOKEN_REFRESH, response);

      return response;
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }

  public async getSession({
    verify = false
  }: AuthSessionOptions = {}): Promise<TokenResponse | null> {
    logger.logInfo(`Getting auth session`);

    if (this.#session && !verify) {
      return this.#session;
    }

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

  public async passwordReset({ email }: AuthPasswordResetOptions): Promise<ServiceResponseData> {
    logger.logInfo(`Password reset request for email: ${email}`);

    try {
      const requestBody = {
        email
      };

      const response = await this.authServiceRequest<ServiceResponseData>(
        AuthEndpoint.PASSWORD_RESET,
        {
          method: HttpMethod.POST,
          body: JSON.stringify(requestBody)
        }
      );

      this.emit(AuthEvent.PASSWORD_RESET, response);

      return response;
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }

  public async passwordConfirm({
    email,
    password,
    code
  }: AuthPasswordConfirmOptions): Promise<ServiceResponseData> {
    logger.logInfo(`Verifying password reset`);

    try {
      const requestBody = {
        email,
        password,
        code
      };

      const response = await this.authServiceRequest<ServiceResponseData>(
        AuthEndpoint.PASSWORD_CONFIRM,
        {
          method: HttpMethod.POST,
          body: JSON.stringify(requestBody)
        }
      );

      this.emit(AuthEvent.PASSWORD_CONFIRM, response);

      return response;
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }

  public onAuthEvent(event: AuthEventAllowedValues, handler: AuthEventHandler): void {
    this.on(event, handler);
  }

  public async signInWithOauth({
    provider,
    popup = true,
    width = 450,
    height = 600
  }: AuthSignInWithProviderOptions): Promise<void> {
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    window.open(
      `${this.authServiceUrl}/users/idp/${provider}/authorize?keyName=${this.publicKey}`,
      'popup',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    window.addEventListener(AUTH_POPUP_MESSAGE_EVENT, this.handleAuthMessage.bind(this));
  }

  private handleAuthMessage(event: MessageEvent): void {
    if (event.origin !== this.authServiceHost) {
      return;
    }

    const { data: tokenResponse } = event;
    this.handleTokenResponse(tokenResponse);
    this.emit(AuthEvent.SIGN_IN, tokenResponse);

    window.removeEventListener(AUTH_POPUP_MESSAGE_EVENT, this.handleAuthMessage);
  }

  private async mfaEnroll({ type }: AuthMfaEnrollOptions): Promise<AuthMfaEnrollResponse> {
    logger.logInfo(`Enrolling mfa type: ${type}`);

    try {
      const requestBody = {
        type
      };

      const response = await this.authServiceRequest<AuthMfaEnrollResponse>(
        AuthEndpoint.MFA_ENROLL,
        {
          method: HttpMethod.POST,
          body: JSON.stringify(requestBody),
          headers: {
            Authorization: `Bearer ${this.token}`
          }
        }
      );

      // this.emit(AuthEvent.PASSWORD_RESET, response);

      return response;
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }

  private async mfaChallenge({
    factorId
  }: AuthMfaChallengeOptions): Promise<AuthMfaChallengeResponse> {
    logger.logInfo(`Challenging mfa factor: ${factorId}`);

    try {
      const requestBody = {
        factorId
      };

      const response = await this.authServiceRequest<AuthMfaChallengeResponse>(
        AuthEndpoint.MFA_CHALLENGE,
        {
          method: HttpMethod.POST,
          body: JSON.stringify(requestBody),
          headers: {
            Authorization: `Bearer ${this.token}`
          }
        }
      );

      // this.emit(AuthEvent.PASSWORD_RESET, response);

      return response;
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }

  private async mfaVerify({
    factorId,
    challengeId,
    code
  }: AuthMfaVerifyOptions): Promise<TokenResponse> {
    logger.logInfo(`Verifying mfa challenge`);

    try {
      const requestBody = {
        factorId,
        challengeId,
        code
      };

      const response = await this.authServiceRequest<TokenResponse>(AuthEndpoint.MFA_VERIFY, {
        method: HttpMethod.POST,
        body: JSON.stringify(requestBody),
        headers: {
          Authorization: `Bearer ${this.token}`
        }
      });

      this.emit(AuthEvent.SIGN_IN, response);

      return this.handleTokenResponse(response);
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }
}
