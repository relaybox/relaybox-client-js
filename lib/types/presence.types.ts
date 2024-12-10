import { AuthUserPublic } from './auth.types';

export interface PresenceEvent<T = any> {
  clientId: string;
  connectionId: string;
  timestamp: string;
  data: T;
  event: PresenceEventType;
  user?: AuthUserPublic;
}

export enum PresenceEventAllowedValue {
  JOIN = 'join',
  LEAVE = 'leave',
  UPDATE = 'update'
}

export type PresenceEventType = 'join' | 'leave' | 'update';

export interface PresenceGetOptions {
  limit?: number;
}
