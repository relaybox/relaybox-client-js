export type RoomVisibility = 'private' | 'public' | 'protected';

export const defaultRoomCreateOptions = {
  visibility: 'public'
};

export const defaultRoomJoinOptions = {};

export interface RoomCreateOptions {
  visibility?: RoomVisibility;
  password?: string;
}

export interface RoomAttachOptions {
  id: string;
  join: Function;
}

export interface RoomJoinOptions {
  password?: string;
}

export interface RoomJoinResponse {
  nspRoomId: string;
  visibility: RoomVisibility;
  passwordRequired: boolean;
}

export enum RoomEvent {
  PROTECTED_PASSWORD_REQUIRED = 'PROTECTED_PASSWORD_REQUIRED'
}
