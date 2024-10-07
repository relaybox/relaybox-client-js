import { HTTPRequestError, HTTPServiceError, NetworkError } from './errors';
import { ApiData, FormattedResponse } from './types/request.types';

const NODE_FETCH_ERR_MESSAGES = ['Failed to fetch'];
const DEFAULT_REQUEST_TIMEOUT = 10000;

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
      signal: AbortSignal.timeout(1)
    });

    if (!response.ok) {
      throw new HTTPRequestError(`${response.status} ${response.statusText}`, response.status);
    }
  } catch (err: unknown) {
    if (err instanceof TypeError && NODE_FETCH_ERR_MESSAGES.includes(err.message)) {
      throw new NetworkError('Network request failed: Unable to connect to the server', 0);
    } else {
      throw err;
    }
  }

  const formattedResponse = await formatResponse<T>(response);

  return formattedResponse;
}

export async function serviceRequest<T>(url: URL | string, params: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, {
      ...params,
      cache: 'no-store',
      signal: AbortSignal.timeout(DEFAULT_REQUEST_TIMEOUT)
    });

    const data = <T & ApiData>await response.json();

    if (!response.ok) {
      throw new HTTPServiceError(response.status, data.message || 'Service request failed', data);
    }

    return data;
  } catch (err: unknown) {
    if (err instanceof TypeError && NODE_FETCH_ERR_MESSAGES.includes(err.message)) {
      throw new NetworkError('Network request failed: Unable to connect to the server', 0);
    } else {
      throw err;
    }
  }
}
