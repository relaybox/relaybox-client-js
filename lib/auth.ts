import EventEmitter from 'eventemitter3';
import { TokenError, ValidationError } from './errors';
import { logger } from './logger';
import { serviceRequest } from './request';
import {
  AuthCreateOptions,
  AuthEvent,
  AuthEventAllowedValues,
  AuthEventHandler,
  AuthGenerateSignInCodeOptions,
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
  AuthUpdateStatusOptions,
  AuthUser,
  AuthUserPublic,
  AuthUserSession,
  AuthVerifyOptions,
  ClientEvent,
  HttpMethod,
  ServiceResponseData,
  TokenResponse
} from './types';
import { User } from './user';
import { SocketManager } from './socket-manager';
import {
  PKCE_REDIRECT_URI_KEY,
  PKCE_STATE_KEY,
  PKCE_VERIFIER_KEY,
  generatePkcePair,
  generateRandomString
} from './pkce';

const AUTH_POPUP_MESSAGE_EVENT = 'message';
const AUTH_TOKEN_REFRESH_BUFFER_SECONDS = 20;
const AUTH_TOKEN_REFRESH_RETRY_MS = 10000;
const AUTH_TOKEN_REFRESH_JITTER_RANGE_MS = 2000;

enum OAuthEndpoint {
  AUTHORIZE = '/authorize',
  TOKEN = '/token',
  LOGOUT = '/logout'
}

enum AuthEndpoint {
  ANONYMOUS = `/anonymous`,
  GENERATE_VERIFICATION_CODE = '/generate-verification-code',
  GENERATE_SIGN_IN_CODE = '/generate-sign-in-code',
  MFA_CHALLENGE = '/mfa/challenge',
  MFA_ENROLL = '/mfa/enroll',
  MFA_VERIFY = '/mfa/verify',
  PASSWORD_CONFIRM = '/password-confirm',
  PASSWORD_RESET = '/password-reset',
  SIGN_UP = `/sign-up`,
  SIGN_IN = `/sign-in`,
  SESSION = '/session',
  TOKEN_REFRESH = '/token/refresh',
  VERIFY = `/verify`
}

/**
 * The `Auth` class handles user authentication, session management, and multi-factor authentication (MFA).
 * It provides methods for signing up, logging in, refreshing tokens, and managing user sessions.
 * The class also supports OAuth provider login and event-driven interactions using the `EventEmitter` API.
 *
 * @extends EventEmitter
 */
export class Auth extends EventEmitter {
  public readonly enabled: boolean;
  private tmpToken: string | null = null;
  private refreshTimeout: NodeJS.Timeout | number | null = null;
  #authUserSession: AuthUserSession | null = null;
  mfa: AuthMfaApi;

  /**
   * Initializes a new instance of the `Auth` class.
   * Sets up multi-factor authentication (MFA) API methods and configures the authentication service.
   *
   * @param {SocketManager} socketManager - An instance of `SocketManager` for handling socket connections.
   * @param {string | null} publicKey - The public key for authenticating API requests. Required for authorization.
   * @param {string} authServiceUrl - The base URL for the authentication service (e.g., API server).
   * @param {string} redirectUri - PKCE redirect uri.
   *
   */

  constructor(
    private readonly socketManager: SocketManager,
    private readonly publicKey: string | null,
    private readonly authServiceUrl: string,
    private readonly redirectUri?: string
  ) {
    super();

    this.enabled = !!publicKey;

    this.mfa = {
      enroll: this.mfaEnroll.bind(this),
      challenge: this.mfaChallenge.bind(this),
      verify: this.mfaVerify.bind(this)
    };
  }

  /**
   * Retrieves the current token response if an authenticated session exists.
   * Provides details such as the token, expiration time, and remaining duration.
   *
   * @returns {TokenResponse | null} The current token response or null if the session is not authenticated.
   */

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

  /**
   * Retrieves the current authentication token from the session, if available.
   *
   * @returns {string | null} The authentication token or null if not authenticated.
   */
  get token(): string | null {
    return this.#authUserSession?.session?.token || null;
  }

  /**
   * Retrieves the authenticated user's information from the current session.
   *
   * @returns {AuthUser | null} The authenticated user object or null if not authenticated.
   */
  get user(): AuthUser | null {
    return this.#authUserSession?.user || null;
  }

  /**
   * Retrieves the current authentication session details, such as tokens and expiration times.
   *
   * @returns {AuthSession | null} The current session object or null if no active session exists.
   */
  get session(): AuthSession | null {
    return this.#authUserSession?.session || null;
  }

  /**
   * Makes a request to the authentication service using a specified endpoint and request parameters.
   * Automatically includes the necessary authorization headers if the public key is provided.
   *
   * @template T
   * @param {AuthEndpoint | string} endpoint - The authentication service endpoint to target.
   * @param {RequestInit} [params={}] - The request options, such as method, headers, and body content.
   * @returns {Promise<T>} A promise that resolves with the service's response.
   * @throws Will throw an error if the public key is missing or the request fails.
   */

  private async authServiceRequest<T>(
    endpoint: AuthEndpoint | string,
    params: RequestInit = {}
  ): Promise<T> {
    if (!this.publicKey) {
      throw new Error('Public key is required for auth');
    }

    const requestUrl = `${this.authServiceUrl}${endpoint}`;

    const defaultHeaders = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Ds-Public-Key': this.publicKey
    };

    params.headers = {
      ...defaultHeaders,
      ...(params?.headers || {})
    };

    const response = await serviceRequest<T>(requestUrl, params);

    return response;
  }

  /**
   * Handles and processes the response from the authentication service that contains the user's session data.
   * Stores the session, refresh token, and sets a timeout for token refresh based on expiration time.
   *
   * @param {AuthUserSession} authUserSessionData - The session data returned by the authentication service.
   * @returns {AuthUserSession} The processed session data.
   */
  private handleAuthUserSessionResponse(authUserSessionData: AuthUserSession): AuthUserSession {
    if (authUserSessionData.session) {
      const { expiresIn } = authUserSessionData.session;

      this.setTokenRefreshTimeout(expiresIn);
    }

    const { tmpToken, ...appUserSessionData } = authUserSessionData;

    if (tmpToken) {
      this.tmpToken = tmpToken;
    }

    this.#authUserSession = appUserSessionData;

    return authUserSessionData;
  }

  /**
   * Sets a timeout for refreshing the authentication token before it expires.
   * The method ensures that the token is refreshed within a safe buffer period.
   *
   * @param {number} expiresIn - The number of seconds before the token expires.
   * @param {number} [retryMs] - Optional retry delay (in milliseconds) in case the token refresh fails.
   */
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

  // ------------- START NEW PKCE FUNCTIONS ---------------------

  /**
   * Initiates the PKCE Authorization Code Flow.
   * This method prepares PKCE parameters and redirects the browser to the
   * auth server's /authorize endpoint.
   * @param options Optional parameters for the authorization request.
   * @param options.loginHint Optional hint to the auth server about the user's login identifier.
   * @param options.prompt Optional: 'none', 'login', 'consent', 'select_account'.
   * @param options.appState Optional: Any state your application wants to persist through the redirect and make available in the callback.
   */
  public async initiatePkceAuthFlow(options?: {
    loginHint?: string;
    prompt?: 'none' | 'login' | 'consent' | 'select_account';
    appState?: any;
  }): Promise<void> {
    if (!this.redirectUri) {
      throw new Error('Auth SDK not enabled (publicKey/clientId missing).');
    }

    logger.logInfo('Initiating PKCE Authorization Code Flow...');

    const { verifier, challenge } = await generatePkcePair();

    const state = generateRandomString(32);

    // Store PKCE parameters and appState in localStorage
    // The appState can be used to redirect the user back to their original location
    // or pass any other context through the authentication flow.
    const stateToStore: any = { state };

    if (options?.appState) {
      stateToStore.appState = options.appState;
    }

    localStorage.setItem(PKCE_STATE_KEY, JSON.stringify(stateToStore));
    localStorage.setItem(PKCE_VERIFIER_KEY, verifier);
    localStorage.setItem(PKCE_REDIRECT_URI_KEY, this.redirectUri);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.publicKey ?? '',
      redirect_uri: this.redirectUri,
      // scope: this.scopes.join(' '),
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state
    });

    if (options?.loginHint) {
      params.append('login_hint', options.loginHint);
    }

    if (options?.prompt) {
      params.append('prompt', options.prompt);
    }

    const authorizeUrl = `${this.authServiceUrl}${OAuthEndpoint.AUTHORIZE}?${params.toString()}`;

    logger.logInfo(`Redirecting to: ${authorizeUrl}`);

    window.location.href = authorizeUrl;
  }

  /**
   * Handles the redirect back from the auth server after user authentication.
   * This method should be called on the page specified as the `redirect_uri`.
   * It parses the authorization code and state, then exchanges the code for tokens.
   * @param url The URL of the callback page, defaults to window.location.href.
   * @returns A Promise that resolves with the AuthUserSession.
   */
  public async handleRedirectCallback(
    url: string = window.location.href
  ): Promise<AuthUserSession> {
    if (!this.enabled) {
      throw new Error('Auth SDK not enabled (publicKey/clientId missing).');
    }

    logger.logInfo(`Handling redirect callback from: ${url}`);

    const params = new URLSearchParams(new URL(url).search);
    const code = params.get('code');
    const incomingStateString = params.get('state'); // This is the raw state string
    const error = params.get('error');

    // Clear the PKCE params from the URL in the browser history for cleanliness and security
    window.history.replaceState({}, document.title, window.location.pathname);

    if (error) {
      const errorDescription = params.get('error_description') || 'Error during OAuth redirect.';
      logger.logError(`OAuth error in callback: ${error} - ${errorDescription}`);
      throw new TokenError(errorDescription, error);
    }

    const storedStateJSON = localStorage.getItem(PKCE_STATE_KEY);
    const storedVerifier = localStorage.getItem(PKCE_VERIFIER_KEY);
    const storedRedirectUri = localStorage.getItem(PKCE_REDIRECT_URI_KEY);

    localStorage.removeItem(PKCE_STATE_KEY);
    localStorage.removeItem(PKCE_VERIFIER_KEY);
    localStorage.removeItem(PKCE_REDIRECT_URI_KEY);

    if (!code) {
      throw new TokenError('No authorization code found in callback URL.');
    }

    if (!storedStateJSON) {
      throw new TokenError('No PKCE state found in storage. Possible tampering or timeout.');
    }

    if (!storedVerifier) {
      throw new TokenError('No PKCE code verifier found in storage.');
    }

    if (!storedRedirectUri || storedRedirectUri !== this.redirectUri) {
      throw new TokenError(
        'Stored redirect URI does not match current configuration or is missing.'
      );
    }

    const storedStateObject = JSON.parse(storedStateJSON);

    if (storedStateObject.state !== incomingStateString) {
      throw new TokenError('State mismatch after redirect. Possible CSRF attack.');
    }

    // Prepare to exchange the code for tokens
    const tokenRequestParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: this.redirectUri,
      client_id: this.publicKey ?? '',
      code_verifier: storedVerifier
    });

    try {
      logger.logInfo('Exchanging authorization code for tokens...');

      await this.authServiceRequest(`${this.authServiceUrl}${OAuthEndpoint.TOKEN}`, {
        method: HttpMethod.POST,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: tokenRequestParams
      });

      logger.logInfo('Successfully exchanged code for tokens.');

      const authUserSession = await this.getSession({ verify: true }); // Pass appState if needed

      if (!authUserSession) {
        // This would be unexpected if /token succeeded and was supposed to establish a cookie session
        throw new TokenError('Failed to retrieve session after successful PKCE token exchange.');
      }

      return authUserSession;
    } catch (err: any) {
      logger.logError('Unexpected error during token exchange:', err.message);
      throw err;
    }
  }

  //  ------------- END NEW PKCE FUNCTIONS ----------------------

  /**
   * Registers a new user by signing them up with an email and password.
   * Emits the `SIGN_UP` event upon successful user creation.
   *
   * @param {AuthCreateOptions} options - The user signup options containing the email and password.
   * @returns {Promise<ServiceResponseData>} The service's response data after user creation.
   * @throws Will throw an error if the signup process fails.
   */
  public async signUp({
    email,
    password,
    username,
    firstName,
    lastName
  }: AuthCreateOptions): Promise<ServiceResponseData> {
    logger.logInfo(`Creating user with email: ${email}`);

    try {
      const requestBody = {
        email,
        password,
        username,
        firstName,
        lastName
      };

      const response = await this.authServiceRequest<ServiceResponseData>(AuthEndpoint.SIGN_UP, {
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

  /**
   * Verifies a user's email by sending a verification code.
   * The method is typically called after user signup.
   * Emits the `VERIFY` event upon successful verification.
   *
   * @param {AuthVerifyOptions} options - The verification options, including the user's email and verification code.
   * @returns {Promise<ServiceResponseData>} The service response after successful verification.
   * @throws Will throw an error if the verification process fails.
   */
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

  /**
   * Resends the verification email to the user if they haven't completed the initial email verification.
   * Emits the `RESEND_VERIFICATION` event upon successfully resending the email.
   *
   * @param {AuthResendVerificationOptions} options - The resend options, which include the user's email.
   * @returns {Promise<ServiceResponseData>} The service response after resending the verification email.
   * @throws Will throw an error if the resend process fails.
   */
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

  /**
   * Generates a one-time sign-in code for the user to authenticate with.
   *
   * @param {AuthGenerateSignInCodeOptions} options - The sign-in code options, which include the user's email.
   * @returns {Promise<ServiceResponseData>} The service response after generating the sign-in code.
   * @throws Will throw an error if the sign-in code generation fails.
   */
  public async generateSignInCode({
    email
  }: AuthGenerateSignInCodeOptions): Promise<ServiceResponseData> {
    logger.logInfo(`Generating sign-in code for email: ${email}`);

    try {
      const requestBody = {
        email
      };

      const response = await this.authServiceRequest<ServiceResponseData>(
        AuthEndpoint.GENERATE_SIGN_IN_CODE,
        {
          method: HttpMethod.POST,
          body: JSON.stringify(requestBody)
        }
      );

      return response;
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }

  /**
   * Authenticates a user by logging them in with their email and password.
   * Processes the session and emits events depending on the outcome (e.g., `SIGN_IN`, `MFA_REQUIRED`).
   *
   * @param {AuthLoginOptions} options - The login options, including email and password.
   * @returns {Promise<AuthUserSession>} The authenticated user's session data.
   * @throws Will throw an error if the login process fails.
   */
  // public async signIn({ email, password, code }: AuthLoginOptions): Promise<AuthUserSession> {
  public async signIn({ email, password, code }: AuthLoginOptions): Promise<void> {
    logger.logInfo(`Logging in with email: ${email}`);

    if (!password && !code) {
      throw new Error('Password or one-time pass code is required');
    }

    try {
      const requestBody = {
        email,
        ...(password && { password }),
        ...(code && { code })
      };

      const response = await this.authServiceRequest<AuthUserSession>(AuthEndpoint.SIGN_IN, {
        method: HttpMethod.POST,
        body: JSON.stringify(requestBody),
        credentials: 'include'
      });

      await this.initiatePkceAuthFlow({
        loginHint: email,
        prompt: 'none'
      });

      // const responseData = this.handleAuthUserSessionResponse(response);

      // if (!response.session && response.user?.authMfaEnabled) {
      //   this.emit(AuthEvent.MFA_REQUIRED, response);
      // } else {
      //   this.emit(AuthEvent.SIGN_IN, response);
      // }

      // return responseData;
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }

  /**
   * Signs the user out by removing the refresh token, clearing the session, and disconnecting the socket.
   * Emits the `SIGN_OUT` event when the user is successfully signed out.
   */
  public signOut(): void {
    clearTimeout(this.refreshTimeout as number);
    this.emit(AuthEvent.SIGN_OUT, this.user);
    this.#authUserSession = null;
    this.socketManager.disconnectSocket();
  }

  /**
   * Refreshes the authentication token using the stored refresh token.
   * Emits the `TOKEN_REFRESH` event when the token is successfully refreshed.
   *
   * @returns {Promise<TokenResponse>} The new token response with updated expiration details.
   * @throws Will throw an error if the refresh token is invalid or the refresh request fails.
   */
  public async tokenRefresh(): Promise<TokenResponse | undefined> {
    logger.logInfo(`Refreshing auth token`);

    if (!this.#authUserSession?.session) {
      throw new TokenError('Auth user session is not available');
    }

    try {
      const response = await this.authServiceRequest<TokenResponse>(AuthEndpoint.TOKEN_REFRESH, {
        method: HttpMethod.GET,
        credentials: 'include'
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

      if (err.name === 'TokenExpiredError') {
        this.emit(AuthEvent.SESSION_EXPIRED, err);
        this.signOut();
        return;
      }

      throw err;
    }
  }

  /**
   * Retrieves the current session for the authenticated user.
   * If the `verify` option is set, it verifies the session with the authentication service.
   * Emits session-related events upon success.
   *
   * @param {AuthSessionOptions} [options={}] - Optional session retrieval and verification parameters.
   * @returns {Promise<AuthUserSession | null>} The current session data or null if no active session exists.
   * @throws Will throw an error if the session cannot be retrieved.
   */
  public async getSession({
    verify = false
  }: AuthSessionOptions = {}): Promise<AuthUserSession | null> {
    logger.logInfo(`Getting auth session`);

    if (this.#authUserSession && !verify) {
      return this.#authUserSession;
    }

    try {
      const response = await this.authServiceRequest<AuthUserSession>(AuthEndpoint.SESSION, {
        method: HttpMethod.GET,
        credentials: 'include'
      });

      this.emit(AuthEvent.GET_SESSION, response);

      return this.handleAuthUserSessionResponse(response);
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }

  /**
   * Initiates a password reset process by sending a password reset email to the specified address.
   * Emits the `PASSWORD_RESET` event upon successfully sending the reset email.
   *
   * @param {AuthPasswordResetOptions} options - The password reset options, including the user's email.
   * @returns {Promise<ServiceResponseData>} The service response after initiating the password reset.
   * @throws Will throw an error if the password reset request fails.
   */
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

  /**
   * Confirms a password reset by verifying the reset code and updating the user's password.
   * Emits the `PASSWORD_CONFIRM` event upon successfully resetting the password.
   *
   * @param {AuthPasswordConfirmOptions} options - The password confirm options, including email, password, and code.
   * @returns {Promise<ServiceResponseData>} The service response after successfully resetting the password.
   * @throws Will throw an error if the confirmation fails.
   */
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

  /**
   * Registers an event handler for a specific authentication event.
   *
   * @param {AuthEventAllowedValues} event - The name of the authentication event to listen for.
   * @param {AuthEventHandler} handler - The callback function to handle the event.
   */
  public onAuthEvent(event: AuthEventAllowedValues, handler: AuthEventHandler): void {
    this.on(event, handler);
  }

  /**
   * Initiates a sign-in process using an OAuth provider (e.g., Google, Facebook).
   * Opens a popup window for the user to complete the OAuth flow and listens for authentication events.
   *
   * @param {AuthSignInWithProviderOptions} options - The OAuth provider options, including provider name, window size, etc.
   * @returns {Promise<void>} Resolves when the OAuth sign-in process is complete.
   */
  public async signInWithOauth({
    provider,
    popup = true,
    width = 450,
    height = 600
  }: AuthSignInWithProviderOptions): Promise<void> {
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    window.open(
      `${this.authServiceUrl}/idp/${provider}/authorize?publicKey=${this.publicKey}`,
      'popup',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    window.addEventListener(AUTH_POPUP_MESSAGE_EVENT, this.handleOAuthMessageEvent.bind(this));
  }

  /**
   * Handles the OAuth message event after a successful OAuth sign-in.
   * Processes the received user session data and emits appropriate events.
   *
   * @param {MessageEvent} event - The OAuth message event containing the user's session data.
   */
  private handleOAuthMessageEvent(event: MessageEvent): void {
    if (event.origin !== this.getOrigin(this.authServiceUrl)) {
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

  private getOrigin(path: string): string {
    const url = new URL(path);
    return url.origin;
  }

  /**
   * Enrolls the user in multi-factor authentication (MFA) using the specified type (e.g., SMS, email).
   * Returns a temporary token required for completing the MFA process.
   *
   * @param {AuthMfaEnrollOptions} options - The MFA enrollment options, including the type of MFA.
   * @returns {Promise<AuthMfaEnrollResponse>} The MFA enrollment response, including a temporary token.
   * @throws Will throw an error if the MFA enrollment fails.
   */
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

      this.emit(AuthEvent.MFA_ENROLL, response);

      return response;
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }

  /**
   * Initiates an MFA challenge by sending a challenge request for a specific factor (e.g., SMS code).
   * Returns a verification function that can be used to complete the MFA challenge.
   *
   * @param {AuthMfaChallengeOptions} options - The MFA challenge options, including the factor ID.
   * @returns {Promise<{ verify: Function }>} An object containing the `verify` function to complete the MFA process.
   * @throws Will throw an error if the MFA challenge request fails.
   */
  private async mfaChallenge({
    factorId
  }: AuthMfaChallengeOptions): Promise<{ id: string; verify: Function }> {
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

      this.emit(AuthEvent.MFA_CHALLENGE, challenge);

      return {
        id: challenge.id,
        verify: async ({ code }: AuthMfaVerifyOptions) => {
          return this.mfaVerify({ factorId, challengeId: challenge.id, code });
        }
      };
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }

  /**
   * Verifies the MFA challenge by submitting the user's verification code and completing the authentication process.
   * Emits the `SIGN_IN` event if the MFA verification is successful.
   *
   * @param {AuthMfaVerifyOptions} options - The MFA verification options, including factor ID, challenge ID, and code.
   * @returns {Promise<AuthUserSession>} The updated user session after successful MFA verification.
   * @throws Will throw an error if the MFA verification fails.
   */
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

  /**
   * Retrieves public information about a specific user by client ID.
   * Requires authentication to access user data.
   *
   * @param {AuthGetUserOptions} options - The options for retrieving the user, including the client ID.
   * @returns {Promise<User>} The user information wrapped in a `User` object.
   * @throws Will throw an error if the request fails or the user cannot be found.
   */
  async getUser({ clientId }: AuthGetUserOptions): Promise<User> {
    try {
      const endpoint = `/users/${clientId}`;

      const user = await this.authServiceRequest<AuthUserPublic>(endpoint, {
        method: HttpMethod.GET,
        headers: {
          Authorization: `Bearer ${this.token}`
        }
      });

      return new User(this.socketManager, user);
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }

  /**
   * Updates the authenticated user's status (e.g., online, offline) and emits a socket event to notify other clients.
   *
   * @param {AuthUpdateStatusOptions} options - The status update options, including the new status.
   * @returns {Promise<unknown>} Resolves when the status update is successful.
   * @throws Will throw an error if the status update fails.
   */
  async updateStatus({ status }: AuthUpdateStatusOptions): Promise<unknown> {
    try {
      if (!status) {
        throw new ValidationError('No status provided');
      }

      const res = await this.socketManager.emitWithAck(ClientEvent.AUTH_USER_STATUS_UPDATE, {
        status,
        event: 'user:status:update'
      });

      return res;
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }

  /**
   * Creates an anonymous user and authenticates them.
   * Emits the `SIGN_IN` event upon successful user creation.
   *
   * @returns {Promise<AuthUserSession>} The authenticated user's session data.
   * @throws Will throw an error if the login process fails.
   */
  public async createAnonymousUser(): Promise<AuthUserSession> {
    logger.logInfo(`Creating anonymous user`);

    try {
      const response = await this.authServiceRequest<AuthUserSession>(AuthEndpoint.ANONYMOUS, {
        method: HttpMethod.POST
      });

      const responseData = this.handleAuthUserSessionResponse(response);

      this.emit(AuthEvent.ANONYMOUS_USER_CREATED, response);

      return responseData;
    } catch (err: any) {
      logger.logError(err.message, err);
      throw err;
    }
  }
}
