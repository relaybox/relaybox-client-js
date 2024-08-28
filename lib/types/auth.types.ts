export interface AuthRequestOptions {
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

export type AuthParamsOrHeaders = Record<string, unknown> | (() => Record<string, unknown> | null);
export type AuthTokenLifeCycle = 'session' | 'expiry';
export interface AuthKeyData {
  apiKey: string;
  clientId?: string | number;
}

export enum AuthProvider {
  EMAIL = 'email',
  GITHUB = 'github',
  GOOGLE = 'google'
}

export interface AuthUser {
  id: string;
  clientId: string;
  username: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  provider: AuthProvider;
  providerId: string | null;
}
