import { EventEmitter } from "node:events";

export interface RunProgressEvent {
  runId: string;
  testCaseId?: string;
  status: "running" | "passed" | "failed" | "errored" | "skipped" | "completed" | "error";
  message?: string;
  percentage?: number;
  summary?: {
    total: number;
    passed: number;
    failed: number;
    errored: number;
    skipped: number;
  };
}

class ProgressEmitter extends EventEmitter {
  emit(runId: string, event: RunProgressEvent): boolean {
    return super.emit(`run:${runId}`, event);
  }

  onRun(runId: string, listener: (event: RunProgressEvent) => void): () => void {
    const channel = `run:${runId}`;
    super.on(channel, listener);
    return () => { super.off(channel, listener); };
  }
}

export const progressEmitter = new ProgressEmitter();
