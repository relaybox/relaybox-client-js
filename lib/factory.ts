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
    getAuthToken: () => string | null
  ): History {
    return new History(roomId, httpServiceUrl, getAuthToken);
  }
}

export class IntellectFactory {
  createInstance(
    roomId: string,
    intellectServiceUrl: string,
    publish: <T>(event: string, userData: T) => Promise<any>,
    getAuthToken: () => string | null
  ): Intellect {
    return new Intellect(roomId, intellectServiceUrl, publish, getAuthToken);
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
