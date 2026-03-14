// Handlers may return void, a Promise, or any value — the bus discards the return.
export type EventHandler<T = unknown> = (payload: T) => unknown;

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
      try {
        await Promise.resolve(handler(payload));
      } catch (err) {
        // Isolate handler failures so one bad subscriber cannot block others
        // or surface unhandled promise rejections to the caller.
        console.error(`[EventBus] Handler for "${eventName}" threw:`, err);
      }
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