import { describe, it, expect } from "vitest";
import { progressEmitter, type RunProgressEvent } from "../../../../src/api/websocket/progress.js";

describe("ProgressEmitter", () => {
  it("emits events to subscribers for the correct runId", () => {
    const received: RunProgressEvent[] = [];
    const unsubscribe = progressEmitter.onRun("run-1", (event) => {
      received.push(event);
    });

    progressEmitter.emit("run-1", { runId: "run-1", status: "running", percentage: 50 });

    unsubscribe();
    expect(received).toHaveLength(1);
    expect(received[0].status).toBe("running");
    expect(received[0].percentage).toBe(50);
  });

  it("does not emit to subscribers of a different runId", () => {
    const received: RunProgressEvent[] = [];
    const unsubscribe = progressEmitter.onRun("run-X", (event) => {
      received.push(event);
    });

    progressEmitter.emit("run-Y", { runId: "run-Y", status: "completed", percentage: 100 });

    unsubscribe();
    expect(received).toHaveLength(0);
  });

  it("stops delivering events after unsubscribe is called", () => {
    const received: RunProgressEvent[] = [];
    const unsubscribe = progressEmitter.onRun("run-2", (event) => {
      received.push(event);
    });

    progressEmitter.emit("run-2", { runId: "run-2", status: "running" });
    unsubscribe();
    progressEmitter.emit("run-2", { runId: "run-2", status: "completed" });

    expect(received).toHaveLength(1);
    expect(received[0].status).toBe("running");
  });

  it("delivers the same event to multiple subscribers of the same runId", () => {
    const received1: RunProgressEvent[] = [];
    const received2: RunProgressEvent[] = [];

    const unsub1 = progressEmitter.onRun("run-3", (e) => received1.push(e));
    const unsub2 = progressEmitter.onRun("run-3", (e) => received2.push(e));

    progressEmitter.emit("run-3", { runId: "run-3", status: "passed" });

    unsub1();
    unsub2();

    expect(received1).toHaveLength(1);
    expect(received2).toHaveLength(1);
    expect(received1[0].status).toBe("passed");
    expect(received2[0].status).toBe("passed");
  });
});
