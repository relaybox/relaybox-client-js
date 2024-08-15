import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest';
import { request } from '../lib/request';
import { HTTPRequestError, NetworkError } from '../lib/errors';
import { setupServer } from 'msw/node';
import { HttpResponse, http } from 'msw';
import { HttpMethod } from '../lib/types/request.types';

const server = setupServer();
const mockUrl = 'https://example.com';
const mockResponse = {
  params: 123
};

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
    it('should return valid response with status and data attributes from get request', async () => {
      server.use(http.get(mockUrl, () => HttpResponse.json(mockResponse)));

      const requestParams = {
        method: HttpMethod.GET
      };

      await expect(request(mockUrl, requestParams)).resolves.toEqual({
        status: 200,
        data: mockResponse
      });
    });

    it('should return valid response with status and data attributes from post request', async () => {
      server.use(http.post(mockUrl, () => HttpResponse.json(mockResponse)));

      const requestParams = {
        method: HttpMethod.POST,
        body: JSON.stringify({
          test: true
        })
      };

      await expect(request(mockUrl, requestParams)).resolves.toEqual({
        status: 200,
        data: mockResponse
      });
    });
  });

  describe('Error - 4xx / 5xx', () => {
    it('should throw HTTPRequestError when response is 4xx', async () => {
      server.use(http.get(mockUrl, () => new HttpResponse(null, { status: 400 })));

      const requestParams = {
        method: HttpMethod.GET
      };

      await expect(request(mockUrl, requestParams)).rejects.toThrow(HTTPRequestError);
    });

    it('should throw HTTPRequestError when response is 5xx', async () => {
      server.use(http.get(mockUrl, () => new HttpResponse(null, { status: 500 })));

      const requestParams = {
        method: HttpMethod.GET
      };

      await expect(request(mockUrl, requestParams)).rejects.toThrow(HTTPRequestError);
    });

    it('should throw NetworkError when service is unavailable', async () => {
      server.use(http.get(mockUrl, () => HttpResponse.error()));

      const requestParams = {
        method: HttpMethod.GET
      };

      await expect(request(mockUrl, requestParams)).rejects.toThrow(NetworkError);
    });
  });
});
