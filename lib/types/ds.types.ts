export interface DsAuthRequestOptions {
  method?: 'GET' | 'POST';
  mode?: 'cors' | 'navigate' | 'no-cors' | 'same-origin' | null;
  credentials?: 'include' | 'omit' | 'same-origin' | null;
  cache?: 'no-cache' | 'reload' | 'force-cache' | 'only-if-cached' | null;
  redirect?: 'follow' | 'manual' | 'error' | null;
  referrerPolicy?:
    | 'no-referrer'
    | 'no-referrer-when-downgrade'
    | 'origin'
    | 'origin-when-cross-origin'
    | 'same-origin'
    | 'strict-origin'
    | 'strict-origin-when-cross-origin'
    | 'unsafe-url'
    | null;
  body?: string;
}

type AuthParamsOrHeaders = Record<string, unknown> | (() => Record<string, unknown> | null);

export interface DsConfig {
  authEndpoint?: string;
  apiKey?: string;
  authParams?: AuthParamsOrHeaders | null;
  clientId?: number | string;
  authHeaders?: AuthParamsOrHeaders | null;
  authRequestOptions?: DsAuthRequestOptions;
}

export interface DsTokenResponse {
  token: string;
  expiresIn: number;
}

export interface DsKeyData {
  apiKey: string;
  clientId?: string | number;
}
