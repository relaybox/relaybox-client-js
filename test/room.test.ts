import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Room } from '../lib/room';
import { SocketManager } from '../lib/socket-manager';
import {
  CloudStorageFactory,
  HistoryFactory,
  IntellectFactory,
  PresenceFactory
} from '../lib/factory';
import { MetricsFactory } from '../lib/factory';
import { ClientEvent } from '../lib/types/event.types';

const mockCoreServiceUrl = process.env.CORE_SERVICE_URL || '';
const mockHttpServiceUrl = process.env.HTTP_SERVICE_URL || '';
const mockintellectServiceUrl = process.env.INTELLECT_SERVICE_URL || '';
const mockStorageServiceUrl = process.env.STORAGE_SERVICE_URL || '';
const mockRoomId = 'roomId123';
const mockEvent = 'mock:event';
const mockAuthToken = 'eyJhbGc.eyJrZXlOYW1lIjoiRz:5hg9z5Gd4YI9jSw1Y66gz6q';

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

vi.mock('../lib/factory', () => ({
  PresenceFactory: vi.fn(() => ({
    createInstance: vi.fn(() => ({
      unsubscribe: vi.fn()
    }))
  })),
  MetricsFactory: vi.fn(() => ({
    createInstance: vi.fn(() => ({
      unsubscribe: vi.fn()
    }))
  })),
  HistoryFactory: vi.fn(() => ({
    createInstance: vi.fn(() => ({
      get: vi.fn()
    }))
  })),
  IntellectFactory: vi.fn(() => ({
    createInstance: vi.fn()
  })),
  CloudStorageFactory: vi.fn(() => ({
    createInstance: vi.fn()
  }))
}));

vi.mock('../lib/logger', () => ({
  logger: {
    logInfo: vi.fn(),
    logError: vi.fn()
  }
}));

describe('Room', () => {
  let room: Room;
  let socketManager: SocketManager;
  let presenceFactory: PresenceFactory;
  let metricsFactory: MetricsFactory;
  let historyFactory: HistoryFactory;
  let intellectFactory: IntellectFactory;
  let cloudStorageFactory: CloudStorageFactory;

  beforeEach(async () => {
    socketManager = new SocketManager(mockCoreServiceUrl);
    presenceFactory = new PresenceFactory();
    metricsFactory = new MetricsFactory();
    historyFactory = new HistoryFactory();
    intellectFactory = new IntellectFactory();
    cloudStorageFactory = new CloudStorageFactory();

    const getAuthToken = () => mockAuthToken;

    room = new Room(
      mockRoomId,
      socketManager,
      presenceFactory,
      metricsFactory,
      historyFactory,
      intellectFactory,
      cloudStorageFactory,
      mockHttpServiceUrl,
      mockintellectServiceUrl,
      mockStorageServiceUrl,
      getAuthToken
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should successfully create a room and confirm join', async () => {
    socketManagerEmitWithAck.mockResolvedValueOnce({
      nspRoomId: mockRoomId,
      visibility: 'public'
    });

    await expect(room.create()).resolves.toBe(room);

    expect(socketManager.emitWithAck).toHaveBeenCalledWith(ClientEvent.ROOM_JOIN, {
      roomId: mockRoomId
    });

    expect(presenceFactory.createInstance).toHaveBeenCalled();
    expect(metricsFactory.createInstance).toHaveBeenCalled();
    expect(historyFactory.createInstance).toHaveBeenCalled();
    expect(intellectFactory.createInstance).toHaveBeenCalled();
    expect(cloudStorageFactory.createInstance).toHaveBeenCalled();
  });

  it('should leave the room and perform necessary cleanup operations', async () => {
    socketManagerEmitWithAck.mockResolvedValueOnce({
      nspRoomId: mockRoomId,
      visibility: 'public'
    });

    await room.create();

    await expect(room.leave()).resolves.toBeUndefined();
    expect(socketManager.emitWithAck).toHaveBeenCalledWith(ClientEvent.ROOM_LEAVE, {
      roomId: mockRoomId
    });
  });

  it('should handle errors encountered while creating a room', async () => {
    (socketManager.emitWithAck as any).mockRejectedValueOnce(new Error('Join failed'));
    await expect(room.create()).rejects.toThrow('Join failed');
  });

  it('should bind an event handler and confirm sync', async () => {
    const handler = vi.fn();

    await expect(room.subscribe(mockEvent, handler)).resolves.toBe(room);

    expect(socketManager.emitWithAck).toHaveBeenCalledWith(ClientEvent.ROOM_SUBSCRIPTION_BIND, {
      roomId: mockRoomId,
      event: mockEvent
    });
  });

  it('should handle errors occurring during event subscription', async () => {
    const handler = vi.fn();

    (socketManager.emitWithAck as any).mockRejectedValueOnce(new Error('Subscription failed'));
    await expect(room.subscribe(mockEvent, handler)).rejects.toThrow('Subscription failed');
  });

  it('should unbind events and remove associated handlers"', async () => {
    const handler = vi.fn();

    await room.subscribe(mockEvent, handler);

    await expect(room.unsubscribe(mockEvent, handler)).resolves.toBe(room);
    expect(socketManager.emitWithAck).toHaveBeenCalledWith(ClientEvent.ROOM_SUBSCRIPTION_UNBIND, {
      roomId: mockRoomId,
      event: mockEvent
    });
  });

  it('should handle errors that occur during the process of unsubscribing from events', async () => {
    const handler = vi.fn();

    await room.subscribe(mockEvent, handler);

    (socketManager.emitWithAck as any).mockRejectedValueOnce(new Error('Unsubscibe failed'));
    await expect(room.unsubscribe(mockEvent, handler)).rejects.toThrow('Unsubscibe failed');
  });

  it('should successfully publish events and validate the publishing process', async () => {
    const data = { message: 'test' };

    await room.publish(mockEvent, data);

    expect(socketManager.emitWithAck).toHaveBeenCalledWith(ClientEvent.PUBLISH, {
      roomId: mockRoomId,
      event: mockEvent,
      data,
      opts: undefined,
      uuid: null
    });
  });

  it('should throw an error encountered when leaving a room', async () => {
    (socketManager.emitWithAck as any).mockRejectedValueOnce(new Error('Leave failed'));
    await expect(room.leave()).rejects.toThrow('Leave failed');
  });

  describe('event handler bindings', () => {
    let testRoom: Room;

    beforeEach(async () => {
      socketManagerEmitWithAck.mockResolvedValueOnce({
        nspRoomId: mockRoomId,
        visibility: 'public'
      });

      testRoom = await room.create();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should attach a handler to an event and verify the binding process', async () => {
      const handler = vi.fn();

      testRoom.subscribe('message', handler);

      const subscription = testRoom['getSubscriptionName']('message');

      expect(testRoom['eventRegistry'].getHandlersForEvent('message')?.get(handler)).toEqual(1);
      expect(socketManagerOn).toHaveBeenCalledWith(subscription, handler);
    });

    it('should bind multiple handlers to a single event and confirm correct bindings', async () => {
      const handler = vi.fn();

      testRoom.subscribe('message', handler);
      testRoom.subscribe('message', handler);

      const subscription = testRoom['getSubscriptionName']('message');

      expect(testRoom['eventRegistry'].getHandlersForEvent('message')?.get(handler)).toEqual(2);
      expect(socketManagerOn).toHaveBeenCalledTimes(2);
      expect(socketManagerOn).toHaveBeenCalledWith(subscription, handler);
    });

    it('should detach a handler from an event and validate the unbinding', async () => {
      const handler = vi.fn();

      testRoom.subscribe('message', handler);
      testRoom.unsubscribe('message', handler);

      const subscription = testRoom['getSubscriptionName']('message');

      expect(
        testRoom['eventRegistry'].getHandlersForEvent('message')?.get(handler)
      ).toBeUndefined();
      expect(socketManagerOff).toHaveBeenCalledWith(subscription, handler);
    });

    it('should individually unbind handlers from an event when specific handler is provided', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      testRoom.subscribe('message', handler1);
      testRoom.subscribe('message', handler1);
      testRoom.subscribe('message', handler2);
      testRoom.unsubscribe('message', handler1);

      const subscription = testRoom['getSubscriptionName']('message');

      expect(
        testRoom['eventRegistry'].getHandlersForEvent('message')?.get(handler1)
      ).toBeUndefined();
      expect(socketManagerOff).toHaveBeenCalledTimes(2);
      expect(socketManagerOff).toHaveBeenCalledWith(subscription, handler1);
    });

    it('should unbind all handlers from an event when no specific handler is provided', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      testRoom.subscribe('message', handler1);
      testRoom.subscribe('message', handler1);
      testRoom.subscribe('message', handler2);
      testRoom.subscribe('message', handler2);
      testRoom.unsubscribe('message');

      const subscription = testRoom['getSubscriptionName']('message');

      expect(testRoom['eventRegistry'].getHandlersForEvent('message')).toBeUndefined();
      expect(socketManagerOff).toHaveBeenCalledTimes(1);
      expect(socketManagerOff).toHaveBeenCalledWith(subscription);
    });

    it('should bind all events in the room to a named handler and verify the binding', async () => {
      const handler1 = vi.fn();

      testRoom.subscribe(handler1);
      testRoom.subscribe(handler1);

      const subscription = testRoom['getSubscriptionName']('$:subscribe:all');

      expect(
        testRoom['eventRegistry'].getHandlersForEvent('$:subscribe:all')?.get(handler1)
      ).toEqual(2);
      expect(socketManagerOn).toHaveBeenCalledWith(subscription, handler1);
    });

    it('should unbind all events in the room from a named handler and validate the process', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      testRoom.subscribe(handler1);
      testRoom.subscribe(handler1);
      testRoom.subscribe(handler2);
      testRoom.unsubscribe(handler1);

      const subscription = testRoom['getSubscriptionName']('$:subscribe:all');

      expect(
        testRoom['eventRegistry'].getHandlersForEvent('$:subscribe:all')?.get(handler1)
      ).toBeUndefined();
      expect(
        testRoom['eventRegistry'].getHandlersForEvent('$:subscribe:all')?.get(handler2)
      ).toEqual(1);
      expect(socketManagerOff).toHaveBeenCalledTimes(2);
      expect(socketManagerOff).toHaveBeenCalledWith(subscription, handler1);
    });

    it('should completely unbind all events from the room and ensure all handlers are removed', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      testRoom.subscribe(handler1);
      testRoom.subscribe(handler1);
      testRoom.subscribe(handler2);
      testRoom.subscribe('message', handler3);
      testRoom.unsubscribe();

      const subscription = testRoom['getSubscriptionName']('$:subscribe:all');

      expect(
        testRoom['eventRegistry'].getHandlersForEvent('$:subscribe:all')?.get(handler1)
      ).toBeUndefined();
      expect(
        testRoom['eventRegistry'].getHandlersForEvent('$:subscribe:all')?.get(handler2)
      ).toBeUndefined();
      expect(socketManagerOff).toHaveBeenCalledTimes(2);
      expect(socketManagerOff).toHaveBeenCalledWith(subscription);
    });
  });
});
