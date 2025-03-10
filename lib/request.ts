import { HTTPRequestError, HTTPServiceError, NetworkError, TimeoutError } from './errors';
import { ApiData, FormattedResponse } from './types/request.types';

const NODE_FETCH_ERR_MESSAGES = ['Failed to fetch'];
const DEFAULT_REQUEST_TIMEOUT_MS = 10000;

export const defaultHeaders = {
  Accept: 'application/json',
  'Content-Type': 'application/json'
};

async function formatResponse<T>(response: Response): Promise<FormattedResponse<T & ApiData>> {
  const data = <T & ApiData>await response.json();

  return {
    status: response.status,
    data,
    ...(data.message && { message: data.message })
  };
}

export async function request<T>(
  url: URL | string,
  params: RequestInit
): Promise<FormattedResponse<T>> {
  let response: Response;

  try {
    response = await fetch(url, {
      ...params,
      cache: 'no-store',
      signal: AbortSignal.timeout(DEFAULT_REQUEST_TIMEOUT_MS)
    });

    if (!response.ok) {
      throw new HTTPRequestError(`${response.status} ${response.statusText}`, response.status);
    }

    const formattedResponse = await formatResponse<T>(response);

    return formattedResponse;
  } catch (err: unknown) {
    if (err instanceof TypeError && NODE_FETCH_ERR_MESSAGES.includes(err.message)) {
      throw new NetworkError('Network request failed: Unable to connect to the server', 0);
    } else if (err instanceof DOMException && err.name === TimeoutError.name) {
      throw new TimeoutError(err.message);
    }

    throw err;
  }
}

export async function serviceRequest<T>(url: URL | string, params: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, {
      ...params,
      cache: 'no-store',
      signal: AbortSignal.timeout(DEFAULT_REQUEST_TIMEOUT_MS)
    });

    const data = <T & ApiData>await response.json();

    if (!response.ok) {
      throw new HTTPServiceError(response.status, data.message || 'Service request failed', data);
    }

    return data;
  } catch (err: unknown) {
    if (err instanceof TypeError && NODE_FETCH_ERR_MESSAGES.includes(err.message)) {
      throw new NetworkError('Network request failed: Unable to connect to the server', 0);
    } else if (err instanceof DOMException && err.name === TimeoutError.name) {
      throw new TimeoutError(err.message);
    } else {
      throw err;
    }
  }
}
