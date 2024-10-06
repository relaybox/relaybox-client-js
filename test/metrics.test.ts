import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SocketManager } from '../lib/socket-manager';
import { MetricsEventAllowedValue, Metrics } from '../lib/metrics';
import { ClientEvent } from '../lib/types/event.types';

const mockCoreServiceUrl = process.env.CORE_SERVICE_URL || '';
const mockRoomid = 'room123';

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

describe('Metrics', () => {
  let metrics: Metrics;
  let socketManager: SocketManager;

  beforeEach(() => {
    socketManager = new SocketManager(mockCoreServiceUrl);
    metrics = new Metrics(socketManager, mockRoomid);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('subscribe, success', () => {
    it('should successfully subscribe single handler to metrics event', async () => {
      const handler = vi.fn();
      await metrics.subscribe(handler);
      expect(socketManagerEmitWithAck).toHaveBeenCalledWith(ClientEvent.ROOM_METRICS_SUBSCRIBE, {
        roomId: mockRoomid,
        event: MetricsEventAllowedValue.ALL
      });
      expect(metrics['handlerRefs'].get(handler)).toEqual(1);
    });

    it('should successfully subscribe multiple handlers to metrics event', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      await metrics.subscribe(handler1);
      await metrics.subscribe(handler1);
      await metrics.subscribe(handler2);

      expect(socketManagerEmitWithAck).toHaveBeenCalledWith(ClientEvent.ROOM_METRICS_SUBSCRIBE, {
        roomId: mockRoomid,
        event: MetricsEventAllowedValue.ALL
      });
      expect(metrics['handlerRefs'].get(handler1)).toEqual(2);
      expect(metrics['handlerRefs'].get(handler2)).toEqual(1);
    });
  });

  describe('unsubscribe, success', () => {
    it('should successfully unsubscribe from metrics" event', async () => {
      const handler = vi.fn();
      await metrics.unsubscribe(handler);
      expect(socketManagerEmitWithAck).toHaveBeenCalledWith(ClientEvent.ROOM_METRICS_UNSUBSCRIBE, {
        roomId: mockRoomid,
        event: MetricsEventAllowedValue.ALL
      });
      expect(metrics['handlerRefs'].get(handler)).toBeUndefined();
    });
  });

  describe('subscribe, error', () => {
    it('should throw an error when io server responds with error', async () => {
      const handler = vi.fn();
      socketManagerEmitWithAck.mockRejectedValueOnce(new Error());
      await expect(metrics.subscribe(handler)).rejects.toThrowError(Error);
    });
  });

  describe('unsubscribe, error', () => {
    it('should throw an error when io server responds with error', async () => {
      const handler = vi.fn();
      await metrics.subscribe(handler);
      socketManagerEmitWithAck.mockRejectedValueOnce(new Error());
      await expect(metrics.unsubscribe(handler)).rejects.toThrowError(Error);
    });

    it('should resolve to undefined when client attempts to unsubscribe from unknown handler', async () => {
      const handler = vi.fn();
      await expect(metrics.unsubscribe(handler)).resolves.toBeUndefined();
    });
  });
});
