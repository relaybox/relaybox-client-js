import { AuthParamsOrHeaders, AuthRequestOptions, AuthTokenLifeCycle } from './auth.types';

export interface RelayBoxOptions {
  authEndpoint?: string;
  apiKey?: string;
  authParams?: AuthParamsOrHeaders | null;
  clientId?: number | string;
  authHeaders?: AuthParamsOrHeaders | null;
  authRequestOptions?: AuthRequestOptions;
  authTokenLifeCycle?: AuthTokenLifeCycle;
}
