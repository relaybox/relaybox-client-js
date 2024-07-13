import { SocketEventHandler } from './types/socket.types';

export class EventRegistry {
  private readonly handlerRefs: Map<string, Map<SocketEventHandler, number>> = new Map();

  attachHandler(event: string, handler: SocketEventHandler): void {
    const handlerRefs = this.handlerRefs.get(event) || new Map();
    const refCount = handlerRefs.get(handler) || 0;

    handlerRefs.set(handler, refCount + 1);
    this.handlerRefs.set(event, handlerRefs);
  }

  detachHandlers(event: string, handler: SocketEventHandler): number {
    const handlerRefs = this.handlerRefs.get(event);

    if (handlerRefs) {
      const refCount = handlerRefs.get(handler) || 0;

      handlerRefs?.delete(handler);

      if (handlerRefs.size === 0) {
        this.handlerRefs.delete(event);
      }

      return refCount;
    }

    return 0;
  }

  getHandlersForEvent(event: string): Map<SocketEventHandler, number> | undefined {
    return this.handlerRefs.get(event);
  }

  getAllHandlers(): Map<string, Map<SocketEventHandler, number>> | undefined {
    return this.handlerRefs;
  }

  deleteHandler(event: string): void {
    this.handlerRefs.delete(event);
  }

  clearHandlers(): void {
    this.handlerRefs.clear();
  }
}
