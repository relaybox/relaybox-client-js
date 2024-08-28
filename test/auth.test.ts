import { Auth } from '../lib/auth';
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { SocketManager } from '../lib/socket-manager';
import { setupServer } from 'msw/node';
import { HttpResponse, http } from 'msw';
import { ValidationError } from '../lib/errors';

const mockPublicKey = 'appId.keyId';
const mockRbAuthAuthServiceHost = 'http://localhost:4005/dev';

const server = setupServer();

interface AuthHeaders {
  clientId: string;
}

vi.mock('../lib/logger', () => ({
  logger: {
    logInfo: vi.fn(),
    logError: vi.fn()
  }
}));

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
          http.post(`${mockRbAuthAuthServiceHost}/users/authenticate`, ({ request }) => {
            const publicKey = request.headers.get('X-Ds-Key-Name');

            if (publicKey) {
              return HttpResponse.json({
                token: 'auth-token',
                refreshToken: 'refresh-token',
                expiresIn: 30
              });
            }

            return new HttpResponse(null, { status: 400 });
          })
        );
      });

      it('should successfully fetch auth token from the auth service', async () => {
        const tokenResponse = await auth.login('1@1.com', 'password');

        expect(tokenResponse).toEqual(
          expect.objectContaining({
            token: 'auth-token',
            refreshToken: 'refresh-token',
            expiresIn: 30
          })
        );
        expect(tokenResponse).toEqual(auth.tokenResponse);
      });
    });

    describe('error', () => {
      it('should throw validation error if email is invalid', async () => {
        await expect(auth.login('invalid email', 'password')).rejects.toThrow(ValidationError);
      });

      it('should throw validation error if password is invalid', async () => {
        await expect(auth.login('1@1.com', '')).rejects.toThrow(ValidationError);
      });
    });
  });

  describe('create', () => {
    describe('success', () => {
      beforeEach(() => {
        server.use(
          http.post(`${mockRbAuthAuthServiceHost}/users/create`, ({ request }) => {
            const publicKey = request.headers.get('X-Ds-Key-Name');

            if (publicKey) {
              return HttpResponse.json({
                message: 'User created successfully'
              });
            }

            return new HttpResponse(null, { status: 400 });
          })
        );
      });

      it('should successfully create a user', async () => {
        await expect(auth.create('1@1.com', 'password')).resolves.toEqual(true);
      });
    });

    describe('error', () => {
      it('should throw validation error if email is invalid', async () => {
        await expect(auth.login('invalid email', 'password')).rejects.toThrow(ValidationError);
      });

      it('should throw validation error if pssword is invalid', async () => {
        await expect(auth.login('1@1.com', '')).rejects.toThrow(ValidationError);
      });
    });
  });
});
