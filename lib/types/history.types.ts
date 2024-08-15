import { ClientMessage } from './message.types';

export interface HistoryGetOptions {
  seconds?: number;
  limit?: number;
  https?: boolean;
}

export interface HistoryResponse {
  messages: ClientMessage[];
  nextPageToken: string | null;
}
