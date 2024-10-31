import { ClientMessage } from './message.types';

export type HistoryOrder = 'asc' | 'desc';

export interface HistoryGetOptions {
  start?: number;
  end?: number;
  seconds?: number;
  limit?: number;
  https?: boolean;
  items?: number;
  order?: HistoryOrder;
}

export interface HistoryGetOptionsV2 {
  offset?: number;
  limit?: number;
  start?: number;
  end?: number;
  order?: HistoryOrder;
}

export interface HistoryResponse {
  messages: ClientMessage[];
  nextPageToken: string | null;
  itemsRemaining?: number;
}

export interface HistoryClientResponse {
  items: ClientMessage[];
  next?: () => Promise<HistoryClientResponse> | HistoryClientResponse;
}

export interface PaginatedHistoryClientResponse {
  count: number;
  data: ClientMessage[];
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
