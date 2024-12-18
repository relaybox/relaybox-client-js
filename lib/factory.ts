import { Metrics } from './metrics';
import { Presence } from './presence';
import { History } from './history';
import { SocketManager } from './socket-manager';
import { Intellect } from './intellect';
import { CloudStorage } from './cloud-storage';

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

export class IntellectFactory {
  createInstance(
    socketManager: SocketManager,
    nspRoomId: string,
    roomId: string,
    stateServiceUrl: string,
    getAuthToken: () => string | null
  ): Intellect {
    return new Intellect(socketManager, nspRoomId, roomId, stateServiceUrl, getAuthToken);
  }
}

export class CloudStorageFactory {
  createInstance(
    roomId: string,
    storageServiceUrl: string,
    getAuthToken: () => string | null
  ): CloudStorage {
    return new CloudStorage(roomId, storageServiceUrl, getAuthToken);
  }
}
