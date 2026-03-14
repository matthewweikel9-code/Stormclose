export type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;

export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  subscribe<T = unknown>(eventName: string, handler: EventHandler<T>) {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, new Set());
    }

    const eventHandlers = this.handlers.get(eventName)!;
    eventHandlers.add(handler as EventHandler);

    return () => {
      eventHandlers.delete(handler as EventHandler);
      if (eventHandlers.size === 0) {
        this.handlers.delete(eventName);
      }
    };
  }

  async publish<T = unknown>(eventName: string, payload: T) {
    const eventHandlers = this.handlers.get(eventName);
    if (!eventHandlers || eventHandlers.size === 0) {
      return;
    }

    for (const handler of eventHandlers) {
      await Promise.resolve(handler(payload));
    }
  }

  clear(eventName?: string) {
    if (eventName) {
      this.handlers.delete(eventName);
      return;
    }

    this.handlers.clear();
  }
}

export const eventBus = new EventBus();