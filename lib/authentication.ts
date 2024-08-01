import { ValidationError } from './errors';
import { request } from './request';
import { AuthRequestOptions } from './types/auth.types';
import { TokenResponse } from './types/request.types';

export async function getAuthTokenResponse(
  authEndpoint?: string,
  authHeaders?: Record<string, unknown> | null,
  authParams?: Record<string, unknown> | null,
  authRequestOptions?: AuthRequestOptions | null,
  clientId?: string | number
): Promise<TokenResponse> {
  validateRequestParams(authHeaders, authParams, clientId);

  if (!authEndpoint) {
    throw new ValidationError(`No authentication endpoint provided`);
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

  if (clientId) {
    requestParams.headers['X-Client-Id'] = clientId.toString();
  }

  const { data: tokenResponse } = await request<TokenResponse>(
    formattedAuthEndpointUrl,
    requestParams
  );

  return tokenResponse;
}

function validateRequestParams(
  authHeaders?: Record<string, unknown> | null,
  authParams?: Record<string, unknown> | null,
  clientId?: string | number
) {
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

  if (clientId) {
    if (typeof clientId !== 'string' && typeof clientId !== 'number') {
      throw new ValidationError(
        `Please supply string or number for "clientId", (${clientId} supplied)`
      );
    }
  }
}

export function validateRequestOptions(opts: any): boolean {
  return typeof opts === 'object' && !Array.isArray(opts);
}

function isRelativePath(authEndpoint: string) {
  try {
    new URL(authEndpoint);
    return false;
  } catch {
    return true;
  }
}

export function getFormattedEndpointUrl(
  authEndpoint: string,
  authParams?: Record<string, unknown> | null
): URL {
  const isRelative = isRelativePath(authEndpoint);
  const baseUrl = isRelative ? window.origin : '';
  const formattedAuthEndpointUrl = baseUrl ? new URL(authEndpoint, baseUrl) : new URL(authEndpoint);

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
    }
    // body: JSON.stringify(body)
  });

  return data;
}
