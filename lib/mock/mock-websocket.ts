type EventCallback = (event?: any) => void;

class MockCloseEvent {
  type: string;
  code: number;
  reason: string;
  wasClean: boolean;

  constructor(type: string, init: { code?: number; reason?: string; wasClean?: boolean } = {}) {
    this.type = type;
    this.code = init.code || 1000;
    this.reason = init.reason || '';
    this.wasClean = init.wasClean || false;
  }
}

class MockWebSocket {
  url: string;
  readyState: number;
  onopen: ((this: WebSocket, ev: Event) => any) | null = null;
  onmessage: ((this: WebSocket, ev: MessageEvent) => any) | null = null;
  onclose: ((this: WebSocket, ev: MockCloseEvent) => any) | null = null;
  onerror: ((this: WebSocket, ev: Event) => any) | null = null;

  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url: string) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;

    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;

      if (this.onopen) {
        this.onopen.call(this as any, new Event('open'));
      }
    }, 10);
  }

  send(message: string) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }

    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage.call(this as any, new MessageEvent('message', { data: message }));
      }
    }, 10);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;

    if (this.onclose) {
      this.onclose.call(this as any, new MockCloseEvent('close'));
    }
  }

  addEventListener(event: string, callback: EventCallback) {
    switch (event) {
      case 'open':
        this.onopen = callback as (this: WebSocket, ev: Event) => any;
        break;

      case 'message':
        this.onmessage = callback as (this: WebSocket, ev: MessageEvent) => any;
        break;

      case 'close':
        this.onclose = callback as (this: WebSocket, ev: MockCloseEvent) => any;
        break;

      case 'error':
        this.onerror = callback as (this: WebSocket, ev: Event) => any;
        break;
    }
  }

  removeEventListener(event: string, callback: EventCallback) {
    switch (event) {
      case 'open':
        if (this.onopen === callback) {
          this.onopen = null;
        }
        break;

      case 'message':
        if (this.onmessage === callback) {
          this.onmessage = null;
        }
        break;

      case 'close':
        if (this.onclose === callback) {
          this.onclose = null;
        }
        break;

      case 'error':
        if (this.onerror === callback) {
          this.onerror = null;
        }
        break;
    }
  }

  dispatchEvent(event: string, data?: any) {
    switch (event) {
      case 'open':
        if (this.onopen) {
          this.onopen.call(this as any, new Event('open'));
        }
        break;

      case 'message':
        if (this.onmessage) {
          this.onmessage.call(this as any, new MessageEvent('message', { data }));
        }
        break;

      case 'close':
        if (this.onclose) {
          this.onclose.call(this as any, new MockCloseEvent('close'));
        }
        break;

      case 'error':
        if (this.onerror) {
          this.onerror.call(this as any, new Event('error'));
        }
        break;
    }
  }
}

global.WebSocket = MockWebSocket as any;

export default MockWebSocket;
