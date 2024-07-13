import { ValidationError } from './errors';
import { request } from './request';
import { DsAuthRequestOptions, DsTokenResponse } from './types/ds.types';

export async function getAuthTokenResponse(
  authEndpoint?: string,
  authHeaders?: Record<string, unknown> | null,
  authParams?: Record<string, unknown> | null,
  authRequestOptions?: DsAuthRequestOptions | null
): Promise<DsTokenResponse> {
  if (!authEndpoint) {
    throw new ValidationError(`No authentication endpoint provided`);
  }

  if (authHeaders && !validateRequestOptions(authHeaders)) {
    throw new ValidationError(`Please supply authentication headers as key, value pairs`);
  }

  if (authParams && !validateRequestOptions(authParams)) {
    throw new ValidationError(`Please supply authentication parameters as key, value pairs`);
  }

  if (authHeaders) {
    Object.entries(authHeaders).forEach(([key, value]) => {
      if (typeof value !== 'string' && typeof value !== 'number') {
        throw new ValidationError(`Please supply string or number for ${key}, (${value} supplied)`);
      }
    });
  }

  const formattedAuthEndpointUrl = getFormattedEndpointUrl(authEndpoint, authParams);

  const requestParams = <RequestInit>{
    method: authRequestOptions?.method || 'GET',
    ...(authRequestOptions && { ...authRequestOptions })
  };

  requestParams.headers = {
    'Content-Type': 'application/json',
    ...(authHeaders && { ...authHeaders })
  };

  const { data: tokenResponse } = await request<DsTokenResponse>(
    formattedAuthEndpointUrl,
    requestParams
  );

  return tokenResponse;
}

function validateRequestOptions(opts: any): boolean {
  return typeof opts === 'object' && !Array.isArray(opts);
}

function getFormattedEndpointUrl(
  authEndpoint: string,
  authParams?: Record<string, unknown> | null
): URL {
  const formattedAuthEndpointUrl = new URL(authEndpoint);

  if (authParams) {
    Object.entries(authParams).forEach(([key, value]) => {
      if (typeof value === 'string' || typeof value === 'number') {
        formattedAuthEndpointUrl.searchParams.append(key, value.toString());
      } else {
        throw new ValidationError(`Please supply string or number for ${key}, (${value} supplied)`);
      }
    });
  }

  return formattedAuthEndpointUrl;
}

export async function getSignedAuthObject(
  authEndpoint: string,
  appKey: string,
  socketId: string,
  room: string
): Promise<any> {
  const body = {
    socketId,
    room
  };

  const { data } = await request<{ authObject: string }>(authEndpoint, {
    method: 'GET',
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json',
      'X-Ds-App-Key': appKey
    },
    body: JSON.stringify(body)
  });

  return data;
}
