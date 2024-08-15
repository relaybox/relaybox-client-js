import { logger } from './logger';

/**
 * The History class handles subscribing to and unsubscribing from metrics events for a specific room.
 */
export class History {
  private readonly nspRoomId: string;

  /**
   * Creates an instance of History.
   * @param {string} nspRoomid - The ID of the room for which metrics are being managed.
   */
  constructor(nspRoomid: string) {
    this.nspRoomId = nspRoomid;
  }
}
