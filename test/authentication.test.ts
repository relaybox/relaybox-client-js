import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest';
import { getAuthTokenResponse } from '../lib/authentication';
import { HTTPRequestError, ValidationError, NetworkError } from '../lib/errors';
import { setupServer } from 'msw/node';
import { HttpResponse, http } from 'msw';

const server = setupServer();
const mockAuthEndpoint = 'https://example.com/auth';

interface AuthHeaders {
  clientId: string;
}

interface AuthParams {
  clientId: string;
}

interface AuthResponse {
  token: string;
  expiresIn: number;
}

beforeAll(() => {
  server.listen();
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe('getAuthTokenResponse', () => {
  describe('Success - 200', () => {
    it('should return auth token when called with valid headers', async () => {
      server.use(
        http.get<AuthHeaders, never, AuthResponse | any>(mockAuthEndpoint, ({ request }) => {
          if (request.headers.get('clientId')) {
            return HttpResponse.json({ token: 'auth-token', expiresIn: 30 });
          }

          return new HttpResponse(null, { status: 401 });
        })
      );

      const authHeaders = {
        clientId: 1234
      };

      const tokenResponse = await getAuthTokenResponse(mockAuthEndpoint, authHeaders);

      expect(tokenResponse).toEqual(
        expect.objectContaining({
          token: 'auth-token',
          expiresIn: 30
        })
      );
    });

    it('should return auth token when called with valid search params', async () => {
      server.use(
        http.get<AuthParams, never, AuthResponse | any>(mockAuthEndpoint, ({ request }) => {
          const url = new URL(request.url);
          const clientId = url.searchParams.get('clientId');

          if (clientId) {
            return HttpResponse.json({ token: 'auth-token', expiresIn: 30 });
          }

          return new HttpResponse(null, { status: 401 });
        })
      );

      const authParams = {
        clientId: 1234
      };

      const tokenResponse = await getAuthTokenResponse(mockAuthEndpoint, null, authParams);

      expect(tokenResponse).toEqual(
        expect.objectContaining({
          token: 'auth-token',
          expiresIn: 30
        })
      );
    });
  });

  describe('Error - 4xx / 5xx', () => {
    it('should throw HTTPRequestError when response is 4xx', async () => {
      server.use(
        http.get(mockAuthEndpoint, () => {
          return new HttpResponse(null, { status: 400 });
        })
      );

      await expect(getAuthTokenResponse(mockAuthEndpoint)).rejects.toThrow(HTTPRequestError);
    });

    it('should throw HTTPRequestError when response is 5xx', async () => {
      server.use(
        http.get(mockAuthEndpoint, () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      await expect(getAuthTokenResponse(mockAuthEndpoint)).rejects.toThrow(HTTPRequestError);
    });

    it('should throw NetworkError when service is unavailable', async () => {
      server.use(
        http.get(mockAuthEndpoint, () => {
          return HttpResponse.error();
        })
      );

      await expect(getAuthTokenResponse(mockAuthEndpoint)).rejects.toThrow(NetworkError);
    });
  });

  describe('Error - validation', () => {
    it('should throw ValidationError if no endpoint is provided', async () => {
      await expect(getAuthTokenResponse()).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if authentication headers are invalid', async () => {
      const authheaders = {
        authHeaderParam: null
      };

      await expect(getAuthTokenResponse(mockAuthEndpoint, authheaders)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError if authentication params are invalid', async () => {
      const authParams = {
        authQueryParam: null
      };

      await expect(getAuthTokenResponse(mockAuthEndpoint, null, authParams)).rejects.toThrow(
        ValidationError
      );
    });
  });
});
