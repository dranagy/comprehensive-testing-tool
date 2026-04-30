"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { run, review } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import type { BrowserType, TestPhase } from "@/lib/types";

type SelectionMode = "all" | "phase" | "specific" | "failed" | "tag";

const BROWSER_OPTIONS: Array<{ value: BrowserType; label: string }> = [
  { value: "chromium", label: "Chromium" },
  { value: "firefox", label: "Firefox" },
  { value: "webkit", label: "WebKit" },
];

export default function RunPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const [mode, setMode] = useState<SelectionMode>("all");
  const [phase, setPhase] = useState<TestPhase>("FUNCTIONAL");
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [browser, setBrowser] = useState<string>("");
  const [parallel, setParallel] = useState(1);
  const [timeout, setTimeout] = useState(30000);
  const [dryRun, setDryRun] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableTests, setAvailableTests] = useState<Array<{ id: string; name: string }>>([]);
  const { showToast } = useToast();

  useEffect(() => {
    if (mode === "specific") {
      review.listTestCases(sessionId, { status: "APPROVED" })
        .then((tests) => setAvailableTests(tests.map((t) => ({ id: t.id, name: t.name }))))
        .catch((err) => showToast(err instanceof Error ? err.message : "Failed to load tests", "error"));
    }
  }, [sessionId, mode]);

  function toggleTestId(id: string) {
    setSelectedTestIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleStart() {
    setStarting(true);
    setError(null);
    try {
      const opts: Parameters<typeof run.start>[1] = {};
      if (mode === "phase") opts.phase = phase;
      if (mode === "specific") opts.testIds = selectedTestIds;
      if (mode === "failed") opts.failed = true;
      if (mode === "tag") opts.tags = tagInput.split(",").map((t) => t.trim()).filter(Boolean);
      if (browser) opts.browser = browser;
      if (parallel > 1) opts.parallel = parallel;
      if (timeout !== 30000) opts.timeout = timeout;
      if (dryRun) opts.dryRun = true;

      const result = await run.start(sessionId, opts);
      router.push(`/sessions/${sessionId}/run/${result.runId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start run");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-2xl text-foreground">Run Tests</h1>
        <Button variant="secondary" onClick={() => router.push(`/sessions/${sessionId}`)}>
          Back to Session
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-error-container text-error rounded-md text-sm">{error}</div>
      )}

      {/* Test selection */}
      <div className="bg-surface rounded-lg border border-border-light p-4 space-y-3">
        <h2 className="font-display font-semibold text-sm text-foreground">Test Selection</h2>
        <div className="space-y-2">
          {([
            { value: "all", label: "All approved tests" },
            { value: "phase", label: "By phase" },
            { value: "specific", label: "Specific tests" },
            { value: "failed", label: "Failed only" },
            { value: "tag", label: "By tag" },
          ] as const).map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm text-on-surface cursor-pointer">
              <input
                type="radio"
                name="selection"
                checked={mode === opt.value}
                onChange={() => setMode(opt.value)}
                className="text-primary"
              />
              {opt.label}
            </label>
          ))}
        </div>

        {mode === "phase" && (
          <select value={phase} onChange={(e) => setPhase(e.target.value as TestPhase)} className="px-3 py-1.5 border border-border rounded text-sm bg-surface text-foreground">
            <option value="FUNCTIONAL">Functional</option>
            <option value="PERFORMANCE">Performance</option>
            <option value="SECURITY">Security</option>
          </select>
        )}

        {mode === "specific" && (
          <div className="max-h-48 overflow-y-auto space-y-1 border border-border-light rounded p-2">
            {availableTests.map((t) => (
              <label key={t.id} className="flex items-center gap-2 text-sm text-on-surface cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTestIds.includes(t.id)}
                  onChange={() => toggleTestId(t.id)}
                  className="rounded border-border"
                />
                {t.name}
              </label>
            ))}
            {availableTests.length === 0 && <p className="text-xs text-on-surface-variant">No approved tests available.</p>}
          </div>
        )}

        {mode === "tag" && (
          <input
            type="text"
            placeholder="Comma-separated tags"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            className="w-full px-3 py-1.5 border border-border rounded text-sm bg-surface text-foreground"
          />
        )}
      </div>

      {/* Configuration */}
      <div className="bg-surface rounded-lg border border-border-light p-4 space-y-3">
        <h2 className="font-display font-semibold text-sm text-foreground">Configuration</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">Browser</label>
            <select value={browser} onChange={(e) => setBrowser(e.target.value)} className="w-full px-2 py-1.5 border border-border rounded text-sm bg-surface text-foreground">
              <option value="">Default</option>
              {BROWSER_OPTIONS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">Parallel Workers</label>
            <input type="number" min={1} max={16} value={parallel} onChange={(e) => setParallel(Number(e.target.value))} className="w-full px-2 py-1.5 border border-border rounded text-sm bg-surface text-foreground" />
          </div>
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">Timeout (ms)</label>
            <input type="number" min={1000} step={1000} value={timeout} onChange={(e) => setTimeout(Number(e.target.value))} className="w-full px-2 py-1.5 border border-border rounded text-sm bg-surface text-foreground" />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-on-surface cursor-pointer">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="rounded border-border"
              />
              Dry Run
            </label>
          </div>
        </div>
      </div>

      <Button size="lg" onClick={handleStart} disabled={starting || (mode === "specific" && selectedTestIds.length === 0)}>
        {starting ? "Starting..." : "Run Tests"}
      </Button>
    </div>
  );
}
