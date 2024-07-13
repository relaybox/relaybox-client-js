import { Metrics } from './metrics';
import { Presence } from './presence';
import { SocketManager } from './socket-manager';

export class PresenceFactory {
  createPresence(socketManager: SocketManager, roomId: string, nspRoomId: string): Presence {
    return new Presence(socketManager, roomId, nspRoomId);
  }
}

export class MetricsFactory {
  createMetrics(socketManager: SocketManager, roomId: string): Metrics {
    return new Metrics(socketManager, roomId);
  }
}
