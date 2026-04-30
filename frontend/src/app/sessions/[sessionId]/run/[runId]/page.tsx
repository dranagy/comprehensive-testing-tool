"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/ui/StatusBadge";
import { run, connectRunProgress } from "@/lib/api-client";
import type { RunProgressEvent, ExecutionSummary } from "@/lib/types";

interface TestCaseProgress {
  id: string;
  name: string;
  status: string;
}

export default function RunProgressPage({ params }: { params: Promise<{ sessionId: string; runId: string }> }) {
  const { sessionId, runId } = use(params);
  const router = useRouter();
  const wsRef = useRef<WebSocket | null>(null);
  const [percentage, setPercentage] = useState(0);
  const [summary, setSummary] = useState<ExecutionSummary | null>(null);
  const [testCaseProgress, setTestCaseProgress] = useState<TestCaseProgress[]>([]);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ws = connectRunProgress(
      runId,
      (event: RunProgressEvent) => {
        if (event.percentage !== undefined) {
          setPercentage(event.percentage);
        }
        if (event.summary) {
          setSummary(event.summary);
        }
        if (event.testCaseId) {
          const tcId = event.testCaseId;
          const tcStatus = event.status === "completed" || event.status === "error" ? "passed" : event.status;
          setTestCaseProgress((prev) => {
            const exists = prev.find((t) => t.id === tcId);
            if (exists) {
              return prev.map((t) => (t.id === tcId ? { ...t, status: tcStatus } : t));
            }
            return [...prev, { id: tcId, name: tcId.slice(0, 8), status: tcStatus }];
          });
        }
        if (event.status === "completed" || event.status === "error") {
          setCompleted(true);
          ws.close();
        }
      },
      (err) => {
        setError("WebSocket connection error");
        console.error("WS error", err);
      },
    );
    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [runId]);

  async function handleCancel() {
    try {
      await run.cancel(sessionId, runId);
      wsRef.current?.close();
      setCompleted(true);
    } catch {}
  }

  const passed = summary?.passed ?? testCaseProgress.filter((t) => t.status === "passed").length;
  const failed = summary?.failed ?? testCaseProgress.filter((t) => t.status === "failed").length;
  const running = testCaseProgress.filter((t) => t.status === "running").length;
  const remaining = summary ? summary.total - (summary.passed + summary.failed + summary.errored + summary.skipped) : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-2xl text-foreground">Run Progress</h1>
        <div className="flex gap-2">
          {!completed && (
            <Button variant="danger" size="sm" onClick={handleCancel}>Cancel Run</Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => router.push(`/sessions/${sessionId}`)}>
            Back to Session
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-error-container text-error rounded-md text-sm">{error}</div>
      )}

      {/* Overall progress bar */}
      <div className="bg-surface rounded-lg border border-border-light p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">Overall Progress</span>
          <span className="text-sm font-bold text-primary">{percentage}%</span>
        </div>
        <div className="w-full bg-surface-dim rounded-full h-3">
          <div
            className="bg-primary h-3 rounded-full transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Live counters */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-success-container rounded-lg p-3 text-center">
          <p className="text-2xl font-display font-bold text-success">{passed}</p>
          <p className="text-xs font-medium text-success">Passed</p>
        </div>
        <div className="bg-error-container rounded-lg p-3 text-center">
          <p className="text-2xl font-display font-bold text-error">{failed}</p>
          <p className="text-xs font-medium text-error">Failed</p>
        </div>
        <div className="bg-info-container rounded-lg p-3 text-center">
          <p className="text-2xl font-display font-bold text-info">{running}</p>
          <p className="text-xs font-medium text-info">Running</p>
        </div>
        <div className="bg-surface-dim rounded-lg p-3 text-center">
          <p className="text-2xl font-display font-bold text-on-surface-variant">{remaining}</p>
          <p className="text-xs font-medium text-on-surface-variant">Remaining</p>
        </div>
      </div>

      {/* Test case list */}
      <div className="bg-surface rounded-lg border border-border-light max-h-80 overflow-y-auto">
        <div className="px-4 py-3 border-b border-border-light sticky top-0 bg-surface">
          <h2 className="font-display font-semibold text-sm text-foreground">Test Cases</h2>
        </div>
        {testCaseProgress.length === 0 ? (
          <div className="p-4 text-center text-xs text-on-surface-variant">Waiting for test results...</div>
        ) : (
          <div className="divide-y divide-border-light">
            {testCaseProgress.map((tc) => (
              <div key={tc.id} className="flex items-center gap-3 px-4 py-2.5">
                {tc.status === "passed" && (
                  <svg className="w-4 h-4 text-success shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {tc.status === "failed" && (
                  <svg className="w-4 h-4 text-error shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                {tc.status === "running" && (
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                )}
                {(tc.status === "errored" || tc.status === "skipped") && (
                  <svg className="w-4 h-4 text-on-surface-variant shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                )}
                <span className="text-sm text-on-surface truncate">{tc.name}</span>
                <span className="ml-auto"><StatusBadge status={tc.status === "errored" ? "ERROR" : tc.status === "skipped" ? "SKIPPED" : tc.status === "passed" ? "PASSED" : tc.status === "failed" ? "FAILED" : "PENDING"} /></span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completion summary */}
      {completed && summary && (
        <div className="bg-surface rounded-lg border border-border-light p-4 space-y-3">
          <h2 className="font-display font-semibold text-sm text-foreground">Run Complete</h2>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div><p className="text-lg font-bold text-success">{summary.passed}</p><p className="text-xs text-on-surface-variant">Passed</p></div>
            <div><p className="text-lg font-bold text-error">{summary.failed}</p><p className="text-xs text-on-surface-variant">Failed</p></div>
            <div><p className="text-lg font-bold text-error">{summary.errored}</p><p className="text-xs text-on-surface-variant">Errors</p></div>
            <div><p className="text-lg font-bold text-on-surface-variant">{summary.skipped}</p><p className="text-xs text-on-surface-variant">Skipped</p></div>
          </div>
          <Link href={`/sessions/${sessionId}/reports/summary`}>
            <Button>View Reports</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
