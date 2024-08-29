import { Auth, REFRESH_TOKEN_KEY } from '../lib/auth';
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { HttpResponse, http } from 'msw';
import { mockTokenRefreshResponse, mockTokenResponse, mockUserData } from './mock/auth.mock';
import { setItem, getItem } from '../lib/storage';
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

vi.mock('../lib/storage', () => ({
  setItem: vi.fn(),
  removeItem: vi.fn(),
  getItem: vi.fn()
}));

describe('Auth', () => {
  let auth: Auth;

  beforeAll(() => {
    server.use(
      http.post<never, AuthRequestBody, any>(
        `${mockRbAuthAuthServiceHost}/users/authenticate`,
        async ({ request }) => {
          const publicKey = request.headers.get('X-Ds-Key-Name');
          const { email, password } = await request.json();

          if (publicKey && email === mockAuthEmail && password === mockAuthPassword) {
            return HttpResponse.json(mockTokenResponse);
          }

          return new HttpResponse(null, { status: 400 });
        }
      )
    );

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

    server.use(
      http.post<never, AuthRequestBody, any>(
        `${mockRbAuthAuthServiceHost}/users/password-reset`,
        async ({ request }) => {
          const publicKey = request.headers.get('X-Ds-Key-Name');
          const { email } = await request.json();

          if (publicKey && email === mockAuthEmail) {
            return HttpResponse.json({
              message: 'Password reset request initialized'
            });
          }

          return new HttpResponse(null, { status: 400 });
        }
      )
    );

    server.use(
      http.post<never, AuthRequestBody, any>(
        `${mockRbAuthAuthServiceHost}/users/password-confirm`,
        async ({ request }) => {
          const publicKey = request.headers.get('X-Ds-Key-Name');
          const { code, password } = await request.json();

          if (publicKey && code === mockAuthCode && password === mockAuthPassword) {
            return HttpResponse.json({
              message: 'Password reset successful'
            });
          }

          return new HttpResponse(null, { status: 400 });
        }
      )
    );

    server.use(
      http.get<never, AuthRequestBody, any>(
        `${mockRbAuthAuthServiceHost}/users/token/refresh`,
        async ({ request }) => {
          const publicKey = request.headers.get('X-Ds-Key-Name');
          const authorization = request.headers.get('Authorization');

          if (publicKey && authorization) {
            return HttpResponse.json(mockTokenRefreshResponse);
          }

          return new HttpResponse(null, { status: 400 });
        }
      )
    );

    server.use(
      http.get<never, AuthRequestBody, any>(
        `${mockRbAuthAuthServiceHost}/users/session`,
        async ({ request }) => {
          const publicKey = request.headers.get('X-Ds-Key-Name');
          const authorization = request.headers.get('Authorization');

          if (publicKey && authorization) {
            return HttpResponse.json(mockTokenResponse);
          }

          return new HttpResponse(null, { status: 400 });
        }
      )
    );

    server.listen();
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    // server.resetHandlers();
    auth = new Auth(mockPublicKey, mockRbAuthAuthServiceHost);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('login', () => {
    describe('success', () => {
      it('should successfully fetch auth token from the auth service', async () => {
        const sessionData = await auth.login(mockAuthEmail, mockAuthPassword);

        expect(sessionData).toEqual(expect.objectContaining(mockTokenResponse));
        expect(auth.tokenResponse).toEqual(mockTokenRefreshResponse);
        expect(auth.refreshToken).toEqual('refresh-token');
        expect(auth.user).toEqual(mockUserData);
        expect(setItem).toHaveBeenCalledWith(
          REFRESH_TOKEN_KEY,
          JSON.stringify({ value: 'refresh-token', expiresAt: 100 }),
          StorageType.SESSION
        );
      });
    });
  });

  describe('getSession', () => {
    describe('success', () => {
      it('should successfully fetch auth token from the auth service', async () => {
        const mockedGetItem = vi.mocked(getItem);
        mockedGetItem.mockReturnValueOnce('refresh-token');

        const sessionData = await auth.getSession();

        expect(sessionData).toEqual(expect.objectContaining(mockTokenResponse));
        expect(auth.tokenResponse).toEqual(mockTokenRefreshResponse);
        expect(auth.refreshToken).toEqual('refresh-token');
        expect(auth.user).toEqual(mockUserData);
        expect(setItem).toHaveBeenCalledWith(
          REFRESH_TOKEN_KEY,
          JSON.stringify({ value: 'refresh-token', expiresAt: 100 }),
          StorageType.SESSION
        );
      });
    });

    describe('error', () => {
      it('should return null if no refresh token is found', async () => {
        const mockedGetItem = vi.mocked(getItem);
        mockedGetItem.mockReturnValueOnce(null);
        const sessionData = await auth.getSession();
        expect(sessionData).toBeNull();
      });
    });
  });

  describe('create', () => {
    describe('success', () => {
      it('should successfully create a user', async () => {
        await expect(auth.create('1@1.com', 'password')).resolves.toEqual(
          expect.objectContaining({ message: expect.any(String) })
        );
      });
    });
  });

  describe('verify', () => {
    describe('success', () => {
      it('should successfully verify a user', async () => {
        await expect(auth.verify(mockAuthEmail, mockAuthCode)).resolves.toEqual(
          expect.objectContaining({ message: expect.any(String) })
        );
      });
    });
  });

  describe('passwordReset', () => {
    describe('success', () => {
      it('should successfully initiate password reset flow', async () => {
        await expect(auth.passwordReset(mockAuthEmail)).resolves.toEqual(
          expect.objectContaining({ message: expect.any(String) })
        );
      });
    });
  });

  describe('passwordConfirm', () => {
    describe('success', () => {
      it('should successfully confirm password reset', async () => {
        await expect(
          auth.passwordConfirm(mockAuthEmail, mockAuthPassword, mockAuthCode)
        ).resolves.toEqual(expect.objectContaining({ message: expect.any(String) }));
      });
    });
  });

  describe('tokenRefresh', () => {
    describe('success', () => {
      it('should successfully fetch auth token from the auth service', async () => {
        await auth.tokenRefresh();
        expect(auth.tokenResponse).toEqual(expect.objectContaining(mockTokenRefreshResponse));
      });
    });
  });
});
