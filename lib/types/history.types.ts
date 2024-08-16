import { ClientMessage } from './message.types';

export interface HistoryGetOptions {
  seconds?: number;
  limit?: number;
  https?: boolean;
  items?: number;
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
