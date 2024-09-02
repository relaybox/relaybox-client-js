import { AuthSession, AuthUser, AuthUserSession } from '../../lib/types/auth.types';
import { StorageType } from '../../lib/types/storage.types';

export const defaultMockUser = {
  id: 'user-id',
  orgId: 'org-id',
  clientId: 'client-id',
  username: 'username',
  email: 'email@example.com',
  createdAt: '2023-01-01T00:00:00.000Z',
  updatedAt: '2023-01-01T00:00:00.000Z',
  verifiedAt: '2023-01-01T00:00:00.000Z',
  identities: [],
  factors: []
};

export const defaultMockSession: AuthSession = {
  token: 'auth-token',
  refreshToken: 'refresh-token',
  expiresIn: 30,
  expiresAt: 100,
  destroyAt: 100,
  authStorageType: StorageType.SESSION
};

export function getMockAuthUserSession(
  authMfaEnabled: boolean = false,
  withSession: boolean = true
): AuthUserSession {
  return {
    session: withSession ? defaultMockSession : null,
    user: {
      ...defaultMockUser,
      authMfaEnabled: authMfaEnabled
    }
  };
}

export const mockTokenRefreshResponse = {
  token: 'auth-token-refresh',
  expiresIn: 30,
  expiresAt: 100
};

export const mockAuthMfaEnrollResponse = {
  id: 'mfa-factor-id',
  type: 'totp',
  secret: 'mfa-secret',
  qrCode: 'mfa-qr-code',
  tmpToken: 'mfa-tmp-token'
};
