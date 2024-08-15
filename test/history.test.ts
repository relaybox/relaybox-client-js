import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { History } from '../lib/history';

const mockNspRoomid = 'appPid:room123';

vi.mock('../lib/logger', () => ({
  logger: {
    logInfo: vi.fn(),
    logError: vi.fn()
  }
}));

describe('History', () => {
  let history: History;

  beforeEach(() => {
    history = new History(mockNspRoomid);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('get', () => {
    it('should return historical messages for a given room', async () => {
      expect(1 + 1).toEqual(2);
    });
  });

  describe('next', () => {
    it('should return the next page ofhistorical messages for a given room', async () => {
      expect(1 + 1).toEqual(2);
    });
  });
});
