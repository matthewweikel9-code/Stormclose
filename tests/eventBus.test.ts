import { describe, it, expect, vi } from "vitest";
import { EventBus } from "../src/lib/eventBus";

describe("EventBus", () => {
  it("delivers events to all subscribers in order", async () => {
    const bus = new EventBus();
    const received: number[] = [];

    bus.subscribe<number>("test.event", (n) => void received.push(n * 1));
    bus.subscribe<number>("test.event", (n) => void received.push(n * 2));

    await bus.publish("test.event", 3);

    expect(received).toEqual([3, 6]);
  });

  it("does not throw when no subscribers exist", async () => {
    const bus = new EventBus();
    await expect(bus.publish("no.subscribers", { foo: 1 })).resolves.toBeUndefined();
  });

  it("isolates a throwing subscriber so remaining handlers still fire", async () => {
    const bus = new EventBus();
    const spy = vi.fn();

    bus.subscribe("bad.event", () => {
      throw new Error("handler exploded");
    });
    bus.subscribe("bad.event", spy);

    // Should not throw — error is caught and logged internally
    await expect(bus.publish("bad.event", "payload")).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith("payload");
  });

  it("unsubscribe stops delivery to that handler", async () => {
    const bus = new EventBus();
    const spy = vi.fn();
    const unsubscribe = bus.subscribe("my.event", spy);

    await bus.publish("my.event", 1);
    unsubscribe();
    await bus.publish("my.event", 2);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(1);
  });

  it("clear() removes all handlers", async () => {
    const bus = new EventBus();
    const spy = vi.fn();
    bus.subscribe("evt", spy);
    bus.clear();
    await bus.publish("evt", 99);
    expect(spy).not.toHaveBeenCalled();
  });
});
