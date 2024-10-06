import { AuthParamsOrHeaders, AuthRequestOptions, AuthTokenLifeCycle } from './auth.types';
import { TokenResponse } from './request.types';

export interface OfflineOptions {
  /**
   * https://relaybox.net/docs/api-reference/relaybox-client#relaybox-options
   *
   * Specify the offline emulator port number. Defauls to 9000.
   */
  port?: number;
  /**
   * https://relaybox.net/docs/api-reference/relaybox-client#relaybox-options
   *
   * Enable offline mode with default settings.
   */
  enabled?: boolean;
  /**
   * https://relaybox.net/docs/api-reference/relaybox-client#relaybox-options
   *
   * Specify an override url for the auth service. This is useful for testing or when using relayBox platform emulator.
   * Defaults to wss://auth.prod.relaybox-services.net
   */
  authServiceUrl?: string | null;
  /**
   * https://relaybox.net/docs/api-reference/relaybox-client#relaybox-options
   *
   * Specify an override url for the core service. This is useful for testing or when using relayBox platform emulator.
   * Defaults to wss://gnet.prod.relaybox-services.net
   */
  coreServiceUrl?: string | null;
}

export interface RelayBoxOptions {
  /**
   * https://relaybox.net/docs/api-reference/relaybox-client#relaybox-options
   *
   * Specify the URL of the endpoint that the client should call to obtain an authentication token, enabling connection to your application. For example, use /user/auth. This endpoint is tasked with issuing a signed token, which is generated using the @relaybox/rest library.
   *
   */
  authEndpoint?: string;
  /**
   * https://relaybox.net/docs/api-reference/relaybox-client#relaybox-options
   *
   * Associate an API key with the connection, which you can generate via the dashboard. To create an API key, first register for a free account. While API keys allow connection to Relaybox services, using authentication tokens is advisable for enhanced security.
   */
  apiKey?: string;
  /**
   * https://relaybox.net/docs/api-reference/relaybox-client#relaybox-options
   *
   * Used in conjunction with the authEndpoint or authActionto send additional data with the authentication token request through URL query parameters or function arguments. For example, /auth/user?id=123. The value can be either an object or a function that returns an object.
   */
  authParams?: AuthParamsOrHeaders | null;
  /**
   * https://relaybox.net/docs/api-reference/relaybox-client#relaybox-options
   *
   * Include a clientId to associate an identity with the connection. You must provide a clientId for the connection to participate in a room's presence set.
   */
  clientId?: number | string;
  /**
   * https://relaybox.net/docs/api-reference/relaybox-client#relaybox-options
   *
   * This is used alongside the authEndpoint to include additional data within the request headers when obtaining an authentication token response.
   */
  authHeaders?: AuthParamsOrHeaders | null;
  /**
   * https://relaybox.net/docs/api-reference/relaybox-client#relaybox-options
   *
   * Options for the JavaScript Fetch API that are sent along with the authentication token request.
   */
  authRequestOptions?: AuthRequestOptions;
  /**
   * https://relaybox.net/docs/api-reference/relaybox-client#relaybox-options
   *
   * When set to 'expiry', the token will be refreshed upon expiration, and the connection will be re-established with the new token. When set to 'session', the authentication token will remain valid for the duration of the session and will only be refreshed upon establishing a new connection if the token has expired.
   */
  authTokenLifeCycle?: AuthTokenLifeCycle;
  /**
   *
   * Specify a server action that returns a token response. Aimed at NextJS integrations using App Router server actions. Send additional data as an optional argument using the authParams option. The server action is tasked with issuing a signed token, which is generated using the @relaybox/rest library.
   * @param params - Additional data to be sent with the authentication token request.
   */
  authAction?: (params?: any) => Promise<TokenResponse>;
  /**
   * https://relaybox.net/docs/api-reference/relaybox-client#relaybox-options
   *
   * Specify your application's public key, which will be used to identify requests to the live authentication service. A public key is required to use the authentication service.
   */
  publicKey?: string;
  // /**
  //  * https://relaybox.net/docs/api-reference/relaybox-client#relaybox-options
  //  *
  //  * Specify the offline emulator options. This is useful for testing or when using relayBox platform emulator.
  //  */
  offline?: OfflineOptions;
}
