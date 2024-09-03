import EventEmitter from 'eventemitter3';
import { TokenError, ValidationError } from './errors';
import { logger } from './logger';
import { serviceRequest } from './request';
import { getItem, removeItem, setItem } from './storage';
import {
  AuthCreateOptions,
  AuthEvent,
  AuthEventAllowedValues,
  AuthEventHandler,
  AuthGetUserOptions,
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
  AuthSession,
  AuthSessionOptions,
  AuthSignInWithProviderOptions,
  AuthUser,
  AuthUserSession,
  AuthVerifyOptions,
  HttpMethod,
  ServiceResponseData,
  TokenResponse
} from './types';
import { StorageType } from './types/storage.types';
import { EventRegistry } from './event-registry';
import { User } from './user';
import { SocketManager } from './socket-manager';

const AUTH_SERVICE_PATHNAME = '/users';
export const REFRESH_TOKEN_KEY = 'rb:token:refresh';
const AUTH_POPUP_MESSAGE_EVENT = 'message';

const AUTH_TOKEN_REFRESH_BUFFER_SECONDS = 20;
const AUTH_TOKEN_REFRESH_RETRY_MS = 10000;
const AUTH_TOKEN_REFRESH_JITTER_RANGE_MS = 2000;

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
  MFA_VERIFY = '/mfa/verify',
  USER = '/'
}

export class Auth extends EventEmitter {
  private readonly publicKey: string | null;
  private readonly authServiceUrl: string;
  private readonly authServiceHost: string;
  private readonly eventRegistry = new EventRegistry();
  private readonly socketManager: SocketManager;
  private tmpToken: string | null = null;
  private refreshTimeout: NodeJS.Timeout | number | null = null;
  #authUserSession: AuthUserSession | null = null;
  mfa: AuthMfaApi;

  constructor(
    socketManager: SocketManager,
    publicKey: string | null,
    authServiceUrl: string,
    authServiceHost: string
  ) {
    super();
    this.publicKey = publicKey;
    this.authServiceUrl = authServiceUrl;
    this.authServiceHost = authServiceHost;
    this.socketManager = socketManager;

    this.mfa = {
      enroll: this.mfaEnroll.bind(this),
      challenge: this.mfaChallenge.bind(this),
      verify: this.mfaVerify.bind(this)
    };
  }

  get tokenResponse(): TokenResponse | null {
    if (!this.#authUserSession?.session) {
      return null;
    }

    const { token, expiresAt, expiresIn } = this.#authUserSession.session;

    return {
      token,
      expiresAt,
      expiresIn
    };
  }

  get token(): string | null {
    return this.#authUserSession?.session?.token || null;
  }

  get refreshToken(): string | null {
    return this.#authUserSession?.session?.refreshToken || null;
  }

  get user(): AuthUser | null {
    return this.#authUserSession?.user || null;
  }

  get session(): AuthSession | null {
    return this.#authUserSession?.session || null;
  }

  private async authServiceRequest<T>(
    endpoint: AuthEndpoint | string,
    params: RequestInit = {}
  ): Promise<T> {
    if (!this.publicKey) {
      throw new Error('Public key is required for auth');
    }

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
    removeItem(REFRESH_TOKEN_KEY, this.#authUserSession?.session?.authStorageType);
  }

  private handleAuthUserSessionResponse(authUserSessionData: AuthUserSession): AuthUserSession {
    if (authUserSessionData.session) {
      const { refreshToken, destroyAt, authStorageType, expiresIn } = authUserSessionData.session;

      this.setRefreshToken(refreshToken, destroyAt, authStorageType);
      this.setTokenRefreshTimeout(expiresIn);
    }

    const { tmpToken, ...appUserSessionData } = authUserSessionData;

    if (tmpToken) {
      this.tmpToken = tmpToken;
    }

    this.#authUserSession = appUserSessionData;

    return authUserSessionData;
  }

  private setTokenRefreshTimeout(expiresIn: number, retryMs?: number): void {
    const timeout = retryMs || (expiresIn - AUTH_TOKEN_REFRESH_BUFFER_SECONDS) * 1000;

    clearTimeout(this.refreshTimeout as number);

    this.refreshTimeout = setTimeout(async () => {
      try {
        await this.tokenRefresh();
      } catch (err) {
        const jitter =
          Math.floor(Math.random() * AUTH_TOKEN_REFRESH_JITTER_RANGE_MS) +
          AUTH_TOKEN_REFRESH_RETRY_MS;

        logger.logError(`Failed to refresh token...retrying in ${jitter}ms`, err);

        this.setTokenRefreshTimeout(0, jitter);
      }
    }, timeout);
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

  public async signIn({ email, password }: AuthLoginOptions): Promise<AuthUserSession> {
    logger.logInfo(`Logging in with email: ${email}`);

    try {
      const requestBody = {
        email,
        password
      };

      const response = await this.authServiceRequest<AuthUserSession>(AuthEndpoint.LOGIN, {
        method: HttpMethod.POST,
        body: JSON.stringify(requestBody)
      });

      const responseData = this.handleAuthUserSessionResponse(response);

      if (!response.session && response.user?.authMfaEnabled) {
        this.emit(AuthEvent.MFA_REQUIRED, response);
      } else {
        this.emit(AuthEvent.SIGN_IN, response);
      }

      return responseData;
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }

  public signOut(): void {
    this.removeRefreshToken();

    this.emit(AuthEvent.SIGN_OUT, this.user);
    this.#authUserSession = null;
  }

  public async tokenRefresh(): Promise<TokenResponse> {
    logger.logInfo(`Refreshing auth token`);

    if (!this.#authUserSession?.session) {
      throw new TokenError('Auth user session is not available');
    }

    try {
      const response = await this.authServiceRequest<TokenResponse>(AuthEndpoint.TOKEN_REFRESH, {
        method: HttpMethod.GET,
        headers: {
          Authorization: `Bearer ${this.refreshToken}`
        }
      });

      const refreshedAuthSession = {
        ...this.#authUserSession.session,
        ...response
      };

      this.#authUserSession.session = refreshedAuthSession;
      this.handleAuthUserSessionResponse(this.#authUserSession);
      this.emit(AuthEvent.TOKEN_REFRESH, response);

      return response;
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }

  public async getSession({
    verify = false
  }: AuthSessionOptions = {}): Promise<AuthUserSession | null> {
    logger.logInfo(`Getting auth session`);

    if (this.#authUserSession && !verify) {
      return this.#authUserSession;
    }

    try {
      const currentRefreshToken = this.getRefreshToken();

      if (!currentRefreshToken) {
        return null;
      }

      const response = await this.authServiceRequest<AuthUserSession>(AuthEndpoint.SESSION, {
        method: HttpMethod.GET,
        headers: {
          Authorization: `Bearer ${currentRefreshToken}`
        }
      });

      return this.handleAuthUserSessionResponse(response);
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

    window.addEventListener(AUTH_POPUP_MESSAGE_EVENT, this.handleOAuthMessageEvent.bind(this));
  }

  private handleOAuthMessageEvent(event: MessageEvent): void {
    if (event.origin !== this.authServiceHost) {
      return;
    }

    const { data: authUserSession } = event;
    const authUserSessionData = this.handleAuthUserSessionResponse(authUserSession);

    if (!authUserSessionData.session && authUserSessionData.user?.authMfaEnabled) {
      this.emit(AuthEvent.MFA_REQUIRED, authUserSessionData);
    } else {
      this.emit(AuthEvent.SIGN_IN, authUserSessionData);
    }

    window.removeEventListener(AUTH_POPUP_MESSAGE_EVENT, this.handleOAuthMessageEvent);
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

      this.tmpToken = response.tmpToken;

      return response;
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }

  private async mfaChallenge({ factorId }: AuthMfaChallengeOptions): Promise<{ verify: Function }> {
    logger.logInfo(`Challenging mfa factor: ${factorId}`);

    try {
      const requestBody = {
        factorId
      };

      const challenge = await this.authServiceRequest<AuthMfaChallengeResponse>(
        AuthEndpoint.MFA_CHALLENGE,
        {
          method: HttpMethod.POST,
          body: JSON.stringify(requestBody),
          headers: {
            Authorization: `Bearer ${this.tmpToken}`
          }
        }
      );

      return {
        verify: async ({ code }: AuthMfaVerifyOptions) => {
          return this.mfaVerify({ factorId, challengeId: challenge.id, code });
        }
      };
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }

  private async mfaVerify({
    factorId,
    challengeId,
    code,
    autoChallenge = false
  }: AuthMfaVerifyOptions): Promise<AuthUserSession> {
    logger.logInfo(`Verifying mfa challenge`);

    try {
      const requestBody = {
        factorId,
        challengeId,
        code,
        autoChallenge
      };

      const response = await this.authServiceRequest<AuthUserSession>(AuthEndpoint.MFA_VERIFY, {
        method: HttpMethod.POST,
        body: JSON.stringify(requestBody),
        headers: {
          Authorization: `Bearer ${this.tmpToken}`
        }
      });

      const responseData = this.handleAuthUserSessionResponse(response);

      this.emit(AuthEvent.SIGN_IN, response);

      return responseData;
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }

  async getUser({ clientId }: AuthGetUserOptions): Promise<User> {
    try {
      const endpoint = `/${clientId}`;

      const response = await this.authServiceRequest<AuthUser>(endpoint, {
        method: HttpMethod.GET,
        headers: {
          Authorization: `Bearer ${this.token}`
        }
      });

      return new User(
        this.socketManager,
        response.id,
        response.clientId,
        response.username,
        response.createdAt,
        response.updatedAt,
        response.orgId
      );
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }
}
