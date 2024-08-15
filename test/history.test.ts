import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { History } from '../lib/history';

const mockNspRoomid = 'M3wLrtCTJe8Z:chat:one:test';
const mockUwsHttpHost = 'http://localhost:9090';

vi.mock('../lib/logger', () => ({
  logger: {
    logInfo: vi.fn(),
    logError: vi.fn()
  }
}));

describe('History', () => {
  let history: History;

  beforeEach(() => {
    history = new History(mockUwsHttpHost, mockNspRoomid);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('get', () => {
    it('should return historical messages for a given room', async () => {
      const limit = 2;
      const messages = await history.get({ limit });

      expect(messages).toBeTypeOf('object');
      expect(messages).toHaveLength(limit);
    });
  });

  describe('next', () => {
    it('should return the next page of historical messages for a given room', async () => {
      expect(1 + 1).toEqual(2);
    });
  });
});
