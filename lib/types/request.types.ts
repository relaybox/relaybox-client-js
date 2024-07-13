export interface DsApiData {
  message?: string;
}

export interface DsResponse<T> {
  status: number;
  data: T;
  message?: string;
}
