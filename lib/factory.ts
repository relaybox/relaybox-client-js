import { Metrics } from './metrics';
import { Presence } from './presence';
import { History } from './history';
import { SocketManager } from './socket-manager';
import { Intellect } from './intellect';

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

export class HistoryFactory {
  createHistory(
    roomId: string,
    httpServiceUrl: string,
    getAuthToken: () => string | null
  ): History {
    return new History(roomId, httpServiceUrl, getAuthToken);
  }
}

export class IntellectFactory {
  createIntellect(
    roomId: string,
    intellectServiceUrl: string,
    publish: <T>(event: string, userData: T) => Promise<any>,
    getAuthToken: () => string | null
  ): Intellect {
    return new Intellect(roomId, intellectServiceUrl, publish, getAuthToken);
  }
}
