import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { request, serviceRequest } from '../lib/request';
import { HTTPRequestError, NetworkError, TimeoutError } from '../lib/errors';
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

describe('request', () => {
  describe('success - 200', () => {
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

  describe('error - 4xx / 5xx', () => {
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

    it('should throw TimeoutError when request times out', async () => {
      vi.useFakeTimers();

      server.use(http.get(mockUrl, () => HttpResponse.json(mockResponse)));

      const requestParams = {
        method: HttpMethod.GET
      };

      const promise = serviceRequest(mockUrl, requestParams);

      vi.advanceTimersByTime(10000);

      await expect(promise).rejects.toThrow(TimeoutError);
    });
  });
});

describe('serviceRequest', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('success - 200', () => {
    it('should return json data from service request', async () => {
      const mockResponse = { test: true };

      server.use(
        http.get(mockUrl, async () => {
          return HttpResponse.json(mockResponse);
        })
      );

      const requestParams = {
        method: HttpMethod.GET
      };

      await expect(serviceRequest(mockUrl, requestParams)).resolves.toEqual(mockResponse);
    });
  });

  describe('error - 4xx / 5xx', () => {
    it('should throw a named error if status non 2xx', async () => {
      server.use(
        http.get(mockUrl, () => {
          return HttpResponse.json(
            { name: 'AuthenticationError', message: 'failed', data: { schema: false } },
            { status: 400 }
          );
        })
      );

      const requestParams = {
        method: HttpMethod.GET
      };

      try {
        await serviceRequest(mockUrl, requestParams);
      } catch (err) {
        expect(err.name).toEqual('AuthenticationError');
        expect(err.status).toEqual(400);
        expect(err.message).toEqual('failed');
        expect(err.data).toEqual({ schema: false });
      }
    });

    it('should throw NetworkError when service is unavailable', async () => {
      server.use(
        http.get(mockUrl, () => {
          return HttpResponse.error();
        })
      );

      const requestParams = {
        method: HttpMethod.GET
      };

      await expect(serviceRequest(mockUrl, requestParams)).rejects.toThrow(NetworkError);
    });

    it('should throw TimeoutError when request times out', async () => {
      vi.useFakeTimers();

      server.use(http.get(mockUrl, () => HttpResponse.json(mockResponse)));

      const requestParams = {
        method: HttpMethod.GET
      };

      const promise = serviceRequest(mockUrl, requestParams);

      vi.advanceTimersByTime(10000);

      await expect(promise).rejects.toThrow(TimeoutError);
    });
  });
});
