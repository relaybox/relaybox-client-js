import { ClientMessage } from './message.types';

export interface HistoryGetOptions {
  seconds?: number;
  limit?: number;
}

export interface HistoryResponse {
  messages: ClientMessage[];
  nextPageToken: string | null;
}
