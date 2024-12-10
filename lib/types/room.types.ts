import { AuthUserPublic } from './auth.types';
import { IntellectPublishOptions } from './intellect.types';

export type RoomVisibility = 'private' | 'public' | 'protected';

export const defaultRoomCreateOptions = {
  visibility: 'public'
};

export const defaultRoomJoinOptions = {};

export interface RoomCreateOptions {
  visibility?: RoomVisibility;
  password?: string;
  roomName?: string;
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
  roomName: string;
  visibility: RoomVisibility;
  passwordRequired: boolean;
  memberType: RoomMemberType;
}

export interface RoomPublishOptions {
  intellect?: IntellectPublishOptions;
}

export enum RoomMemberType {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member'
}

export interface RoomMember {
  clientId: string;
  memberType: RoomMemberType;
  createdAt: string;
  user?: AuthUserPublic;
}

export enum RoomEvent {
  PROTECTED_PASSWORD_REQUIRED = 'PROTECTED_PASSWORD_REQUIRED'
}
