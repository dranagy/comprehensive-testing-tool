"use client";

import { Fragment, use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/ui/StatusBadge";
import { reports } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";

interface FunctionalResult {
  id: string;
  name: string;
  status: string;
  durationMs: number | null;
  browser: string | null;
  errorMessage: string | null;
}

interface FunctionalData {
  total: number;
  summary: { total: number; passed: number; failed: number; errored: number; skipped: number };
  results: FunctionalResult[];
}

const STATUS_COLORS: Record<string, string> = {
  PASSED: "#16a34a",
  FAILED: "#dc2626",
  ERROR: "#ea580c",
  SKIPPED: "#6b7280",
};

export default function FunctionalReportPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const [data, setData] = useState<FunctionalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [browserFilter, setBrowserFilter] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { showToast } = useToast();

  useEffect(() => {
    setLoading(true);
    reports.functional(sessionId, statusFilter || undefined)
      .then((d) => setData(d as FunctionalData))
      .catch((err) => showToast(err instanceof Error ? err.message : "Failed to load report", "error"))
      .finally(() => setLoading(false));
  }, [sessionId, statusFilter]);

  const filteredResults = (data?.results ?? []).filter((r) => {
    if (browserFilter && r.browser !== browserFilter) return false;
    return true;
  });

  const browsers = [...new Set((data?.results ?? []).map((r) => r.browser).filter((b): b is string => typeof b === "string"))];

  // Build duration histogram data
  const durationBuckets = buildDurationBuckets(data?.results ?? []);

  // Status distribution for bar chart
  const statusData = data ? [
    { name: "Passed", count: data.summary.passed, color: STATUS_COLORS.PASSED },
    { name: "Failed", count: data.summary.failed, color: STATUS_COLORS.FAILED },
    { name: "Error", count: data.summary.errored, color: STATUS_COLORS.ERROR },
    { name: "Skipped", count: data.summary.skipped, color: STATUS_COLORS.SKIPPED },
  ] : [];

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-2xl text-foreground">Functional Report</h1>
        <Button variant="secondary" onClick={() => router.push(`/sessions/${sessionId}/reports/summary`)}>
          Back to Summary
        </Button>
      </div>

      {/* Charts */}
      {data && data.results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Status distribution */}
          <div className="bg-surface rounded-lg border border-border-light p-4">
            <h2 className="font-display font-semibold text-sm text-foreground mb-3">Test Results</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={statusData.filter((d) => d.count > 0)}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {statusData.filter((d) => d.count > 0).map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Duration histogram */}
          <div className="bg-surface rounded-lg border border-border-light p-4">
            <h2 className="font-display font-semibold text-sm text-foreground mb-3">Duration Distribution</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={durationBuckets}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => [value, "Tests"]} />
                <Bar dataKey="count" fill="#004ac6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 border border-border rounded-md text-sm bg-surface text-foreground"
        >
          <option value="">All Statuses</option>
          <option value="PASSED">Passed</option>
          <option value="FAILED">Failed</option>
          <option value="ERROR">Error</option>
          <option value="SKIPPED">Skipped</option>
        </select>
        <select
          value={browserFilter}
          onChange={(e) => setBrowserFilter(e.target.value)}
          className="px-3 py-1.5 border border-border rounded-md text-sm bg-surface text-foreground"
        >
          <option value="">All Browsers</option>
          {browsers.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </div>

      {/* Results table */}
      <div className="bg-surface rounded-lg border border-border-light overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-on-surface-variant text-sm">Loading...</div>
        ) : !data || data.results.length === 0 ? (
          <div className="p-8 text-center text-on-surface-variant text-sm">No functional results available.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-xs text-on-surface-variant uppercase tracking-wider bg-surface-dim">
                <th className="px-4 py-3 text-left font-medium w-8" />
                <th className="px-4 py-3 text-left font-medium">Test Name</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Duration</th>
                <th className="px-4 py-3 text-left font-medium">Browser</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.map((result) => (
                <Fragment key={result.id}>
                  <tr
                    onClick={() => toggleExpanded(result.id)}
                    className="border-t border-border-light hover:bg-surface-dim transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <svg className={`w-3 h-3 text-on-surface-variant transition-transform ${expanded.has(result.id) ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{result.name}</td>
                    <td className="px-4 py-3"><StatusBadge status={result.status as "PASSED" | "FAILED" | "ERROR" | "SKIPPED"} /></td>
                    <td className="px-4 py-3 text-sm text-on-surface-variant">{result.durationMs != null ? `${result.durationMs}ms` : "—"}</td>
                    <td className="px-4 py-3 text-sm text-on-surface-variant">{result.browser ?? "—"}</td>
                  </tr>
                  {expanded.has(result.id) && result.errorMessage && (
                    <tr className="border-t border-border-light bg-surface-dim">
                      <td colSpan={5} className="px-4 py-3">
                        <p className="text-xs font-medium text-on-surface-variant mb-1">Error Message:</p>
                        <pre className="text-xs text-error font-mono whitespace-pre-wrap bg-error-container rounded p-2">
                          {result.errorMessage}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function buildDurationBuckets(results: FunctionalResult[]) {
  const durations = results.map((r) => r.durationMs).filter((d): d is number => d != null);
  if (durations.length === 0) return [];

  const max = Math.max(...durations);
  const bucketCount = Math.min(8, Math.max(3, Math.ceil(durations.length / 3)));
  const bucketSize = Math.ceil(max / bucketCount) || 1;

  const buckets: Array<{ label: string; count: number }> = [];
  for (let i = 0; i < bucketCount; i++) {
    const lo = i * bucketSize;
    const hi = (i + 1) * bucketSize;
    const isLast = i === bucketCount - 1;
    const count = durations.filter((d) => (isLast ? d >= lo && d <= hi : d >= lo && d < hi)).length;
    buckets.push({ label: `${lo}-${hi}ms`, count });
  }
  return buckets;
}
