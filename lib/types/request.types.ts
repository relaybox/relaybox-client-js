export interface ApiData {
  message?: string;
}

export interface FormattedResponse<T> {
  status: number;
  data?: T;
  message?: string;
}

export interface TokenResponse {
  token: string;
  expiresIn: number;
}

export interface KeyData {
  apiKey: string;
  clientId?: string | number;
}
