import { vi } from 'vitest';

const eventHandlers: any = {};

export const eventEmitter = {
  on: vi.fn((event, handler) => {
    if (!eventHandlers[event]) {
      eventHandlers[event] = [];
    }

    eventHandlers[event].push(handler);
  }),

  off: vi.fn((event, handler) => {
    if (eventHandlers[event]) {
      const index = eventHandlers[event].indexOf(handler);

      if (index !== -1) {
        eventHandlers[event].splice(index, 1);
      }
    }
  }),

  emit: vi.fn((event, ...args) => {
    if (eventHandlers[event]) {
      eventHandlers[event].forEach((handler: any) => handler(...args));
    }
  }),

  once: vi.fn((event, handler) => {
    const onceHandler = (...args: any[]) => {
      handler(...args);
      eventEmitter.off(event, onceHandler);
    };

    eventEmitter.on(event, onceHandler);
  }),

  clearAll: vi.fn(() => {
    Object.keys(eventHandlers).forEach((event) => {
      delete eventHandlers[event];
    });
  })
};
