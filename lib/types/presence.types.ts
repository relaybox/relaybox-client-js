export interface PresenceEvent<T = any> {
  id: string;
  timestamp: string;
  data: T;
}
export enum PresenceEventAllowedValue {
  JOIN = 'join',
  LEAVE = 'leave',
  UPDATE = 'update'
}

export type PresenceEventType = 'join' | 'leave' | 'update';
