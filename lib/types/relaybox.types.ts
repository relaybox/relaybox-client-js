import { AuthParamsOrHeaders, AuthRequestOptions } from './auth.types';

export interface RelayboxOptions {
  authEndpoint?: string;
  apiKey?: string;
  authParams?: AuthParamsOrHeaders | null;
  clientId?: number | string;
  authHeaders?: AuthParamsOrHeaders | null;
  authRequestOptions?: AuthRequestOptions;
}

// export interface TokenResponse {
//   token: string;
//   expiresIn: number;
// }

export interface KeyData {
  apiKey: string;
  clientId?: string | number;
}
