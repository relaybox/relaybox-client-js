import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { EventRegistry } from '../event-registry';

const mockEvent = 'test:event';
const mockEventAlt = 'test:event:alt';

let eventRegistry: EventRegistry;

beforeEach(() => {
  eventRegistry = new EventRegistry();
});

describe('EventRegistry', () => {
  it('should attach a handler to an event', () => {
    const handler = vi.fn();

    eventRegistry.attachHandler(mockEvent, handler);

    expect(eventRegistry.getHandlersForEvent(mockEvent)?.get(handler)).toEqual(1);
  });

  it('should attach multple handlers to an event', () => {
    const handler = vi.fn();

    eventRegistry.attachHandler(mockEvent, handler);
    eventRegistry.attachHandler(mockEvent, handler);

    expect(eventRegistry.getHandlersForEvent(mockEvent)?.get(handler)).toEqual(2);
  });

  it('should detach an attached handler from an event and clean up', () => {
    const handler = vi.fn();

    eventRegistry.attachHandler(mockEvent, handler);
    expect(eventRegistry.getHandlersForEvent(mockEvent)?.get(handler)).toEqual(1);

    eventRegistry.detachHandlers(mockEvent, handler);
    expect(eventRegistry.getHandlersForEvent(mockEvent)?.get(handler)).toBeUndefined();
  });

  it('should detach a named handler from an event and clean up', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    eventRegistry.attachHandler(mockEvent, handler1);
    eventRegistry.attachHandler(mockEvent, handler2);

    expect(eventRegistry.getHandlersForEvent(mockEvent)?.get(handler1)).toEqual(1);
    expect(eventRegistry.getHandlersForEvent(mockEvent)?.get(handler2)).toEqual(1);

    eventRegistry.detachHandlers(mockEvent, handler1);

    expect(eventRegistry.getHandlersForEvent(mockEvent)?.get(handler1)).toBeUndefined();
    expect(eventRegistry.getHandlersForEvent(mockEvent)?.get(handler2)).toEqual(1);
  });

  it('should delete all handlers from an event and clean up', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    eventRegistry.attachHandler(mockEvent, handler1);
    eventRegistry.attachHandler(mockEvent, handler2);

    expect(eventRegistry.getHandlersForEvent(mockEvent)?.get(handler1)).toEqual(1);
    expect(eventRegistry.getHandlersForEvent(mockEvent)?.get(handler2)).toEqual(1);

    eventRegistry.deleteHandler(mockEvent);

    expect(eventRegistry.getHandlersForEvent(mockEvent)?.get(handler1)).toBeUndefined();
    expect(eventRegistry.getHandlersForEvent(mockEvent)?.get(handler2)).toBeUndefined();
  });

  it('should clear all attached handlers', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    eventRegistry.attachHandler(mockEvent, handler1);
    eventRegistry.attachHandler(mockEventAlt, handler2);

    eventRegistry.clearHandlers();

    expect(eventRegistry.getHandlersForEvent(mockEvent)?.get(handler1)).toBeUndefined();
    expect(eventRegistry.getHandlersForEvent(mockEventAlt)?.get(handler2)).toBeUndefined();
  });
});
