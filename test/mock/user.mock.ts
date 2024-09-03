import { AuthUserPublic } from '../../lib/types';

export function getMockAuthUserPublic(opts: Partial<AuthUserPublic> = {}): AuthUserPublic {
  return {
    id: opts.id || 'user-id',
    clientId: opts.clientId || 'client-id',
    username: opts.username || 'username',
    createdAt: opts.createdAt || '2023-01-01T00:00:00.000Z',
    updatedAt: opts.updatedAt || '2023-01-01T00:00:00.000Z',
    orgId: opts.orgId || 'org-id',
    isOnline: opts.isOnline || true,
    lastOnline: opts.lastOnline || '2023-01-01T00:00:00.000Z'
  };
}
