import { Auth, REFRESH_TOKEN_KEY } from '../lib/auth';
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { HttpResponse, http } from 'msw';
import {
  getMockAuthUserSession,
  mockAuthMfaEnrollResponse,
  mockAuthUserPublic,
  mockTokenRefreshResponse
} from './mock/auth.mock';
import { setItem, getItem } from '../lib/storage';
import { StorageType } from '../lib/types/storage.types';
import { AuthEvent } from '../lib/types';
import { SocketManager } from '../lib/socket-manager';
import { User } from '../lib/user';

const mockPublicKey = 'appId.keyId';
const mockAuthAuthServiceHost = 'http://localhost:9090';
const mockAuthAuthServiceUrl = 'http://localhost:9090/auth/dev';
const mockAuthEmail = '1@1.com';
const mockAuthPassword = 'password';
const mockAuthCode = '123456';
const mockAuthUserSession = getMockAuthUserSession();

const server = setupServer();

interface AuthRequestBody {
  email?: string;
  password?: string;
  code?: string;
}

interface AuthMfaRequestBody {
  factorId?: string;
  challengeId?: string;
  code?: string;
  autoChallenge?: boolean;
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
          const publicKey = request.headers.get('X-Ds-Public-Key');
          const { email, password } = await request.json();

          if (publicKey && email === mockAuthEmail && password === mockAuthPassword) {
            return HttpResponse.json(mockAuthUserSession);
          }

          return getMockApiErrorResponse();
        }
      )
    );

    server.use(
      http.post<never, AuthRequestBody, any>(
        `${mockAuthAuthServiceUrl}/users/create`,
        async ({ request }) => {
          const publicKey = request.headers.get('X-Ds-Public-Key');
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
          const publicKey = request.headers.get('X-Ds-Public-Key');
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
          const publicKey = request.headers.get('X-Ds-Public-Key');
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
          const publicKey = request.headers.get('X-Ds-Public-Key');
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
          const publicKey = request.headers.get('X-Ds-Public-Key');
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
          const publicKey = request.headers.get('X-Ds-Public-Key');
          const authorization = request.headers.get('Authorization');

          if (publicKey && authorization) {
            return HttpResponse.json(mockAuthUserSession);
          }

          return getMockApiErrorResponse();
        }
      )
    );

    server.use(
      http.post<never, AuthRequestBody, any>(
        `${mockAuthAuthServiceUrl}/users/generate-verification-code`,
        async ({ request }) => {
          const publicKey = request.headers.get('X-Ds-Public-Key');
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

    server.use(
      http.post<never, AuthRequestBody, any>(
        `${mockAuthAuthServiceUrl}/users/mfa/enroll`,
        async ({ request }) => {
          const bearerToken = request.headers.get('Authorization');
          const publicKey = request.headers.get('X-Ds-Public-Key');

          if (publicKey && bearerToken) {
            return HttpResponse.json(mockAuthMfaEnrollResponse);
          }

          return getMockApiErrorResponse();
        }
      )
    );

    server.use(
      http.post<never, AuthMfaRequestBody, any>(
        `${mockAuthAuthServiceUrl}/users/mfa/challenge`,
        async ({ request }) => {
          const bearerToken = request.headers.get('Authorization');
          const publicKey = request.headers.get('X-Ds-Public-Key');
          const { factorId } = await request.json();

          if (publicKey && bearerToken && factorId) {
            return HttpResponse.json({
              id: 'mfa-challenge-id',
              expiresAt: 100
            });
          }

          return getMockApiErrorResponse();
        }
      )
    );

    server.use(
      http.post<never, AuthMfaRequestBody, any>(
        `${mockAuthAuthServiceUrl}/users/mfa/verify`,
        async ({ request }) => {
          const bearerToken = request.headers.get('Authorization');
          const publicKey = request.headers.get('X-Ds-Public-Key');
          const { factorId, challengeId, code, autoChallenge } = await request.json();

          if (publicKey && bearerToken && factorId && code && (challengeId || autoChallenge)) {
            return HttpResponse.json(mockAuthUserSession);
          }

          return getMockApiErrorResponse();
        }
      )
    );

    server.use(
      http.get<never, AuthMfaRequestBody, any>(
        `${mockAuthAuthServiceUrl}/users/${mockAuthUserPublic.clientId}`,
        async ({ request }) => {
          const bearerToken = request.headers.get('Authorization');
          const publicKey = request.headers.get('X-Ds-Public-Key');

          if (publicKey && bearerToken) {
            return HttpResponse.json(mockAuthUserPublic);
          }

          return getMockApiErrorResponse();
        }
      )
    );

    server.listen();
  });

  afterAll(() => {
    server.close();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    // server.resetHandlers();
    const socketManager = vi.mocked(new SocketManager());
    auth = new Auth(socketManager, mockPublicKey, mockAuthAuthServiceUrl);
    vi.spyOn(auth, 'emit').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.resetAllMocks();
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

        expect(sessionData).toEqual(expect.objectContaining(mockAuthUserSession));
        expect(auth.tokenResponse).toEqual(expect.objectContaining({ token: 'auth-token' }));
        expect(auth.refreshToken).toEqual('refresh-token');
        expect(auth.user).toEqual(mockAuthUserSession.user);
        expect(setItem).toHaveBeenCalledWith(
          REFRESH_TOKEN_KEY,
          JSON.stringify({ value: 'refresh-token', expiresAt: 100 }),
          StorageType.SESSION
        );
        expect(auth.emit).toHaveBeenCalledWith(AuthEvent.SIGN_IN, mockAuthUserSession);
      });
    });
  });

  describe('getSession', () => {
    describe('success', () => {
      it('should successfully fetch auth token from the auth service', async () => {
        const mockedGetItem = vi.mocked(getItem);
        mockedGetItem.mockReturnValueOnce('refresh-token');

        const sessionData = await auth.getSession();

        expect(sessionData).toEqual(expect.objectContaining(mockAuthUserSession));
        expect(auth.tokenResponse).toEqual(expect.objectContaining({ token: 'auth-token' }));
        expect(auth.refreshToken).toEqual('refresh-token');
        expect(auth.user).toEqual(mockAuthUserSession.user);
        expect(setItem).not.toHaveBeenCalled();
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

  describe('getUser', () => {
    describe('success', () => {
      it('should successfully get public user details', async () => {
        const user = await auth.getUser({ clientId: mockAuthUserPublic.clientId });
        expect(user).toBeInstanceOf(User);
        expect(user.clientId).toEqual(mockAuthUserPublic.clientId);
      });
    });
  });

  describe('mfa', () => {
    describe('enroll', () => {
      describe('success', () => {
        it('should enroll a user with mfa', async () => {
          const authMfaEnrollResponse = await auth.mfa.enroll({ type: 'totp' });
          expect(authMfaEnrollResponse).toEqual(expect.objectContaining(mockAuthMfaEnrollResponse));
        });
      });
    });

    describe('challenge', () => {
      describe('success', () => {
        it('should successfully challenge a user with mfa', async () => {
          const authChallenge = await auth.mfa.challenge({ factorId: 'mfa-factor-id' });
          expect(authChallenge).toEqual({
            id: 'mfa-challenge-id',
            verify: expect.any(Function)
          });
        });

        it('should successfully create an mfa challenge and accept the verification', async () => {
          (auth as any).mfaVerify = vi.fn().mockResolvedValueOnce(mockAuthUserSession);
          const authChallenge = await auth.mfa.challenge({ factorId: 'mfa-factor-id' });
          authChallenge.verify({ code: '123456' });
          expect((auth as any).mfaVerify).toHaveBeenCalledWith({
            factorId: 'mfa-factor-id',
            challengeId: 'mfa-challenge-id',
            code: '123456'
          });
        });
      });
    });

    describe('verify', () => {
      describe('success', () => {
        it('should successfully verify a user passing challenge with mfa', async () => {
          await auth.mfa.verify({
            factorId: 'mfa-factor-id',
            challengeId: 'mfa-challenge-id',
            code: '123456'
          });
          expect(auth.tokenResponse).toEqual(expect.objectContaining({ token: 'auth-token' }));
          expect(auth.refreshToken).toEqual(mockAuthUserSession.session?.refreshToken);
          expect(auth.user).toEqual(mockAuthUserSession.user);
          expect(setItem).toHaveBeenCalledWith(
            REFRESH_TOKEN_KEY,
            JSON.stringify({
              value: mockAuthUserSession.session?.refreshToken,
              expiresAt: mockAuthUserSession.session?.expiresAt
            }),
            StorageType.SESSION
          );
          expect(auth.emit).toHaveBeenCalledWith(AuthEvent.SIGN_IN, mockAuthUserSession);
        });

        it('should successfully verify a user with auto challenge mfa', async () => {
          await auth.mfa.verify({
            factorId: 'mfa-factor-id',
            code: '123456',
            autoChallenge: true
          });
          expect(auth.tokenResponse).toEqual(expect.objectContaining({ token: 'auth-token' }));
          expect(auth.refreshToken).toEqual('refresh-token');
          expect(auth.user).toEqual(mockAuthUserSession.user);
          expect(setItem).toHaveBeenCalledWith(
            REFRESH_TOKEN_KEY,
            JSON.stringify({
              value: mockAuthUserSession.session?.refreshToken,
              expiresAt: mockAuthUserSession.session?.expiresAt
            }),
            StorageType.SESSION
          );
          expect(auth.emit).toHaveBeenCalledWith(AuthEvent.SIGN_IN, mockAuthUserSession);
        });
      });
    });
  });

  describe('handleOAuthMessageEvent', () => {
    it('should handle the OAuth message event and emit the appropriate events', async () => {
      vi.spyOn(window, 'removeEventListener');

      const mockEvent = {
        origin: mockAuthAuthServiceHost,
        data: mockAuthUserSession
      } as MessageEvent;

      auth['handleOAuthMessageEvent'](mockEvent);

      expect(window.removeEventListener).toHaveBeenCalledWith('message', expect.any(Function));
      expect(auth.emit).toHaveBeenCalledWith(AuthEvent.SIGN_IN, mockAuthUserSession);
    });

    it('should ignore events that dont match the auth service origin', async () => {
      vi.spyOn(window, 'removeEventListener');

      const mockEvent = {
        origin: 'https://example.com',
        data: mockAuthUserSession
      } as MessageEvent;

      auth['handleOAuthMessageEvent'](mockEvent);

      expect(window.removeEventListener).not.toHaveBeenCalled();
      expect(auth.emit).not.toHaveBeenCalled();
    });
  });
});
