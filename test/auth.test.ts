import { Auth, REFRESH_TOKEN_KEY } from '../lib/auth';
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { HttpResponse, http } from 'msw';
import { mockTokenRefreshResponse, mockTokenResponse, mockUserData } from './mock/auth.mock';
import { setItem, getItem } from '../lib/storage';
import { StorageType } from '../lib/types/storage.types';
import { AuthEvent } from '../lib/types';

const mockPublicKey = 'appId.keyId';
const mockAuthAuthServiceHost = 'http://localhost:4005';
const mockAuthAuthServiceUrl = 'http://localhost:4005/dev';
const mockAuthEmail = '1@1.com';
const mockAuthPassword = 'password';
const mockAuthCode = '123456';

const server = setupServer();

interface AuthRequestBody {
  email?: string;
  password?: string;
  code?: string;
}

function getMockApiErrorResponse() {
  return HttpResponse.json(
    { name: 'Error', message: 'failed', data: { schema: false } },
    { status: 400 }
  );
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
        `${mockAuthAuthServiceUrl}/users/authenticate`,
        async ({ request }) => {
          const publicKey = request.headers.get('X-Ds-Key-Name');
          const { email, password } = await request.json();

          if (publicKey && email === mockAuthEmail && password === mockAuthPassword) {
            return HttpResponse.json(mockTokenResponse);
          }

          return getMockApiErrorResponse();
        }
      )
    );

    server.use(
      http.post<never, AuthRequestBody, any>(
        `${mockAuthAuthServiceUrl}/users/create`,
        async ({ request }) => {
          const publicKey = request.headers.get('X-Ds-Key-Name');
          const { email, password } = await request.json();

          if (publicKey && email === mockAuthEmail && password === mockAuthPassword) {
            return HttpResponse.json({
              id: 1,
              message: 'User created successfully'
            });
          }

          return getMockApiErrorResponse();
        }
      )
    );

    server.use(
      http.post<never, AuthRequestBody, any>(
        `${mockAuthAuthServiceUrl}/users/verify`,
        async ({ request }) => {
          const publicKey = request.headers.get('X-Ds-Key-Name');
          const { email, code } = await request.json();

          if (publicKey && email === mockAuthEmail && code === mockAuthCode) {
            return HttpResponse.json({
              message: 'User verified successfully'
            });
          }

          return getMockApiErrorResponse();
        }
      )
    );

    server.use(
      http.post<never, AuthRequestBody, any>(
        `${mockAuthAuthServiceUrl}/users/password-reset`,
        async ({ request }) => {
          const publicKey = request.headers.get('X-Ds-Key-Name');
          const { email } = await request.json();

          if (publicKey && email === mockAuthEmail) {
            return HttpResponse.json({
              message: 'Password reset request initialized'
            });
          }

          return getMockApiErrorResponse();
        }
      )
    );

    server.use(
      http.post<never, AuthRequestBody, any>(
        `${mockAuthAuthServiceUrl}/users/password-confirm`,
        async ({ request }) => {
          const publicKey = request.headers.get('X-Ds-Key-Name');
          const { code, password } = await request.json();

          if (publicKey && code === mockAuthCode && password === mockAuthPassword) {
            return HttpResponse.json({
              message: 'Password reset successful'
            });
          }

          return getMockApiErrorResponse();
        }
      )
    );

    server.use(
      http.get<never, AuthRequestBody, any>(
        `${mockAuthAuthServiceUrl}/users/token/refresh`,
        async ({ request }) => {
          const publicKey = request.headers.get('X-Ds-Key-Name');
          const authorization = request.headers.get('Authorization');

          if (publicKey && authorization) {
            return HttpResponse.json(mockTokenRefreshResponse);
          }

          return getMockApiErrorResponse();
        }
      )
    );

    server.use(
      http.get<never, AuthRequestBody, any>(
        `${mockAuthAuthServiceUrl}/users/session`,
        async ({ request }) => {
          const publicKey = request.headers.get('X-Ds-Key-Name');
          const authorization = request.headers.get('Authorization');

          if (publicKey && authorization) {
            return HttpResponse.json(mockTokenResponse);
          }

          return getMockApiErrorResponse();
        }
      )
    );

    server.use(
      http.post<never, AuthRequestBody, any>(
        `${mockAuthAuthServiceUrl}/users/generate-verification-code`,
        async ({ request }) => {
          const publicKey = request.headers.get('X-Ds-Key-Name');
          const { email } = await request.json();

          if (publicKey && email === mockAuthEmail) {
            return HttpResponse.json({
              message: 'Verification code sent'
            });
          }

          return getMockApiErrorResponse();
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
    auth = new Auth(mockPublicKey, mockAuthAuthServiceUrl, mockAuthAuthServiceHost);
    vi.spyOn(auth, 'emit').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('signUp', () => {
    describe('success', () => {
      it('should successfully create a user', async () => {
        await expect(
          auth.signUp({ email: mockAuthEmail, password: mockAuthPassword })
        ).resolves.toEqual(expect.objectContaining({ message: expect.any(String) }));
        expect(auth.emit).toHaveBeenCalledWith(
          AuthEvent.SIGN_UP,
          expect.objectContaining({ id: 1 })
        );
      });
    });
  });

  describe('verify', () => {
    describe('success', () => {
      it('should successfully verify a user', async () => {
        await expect(auth.verify({ email: mockAuthEmail, code: mockAuthCode })).resolves.toEqual(
          expect.objectContaining({ message: expect.any(String) })
        );
        expect(auth.emit).toHaveBeenCalledWith(
          AuthEvent.VERIFY,
          expect.objectContaining({ message: expect.any(String) })
        );
      });
    });
  });

  describe('signIn', () => {
    describe('success', () => {
      it('should successfully fetch auth token from the auth service', async () => {
        const sessionData = await auth.signIn({ email: mockAuthEmail, password: mockAuthPassword });

        expect(sessionData).toEqual(expect.objectContaining(mockTokenResponse));
        expect(auth.tokenResponse).toEqual(expect.objectContaining({ token: 'auth-token' }));
        expect(auth.refreshToken).toEqual('refresh-token');
        expect(auth.user).toEqual(mockUserData);
        expect(setItem).toHaveBeenCalledWith(
          REFRESH_TOKEN_KEY,
          JSON.stringify({ value: 'refresh-token', expiresAt: 100 }),
          StorageType.SESSION
        );
        expect(auth.emit).toHaveBeenCalledWith(AuthEvent.SIGN_IN, mockTokenResponse);
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
        expect(auth.tokenResponse).toEqual(expect.objectContaining({ token: 'auth-token' }));
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

  describe('passwordReset', () => {
    describe('success', () => {
      it('should successfully initiate password reset flow', async () => {
        await expect(auth.passwordReset({ email: mockAuthEmail })).resolves.toEqual(
          expect.objectContaining({ message: expect.any(String) })
        );
        expect(auth.emit).toHaveBeenCalledWith(
          AuthEvent.PASSWORD_RESET,
          expect.objectContaining({ message: expect.any(String) })
        );
      });
    });
  });

  describe('passwordConfirm', () => {
    describe('success', () => {
      it('should successfully confirm password reset', async () => {
        await expect(
          auth.passwordConfirm({
            email: mockAuthEmail,
            password: mockAuthPassword,
            code: mockAuthCode
          })
        ).resolves.toEqual(expect.objectContaining({ message: expect.any(String) }));
        expect(auth.emit).toHaveBeenCalledWith(
          AuthEvent.PASSWORD_CONFIRM,
          expect.objectContaining({ message: expect.any(String) })
        );
      });
    });
  });

  describe('tokenRefresh', () => {
    describe('success', () => {
      it('should successfully fetch auth token from the auth service', async () => {
        await auth.signIn({ email: mockAuthEmail, password: mockAuthPassword });
        expect(auth.tokenResponse).toEqual(expect.objectContaining({ token: 'auth-token' }));

        await auth.tokenRefresh();
        expect(auth.tokenResponse).toEqual(
          expect.objectContaining({ token: 'auth-token-refresh' })
        );
        expect(auth.emit).toHaveBeenCalledWith(AuthEvent.TOKEN_REFRESH, {
          token: expect.any(String),
          expiresIn: expect.any(Number),
          expiresAt: expect.any(Number)
        });
      });
    });
  });

  describe('resendVerification', () => {
    describe('success', () => {
      it('should successfully fetch auth token from the auth service', async () => {
        await expect(auth.resendVerification({ email: mockAuthEmail })).resolves.toEqual(
          expect.objectContaining({ message: expect.any(String) })
        );
        expect(auth.emit).toHaveBeenCalledWith(
          AuthEvent.RESEND_VERIFICATION,
          expect.objectContaining({ message: expect.any(String) })
        );
      });
    });
  });

  describe('signOut', () => {
    describe('success', () => {
      it('should successfully sign a user out and destroy session', async () => {
        const session = await auth.signIn({ email: mockAuthEmail, password: mockAuthPassword });
        auth.signOut();
        expect(auth.emit).toHaveBeenCalledWith(
          AuthEvent.SIGN_OUT,
          expect.objectContaining(session.user)
        );
        expect(auth.user).toBeNull();
      });
    });
  });
});