export type RoomType = 'private' | 'public';

export const defaultRoomCreateOptions = {
  type: 'public'
};

export const defaultRoomJoinOptions = {};

export interface RoomCreateOptions {
  type?: RoomType;
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
  type: RoomType;
}
