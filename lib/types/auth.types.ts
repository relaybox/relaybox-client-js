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

export type AuthProviderOptions = `${AuthProvider}`;

export interface AuthUserIdentity {
  id: string;
  provider: AuthProvider;
  providerId: string | null;
  verifiedAt: Date;
}

export interface AuthUser {
  id: string;
  orgId: string;
  clientId: string;
  username?: string;
  email?: string;
  createdAt?: string;
  updatedAt?: string;
  identities: AuthUserIdentity[];
}

export enum AuthEvent {
  SIGN_UP = 'SIGN_UP',
  SIGN_IN = 'SIGN_IN',
  SIGN_OUT = 'SIGN_OUT',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  PASSWORD_RESET = 'PASSWORD_RESET',
  PASSWORD_CONFIRM = 'PASSWORD_CONFIRM',
  VERIFY = 'VERIFY',
  RESEND_VERIFICATION = 'RESEND_VERIFICATION'
}

export type AuthEventAllowedValues =
  | 'SIGN_UP'
  | 'SIGN_IN'
  | 'SIGN_OUT'
  | 'TOKEN_REFRESH'
  | 'PASSWORD_RESET'
  | 'PASSWORD_CONFIRM'
  | 'VERIFY'
  | 'RESEND_VERIFICATION';

export type AuthEventHandler = (...args: any[]) => void;

export interface AuthLoginOptions {
  email: string;
  password: string;
}

export interface AuthCreateOptions {
  email: string;
  password: string;
}

export interface AuthVerifyOptions {
  email: string;
  code: string;
}

export interface AuthPasswordResetOptions {
  email: string;
}

export interface AuthResendVerificationOptions {
  email: string;
}

export interface AuthPasswordConfirmOptions {
  email: string;
  password: string;
  code: string;
}

export interface AuthSignInWithProviderOptions {
  provider: AuthProviderOptions;
  popup?: boolean;
  width?: number;
  height?: number;
}
