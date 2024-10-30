import { Metrics } from './metrics';
import { Presence } from './presence';
import { History } from './history';
import { SocketManager } from './socket-manager';
import { Auth } from './auth';
import { TokenResponse } from './types';

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
    socketManager: SocketManager,
    nspRoomId: string,
    roomId: string,
    httpServiceUrl: string,
    getTokenResponse: () => TokenResponse | null
  ): History {
    return new History(socketManager, nspRoomId, roomId, httpServiceUrl, getTokenResponse);
  }
}
