import { ServerEventData } from './socket.types';

export interface HistoryGetOptions {
  seconds?: number;
  limit?: number;
}

export interface HistoryResponse {
  messages: ServerEventData[];
  nextPageToken: string | null;
}
