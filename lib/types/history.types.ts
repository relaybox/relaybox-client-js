import { ClientMessage } from '../client-message';

export type HistoryOrder = 'asc' | 'desc';

export interface HistoryGetOptions {
  offset?: number;
  limit?: number;
  start?: number;
  end?: number;
  order?: HistoryOrder;
  event?: string;
}

export interface HistoryResponse {
  messages: ClientMessage[];
  nextPageToken: string | null;
}

export interface HistoryClientResponse {
  items: ClientMessage[];
  next: (() => Promise<HistoryClientResponse>) | null;
}

export interface PaginatedHistoryClientResponse {
  items: ClientMessage[];
  nextPageToken: string | null;
}

export enum HistoryQueryParam {
  START = 'start',
  END = 'end',
  SECONDS = 'seconds',
  OFFSET = 'offset',
  LIMIT = 'limit',
  ITEMS = 'items',
  ORDER = 'order',
  NEXT_PAGE_TOKEN = 'nextPageToken'
}
