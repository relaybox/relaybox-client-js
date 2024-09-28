import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SocketManager } from '../lib/socket-manager';
import { Presence } from '../lib/presence';
import { ClientEvent } from '../lib/types/event.types';
import { ValidationError } from '../lib/errors';
import { mock } from 'node:test';

const mockUwsServiceUrl = process.env.UWS_SERVICE_URL || '';
const mockRoomid = 'room123';
const mockNspRoomId = 'abc:room123';

const socketManagerOn = vi.fn();
const socketManagerOff = vi.fn();
const socketManagerEmitWithAck = vi.fn();

vi.mock('../lib/socket-manager', () => ({
  SocketManager: vi.fn(() => ({
    emitWithAck: socketManagerEmitWithAck,
    on: socketManagerOn,
    off: socketManagerOff,
    emit: vi.fn()
  }))
}));

vi.mock('../lib/logger', () => ({
  logger: {
    logInfo: vi.fn(),
    logError: vi.fn()
  }
}));

describe('Presence', () => {
  let presence: Presence;
  let socketManager: SocketManager;

  beforeEach(() => {
    socketManager = new SocketManager(mockUwsServiceUrl);
    presence = new Presence(socketManager, mockRoomid, mockNspRoomId);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('subscribe, success', () => {
    it('should successfully subscribe to presence "join" event', async () => {
      const handler = vi.fn();
      await presence.subscribe('join', handler);
      expect(socketManagerEmitWithAck).toHaveBeenCalledWith(ClientEvent.ROOM_PRESENCE_SUBSCRIBE, {
        roomId: mockRoomid,
        event: 'join'
      });
      expect(presence['eventRegistry'].getHandlersForEvent('join')?.size).toEqual(1);
    });

    it('should successfully subscribe to presence "leave" event', async () => {
      const handler = vi.fn();
      await presence.subscribe('leave', handler);
      expect(socketManagerEmitWithAck).toHaveBeenCalledWith(ClientEvent.ROOM_PRESENCE_SUBSCRIBE, {
        roomId: mockRoomid,
        event: 'leave'
      });
      expect(presence['eventRegistry'].getHandlersForEvent('leave')?.size).toEqual(1);
    });

    it('should successfully subscribe to presence "update" event', async () => {
      const handler = vi.fn();
      await presence.subscribe('update', handler);
      expect(socketManagerEmitWithAck).toHaveBeenCalledWith(ClientEvent.ROOM_PRESENCE_SUBSCRIBE, {
        roomId: mockRoomid,
        event: 'update'
      });
      expect(presence['eventRegistry'].getHandlersForEvent('update')?.size).toEqual(1);
    });
  });

  describe('unsubscribe, success', () => {
    it('should successfully unsubscribe from defined presence event', async () => {
      const handler = vi.fn();

      await presence.subscribe('join', handler);
      await presence.unsubscribe('join', handler);

      expect(socketManagerEmitWithAck).toHaveBeenCalledWith(ClientEvent.ROOM_PRESENCE_UNSUBSCRIBE, {
        roomId: mockRoomid,
        event: 'join'
      });
      expect(presence['eventRegistry'].getHandlersForEvent('join')).toBeUndefined();
    });

    it('should successfully unsubscribe from all presence events', async () => {
      const joinHandler = vi.fn();
      const leaveHandler = vi.fn();

      await presence.subscribe('join', joinHandler);
      await presence.subscribe('leave', leaveHandler);
      await presence.unsubscribe();

      expect(socketManagerEmitWithAck).toHaveBeenCalledWith(
        ClientEvent.ROOM_PRESENCE_UNSUBSCRIBE_ALL,
        {
          roomId: mockRoomid
        }
      );
      expect(presence['eventRegistry'].getHandlersForEvent('join')).toBeUndefined();
      expect(presence['eventRegistry'].getHandlersForEvent('leave')).toBeUndefined();
    });
  });

  describe('action, success', () => {
    it('should sucessfully perform join action', async () => {
      const userData = { id: 123 };
      await presence.join(userData);
      expect(socketManagerEmitWithAck).toHaveBeenCalledWith(ClientEvent.ROOM_PRESENCE_JOIN, {
        roomId: mockRoomid,
        userData
      });
    });

    it('should sucessfully perform leave action', async () => {
      const userData = { id: 123 };
      await presence.leave(userData);
      expect(socketManagerEmitWithAck).toHaveBeenCalledWith(ClientEvent.ROOM_PRESENCE_LEAVE, {
        roomId: mockRoomid,
        userData
      });
    });

    it('should sucessfully perform update action', async () => {
      const userData = { id: 123 };
      await presence.update(userData);
      expect(socketManagerEmitWithAck).toHaveBeenCalledWith(ClientEvent.ROOM_PRESENCE_UPDATE, {
        roomId: mockRoomid,
        userData
      });
    });

    it('should sucessfully retrieve presence set', async () => {
      const mockPresenceSet = [{ id: 1 }, { id: 2 }];
      socketManagerEmitWithAck.mockResolvedValueOnce(mockPresenceSet);

      const presenceSet = await presence.get();
      expect(presenceSet).toEqual(mockPresenceSet);
    });

    it('should sucessfully retrieve presence set', async () => {
      const mockPresenceCount = 12;
      socketManagerEmitWithAck.mockResolvedValueOnce(mockPresenceCount);

      const presenceCount = await presence.getCount();
      expect(presenceCount).toEqual(mockPresenceCount);
    });
  });

  describe('subscribe, error', () => {
    it('should throw an error when event is not one of "join", "leave" or "update"', async () => {
      const handler = vi.fn();

      // @ts-ignore
      await expect(presence.subscribe('destroy', handler)).rejects.toThrow(ValidationError);
      expect(socketManagerEmitWithAck).not.toHaveBeenCalled();
      expect(presence['eventRegistry'].getHandlersForEvent('destroy')).toBeUndefined();
    });

    it('should throw an error when io server responds with error', async () => {
      const handler = vi.fn();
      socketManagerEmitWithAck.mockRejectedValueOnce(new Error());
      await expect(presence.subscribe('join', handler)).rejects.toThrowError(Error);
    });
  });

  describe('unsubscribe, error', () => {
    it('should throw an error when client attempt to unsubscribe from non subscribed event', async () => {
      await expect(presence.unsubscribe('join')).rejects.toThrow(ValidationError);
      expect(socketManagerEmitWithAck).not.toHaveBeenCalled();
    });

    it('should throw an error when client attempts to unsubscribe from non subscribed event (1)', async () => {
      const handler = vi.fn();
      await presence.subscribe('leave', handler);
      await expect(presence.unsubscribe('join')).rejects.toThrow(ValidationError);
    });

    it('should return without sync when client attempt to unsubscribe from non subscribed event (all)', async () => {
      await presence.unsubscribe();
      expect(socketManagerEmitWithAck).not.toHaveBeenCalled();
    });

    it('should throw an error when client attempts to unsubscribe incorrect handler', async () => {
      const joinHandler = vi.fn();
      const leaveHandler = vi.fn();

      await presence.subscribe('join', joinHandler);
      await presence.subscribe('leave', leaveHandler);

      await expect(presence.unsubscribe('join', leaveHandler)).rejects.toThrow(ValidationError);
    });
  });
});
