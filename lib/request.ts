import { HTTPRequestError, NetworkError } from './errors';
import { DsApiData, DsResponse } from './types/request.types';

const NODE_FETCH_ERR_MESSAGES = ['Failed to fetch'];

async function formatDsResponse<T>(response: Response): Promise<DsResponse<T>> {
  const data = <T & DsApiData>await response.json();

  return {
    status: response.status,
    data,
    ...(data.message && { message: data.message })
  };
}

export async function request<T>(url: URL | string, params: RequestInit): Promise<DsResponse<T>> {
  let response: Response;

  try {
    response = await fetch(url, { ...params, cache: 'no-store' });

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

  const formattedResponse = await formatDsResponse<T>(response);

  return formattedResponse;
}
