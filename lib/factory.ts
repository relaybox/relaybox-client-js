import { Metrics } from './metrics';
import { Presence } from './presence';
import { History } from './history';
import { SocketManager } from './socket-manager';

export class PresenceFactory {
  createInstance(socketManager: SocketManager, roomId: string, nspRoomId: string): Presence {
    return new Presence(socketManager, roomId, nspRoomId);
  }
}

export class MetricsFactory {
  createInstance(socketManager: SocketManager, roomId: string): Metrics {
    return new Metrics(socketManager, roomId);
  }
}

export class HistoryFactory {
  createInstance(
    roomId: string,
    httpServiceUrl: string,
    stateServiceUrl: string,
    getAuthToken: () => string | null
  ): History {
    return new History(roomId, httpServiceUrl, stateServiceUrl, getAuthToken);
  }
}
