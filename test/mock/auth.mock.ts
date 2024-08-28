import { StorageType } from '../../lib/types/storage.types';

export const mockUserData = {
  id: 'user-id',
  clientId: 'client-id',
  username: 'username',
  email: 'email@example.com',
  createdAt: '2023-01-01T00:00:00.000Z',
  updatedAt: '2023-01-01T00:00:00.000Z',
  provider: 'email',
  providerId: 'provider-id'
};

export const mockTokenResponse = {
  token: 'auth-token',
  refreshToken: 'refresh-token',
  expiresIn: 30,
  destroyAt: 100,
  authStorageType: StorageType.SESSION,
  user: mockUserData
};
