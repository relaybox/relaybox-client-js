import { Auth } from '../lib/auth';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SocketManager } from '../lib/socket-manager';
import { setupServer } from 'msw/node';
import { HttpResponse, http } from 'msw';
import { ValidationError } from '../lib/errors';
import { mockUserData } from './mock/auth.mock';
import { setItem, removeItem, getItem } from '../lib/storage';
import { StorageType } from '../lib/types/storage.types';

const mockPublicKey = 'appId.keyId';
const mockRbAuthAuthServiceHost = 'http://localhost:4005/dev';
const mockAuthEmail = '1@1.com';
const mockAuthPassword = 'password';
const mockAuthCode = '123456';

const server = setupServer();

interface AuthRequestBody {
  email?: string;
  password?: string;
  code?: string;
}

vi.mock('../lib/logger', () => ({
  logger: {
    logInfo: vi.fn(),
    logError: vi.fn()
  }
}));

vi.mock('../lib/storage', () => {
  const setItem = vi.fn();
  const removeItem = vi.fn();
  const getItem = vi.fn();

  return {
    setItem,
    removeItem,
    getItem
  };
});

const socketManagerEmitWithAck = vi.fn();

vi.mock('../lib/socket-manager', () => ({
  SocketManager: vi.fn(() => ({
    emitWithAck: socketManagerEmitWithAck
  }))
}));

describe('Auth', () => {
  let auth: Auth;
  let socketManager: SocketManager;

  beforeEach(() => {
    server.listen();
    socketManager = new SocketManager();
    auth = new Auth(socketManager, mockPublicKey, mockRbAuthAuthServiceHost);
  });

  afterEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
  });

  describe('login', () => {
    describe('success', () => {
      beforeEach(() => {
        server.use(
          http.post<never, AuthRequestBody, any>(
            `${mockRbAuthAuthServiceHost}/users/authenticate`,
            async ({ request }) => {
              const publicKey = request.headers.get('X-Ds-Key-Name');
              const { email, password } = await request.json();

              if (publicKey && email === mockAuthEmail && password === mockAuthPassword) {
                return HttpResponse.json({
                  token: 'auth-token',
                  refreshToken: 'refresh-token',
                  expiresIn: 30,
                  destroyAt: 100,
                  authStorageType: StorageType.SESSION,
                  user: mockUserData
                });
              }

              return new HttpResponse(null, { status: 400 });
            }
          )
        );
      });

      it('should successfully fetch auth token from the auth service', async () => {
        const userData = await auth.login(mockAuthEmail, mockAuthPassword);

        expect(userData).toEqual(expect.objectContaining(mockUserData));

        expect(auth.tokenResponse).toEqual(
          expect.objectContaining({
            token: 'auth-token',
            expiresIn: 30
          })
        );

        expect(auth.refreshToken).toEqual('refresh-token');
        expect(auth.user).toEqual(mockUserData);
        expect(setItem).toHaveBeenCalledWith(
          'relaybox:refreshToken',
          JSON.stringify({
            refreshToken: 'refresh-token',
            expiresAt: 100
          }),
          StorageType.SESSION
        );
      });
    });

    describe('error', () => {
      it('should throw validation error if email is invalid', async () => {
        await expect(auth.login('invalid email', mockAuthPassword)).rejects.toThrow(
          ValidationError
        );
      });

      it('should throw validation error if password is invalid', async () => {
        await expect(auth.login(mockAuthEmail, '')).rejects.toThrow(ValidationError);
      });
    });
  });

  describe('create', () => {
    describe('success', () => {
      beforeEach(() => {
        server.use(
          http.post<never, AuthRequestBody, any>(
            `${mockRbAuthAuthServiceHost}/users/create`,
            async ({ request }) => {
              const publicKey = request.headers.get('X-Ds-Key-Name');
              const { email, password } = await request.json();

              if (publicKey && email === mockAuthEmail && password === mockAuthPassword) {
                return HttpResponse.json({
                  message: 'User created successfully'
                });
              }

              return new HttpResponse(null, { status: 400 });
            }
          )
        );
      });

      it('should successfully create a user', async () => {
        await expect(auth.create('1@1.com', 'password')).resolves.toEqual(true);
      });
    });

    describe('error', () => {
      it('should throw validation error if email is invalid', async () => {
        await expect(auth.create('invalid email', 'password')).rejects.toThrow(ValidationError);
      });

      it('should throw validation error if pssword is invalid', async () => {
        await expect(auth.create('1@1.com', '')).rejects.toThrow(ValidationError);
      });
    });
  });

  describe('verify', () => {
    describe('success', () => {
      beforeEach(() => {
        server.use(
          http.post<never, AuthRequestBody, any>(
            `${mockRbAuthAuthServiceHost}/users/verify`,
            async ({ request }) => {
              const publicKey = request.headers.get('X-Ds-Key-Name');
              const { email, code } = await request.json();

              if (publicKey && email === mockAuthEmail && code === mockAuthCode) {
                return HttpResponse.json({
                  message: 'User verified successfully'
                });
              }

              return new HttpResponse(null, { status: 400 });
            }
          )
        );
      });

      it('should successfully verify a user', async () => {
        await expect(auth.verify(mockAuthEmail, mockAuthCode)).resolves.toEqual(true);
      });
    });

    describe('error', () => {
      it('should throw validation error if email is invalid', async () => {
        await expect(auth.verify('invalid email', mockAuthCode)).rejects.toThrow(ValidationError);
      });

      it('should throw validation error if pssword is invalid', async () => {
        await expect(auth.verify(mockAuthEmail, '')).rejects.toThrow(ValidationError);
      });
    });
  });

  describe('tokenRefresh', () => {
    describe('success', () => {
      beforeEach(() => {
        server.use(
          http.get<never, AuthRequestBody, any>(
            `${mockRbAuthAuthServiceHost}/users/tokenRefresh`,
            async ({ request }) => {
              const publicKey = request.headers.get('X-Ds-Key-Name');
              const authorization = request.headers.get('Authorization');

              if (publicKey && authorization) {
                return HttpResponse.json({
                  token: 'auth-token',
                  expiresIn: 30,
                  expiresAt: 100
                });
              }

              return new HttpResponse(null, { status: 400 });
            }
          )
        );
      });

      it('should successfully fetch auth token from the auth service', async () => {
        await auth.tokenRefresh();

        expect(auth.tokenResponse).toEqual(
          expect.objectContaining({
            token: 'auth-token',
            expiresIn: 30,
            expiresAt: 100
          })
        );
      });
    });
  });
});
