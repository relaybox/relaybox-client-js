import { AuthUser } from './auth.types';
import { StorageType } from './storage.types';

export interface ApiData {
  message?: string;
}

export interface ServiceData {
  message?: string;
}

export interface FormattedResponse<T = any> {
  status: number;
  data?: T;
  message?: string;
}

export interface TokenResponse {
  token: string;
  expiresIn: number;
  refreshToken?: string;
  expiresAt?: number;
  destroyAt?: number;
  user?: AuthUser;
  authStorageType?: StorageType;
}

export interface KeyData {
  apiKey: string;
  clientId?: string | number;
}

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST'
}

export enum HttpMode {
  CORS = 'cors',
  NAVIGATE = 'navigate',
  NO_CORS = 'no-cors',
  SAME_ORIGIN = 'same-origin',
  STRICT_ORIGIN = 'strict-origin',
  STRICT_ORIGIN_WHEN_CROSS_ORIGIN = 'strict-origin-when-cross-origin',
  UNSAFE_URL = 'unsafe-url'
}
