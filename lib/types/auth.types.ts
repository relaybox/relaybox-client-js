import { Auth } from '../auth';
import { ServiceResponseData, TokenResponse } from './request.types';
import { StorageType } from './storage.types';

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

export enum AuthMfaFactorType {
  TOTP = 'totp'
}

export interface AuthUserMfaFactor {
  id: string;
  type: AuthMfaFactorType;
  verifiedAt: Date;
}

export interface AuthUserPublic {
  id: string;
  clientId: string;
  orgId: string;
  username: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
  updatedAt: string;
  isOnline: boolean;
  lastOnline: string;
  identities: AuthUserIdentity[];
}

export interface AuthUser {
  id: string;
  orgId: string;
  clientId: string;
  username: string;
  firstName?: string;
  lastName?: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  verifiedAt: string;
  authMfaEnabled: boolean;
  identities: AuthUserIdentity[];
  factors: AuthUserMfaFactor[];
}

export interface AuthSession {
  token: string;
  expiresAt: number;
  expiresIn: number;
  destroyAt: number;
  refreshToken: string;
  authStorageType: StorageType;
}

export interface AuthUserSession {
  user: AuthUser;
  session: AuthSession | null;
  tmpToken?: string;
}

export enum AuthEvent {
  SIGN_UP = 'SIGN_UP',
  SIGN_IN = 'SIGN_IN',
  SIGN_OUT = 'SIGN_OUT',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  PASSWORD_RESET = 'PASSWORD_RESET',
  PASSWORD_CONFIRM = 'PASSWORD_CONFIRM',
  VERIFY = 'VERIFY',
  RESEND_VERIFICATION = 'RESEND_VERIFICATION',
  MFA_REQUIRED = 'MFA_REQUIRED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  GET_SESSION = 'GET_SESSION',
  MFA_ENROLL = 'MFA_ENROLL',
  MFA_CHALLENGE = 'MFA_CHALLENGE',
  ANONYMOUS_USER_CREATED = 'ANONYMOUS_USER_CREATED'
}

export type AuthEventAllowedValues =
  | 'SIGN_UP'
  | 'SIGN_IN'
  | 'SIGN_OUT'
  | 'TOKEN_REFRESH'
  | 'PASSWORD_RESET'
  | 'PASSWORD_CONFIRM'
  | 'VERIFY'
  | 'RESEND_VERIFICATION'
  | 'MFA_REQUIRED'
  | 'ANONYMOUS_USER_CREATED';

export type AuthEventHandler = (...args: any[]) => void;

export interface AuthMfaApi {
  enroll: (options: AuthMfaEnrollOptions) => Promise<AuthMfaEnrollResponse>;
  challenge: (options: AuthMfaChallengeOptions) => Promise<{ verify: Function }>;
  verify: (options: AuthMfaVerifyOptions) => Promise<AuthUserSession>;
}

export interface AuthLoginOptions {
  email: string;
  password: string;
}

export interface AuthCreateOptions {
  email: string;
  password: string;
  username?: string;
  firstName?: string;
  lastName?: string;
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

export interface AuthSessionOptions {
  verify?: boolean;
}

export interface AuthGetUserOptions {
  clientId: string;
}

export interface AuthMfaEnrollOptions {
  type: 'totp' | 'sms';
}

export interface AuthMfaChallengeOptions {
  factorId: string;
}

export interface AuthMfaVerifyOptions {
  factorId: string;
  challengeId?: string;
  code: string;
  autoChallenge?: boolean;
}

export interface AuthMfaEnrollResponse {
  id: string;
  type: string;
  secret: string;
  qrCodeUri: string;
  tmpToken: string;
}

export interface AuthMfaChallengeResponse {
  id: string;
  expiresAt: number;
}

export interface AuthUpdateStatusOptions {
  status: any;
}
