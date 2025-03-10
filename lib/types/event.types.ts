export enum ClientEvent {
  DISCONNECT = 'disconnect',
  ROOM_CREATE = 'ds:client:room:create',
  ROOM_JOIN = 'ds:client:room:join',
  ROOM_LEAVE = 'ds:client:room:leave',
  ROOM_SUBSCRIPTION_BIND = 'ds:client:room:subscription:bind',
  ROOM_SUBSCRIPTION_UNBIND = 'ds:client:room:subscription:unbind',
  ROOM_PRESENCE_SUBSCRIBE = 'ds:client:room:presence:subscribe',
  ROOM_PRESENCE_UNSUBSCRIBE = 'ds:client:room:presence:unsubscribe',
  ROOM_PRESENCE_UNSUBSCRIBE_ALL = 'ds:client:room:presence:unsubscribe:all',
  ROOM_PRESENCE_JOIN = 'ds:client:room:presence:join',
  ROOM_PRESENCE_LEAVE = 'ds:client:room:presence:leave',
  ROOM_PRESENCE_UPDATE = 'ds:client:room:presence:update',
  ROOM_PRESENCE_GET = 'ds:client:room:presence:get',
  ROOM_PRESENCE_COUNT = 'ds:client:room:presence:count',
  ROOM_METRICS_SUBSCRIBE = 'ds:client:room:metrics:subscribe',
  ROOM_METRICS_UNSUBSCRIBE = 'ds:client:room:metrics:unsubscribe',
  ROOM_INTELLECT_SUBSCRIBE = 'ds:client:room:intellect:subscribe',
  ROOM_INTELLECT_UNSUBSCRIBE = 'ds:client:room:intellect:unsubscribe',
  ROOM_INTELLECT_UNSUBSCRIBE_ALL = 'ds:client:room:intellect:unsubscribe:all',
  ROOM_PASSWORD_UPDATE = 'ds:client:room:password:update',
  ROOM_MEMBER_ADD = 'ds:client:room:member:add',
  ROOM_MEMBER_REMOVE = 'ds:client:room:member:remove',
  ROOM_MEMBER_TYPE = 'ds:client:room:member:type',
  AUTH_USER_SUBSCRIBE = 'ds:client:auth:user:subscribe',
  AUTH_USER_UNSUBSCRIBE = 'ds:client:auth:user:unsubscribe',
  AUTH_USER_UNSUBSCRIBE_ALL = 'ds:client:auth:user:unsubscribe:all',
  AUTH_USER_STATUS_UPDATE = 'ds:client:auth:user:status:update',
  ROOM_HISTORY_GET = 'ds:client:room:history:get',
  PUBLISH = 'ds:client:publish'
}

export enum ServerEvent {
  CONNECTION_ACKNOWLEDGED = 'ds:server:connection:acknowledged',
  MESSAGE_ACKNOWLEDGED = 'ds:server:message:acknowledged'
}
