"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import StatCard from "@/components/ui/StatCard";
import Button from "@/components/ui/Button";
import { reports } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import type { Severity } from "@/lib/types";

interface SummaryData {
  session: { id: string; name: string };
  testCases: { functional: number; performance: number; security: number; total: number };
  execution: { total: number; passed: number; failed: number; errored: number; skipped: number };
  passRate: string;
  security: { findings: number; bySeverity: Record<Severity, number> };
}

const PHASE_COLORS: Record<string, string> = {
  functional: "#06b6d4",
  performance: "#f59e0b",
  security: "#ef4444",
};

export default function SummaryReportPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    reports.summary(sessionId)
      .then((d) => setData(d as SummaryData))
      .catch((err) => showToast(err instanceof Error ? err.message : "Failed to load report", "error"))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return <div className="p-8 text-center text-on-surface-variant text-sm">Loading report...</div>;
  }
  if (!data) {
    return <div className="p-8 text-center text-on-surface-variant text-sm">No report data available.</div>;
  }

  const slaStatus = data.execution.failed === 0 && data.execution.errored === 0 ? "PASS" : "FAIL";

  // Build donut chart data
  const chartData = [
    { label: "Functional", value: data.testCases.functional, color: PHASE_COLORS.functional },
    { label: "Performance", value: data.testCases.performance, color: PHASE_COLORS.performance },
    { label: "Security", value: data.testCases.security, color: PHASE_COLORS.security },
  ];
  const total = chartData.reduce((s, d) => s + d.value, 0) || 1;
  let cumulative = 0;
  const segments = chartData.map((d) => {
    const start = cumulative;
    const fraction = d.value / total;
    cumulative += fraction;
    return { ...d, start, fraction };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-2xl text-foreground">Summary Report</h1>
        <Button variant="secondary" onClick={() => router.push(`/sessions/${sessionId}`)}>
          Back to Session
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Tests" value={data.execution.total} icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        <StatCard label="Pass Rate" value={data.passRate} icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        <StatCard label="Security Findings" value={data.security.findings} icon="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        <StatCard
          label="SLA Status"
          value={slaStatus}
          icon="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          trend={slaStatus === "PASS" ? { value: "All clear", positive: true } : { value: "Issues found", positive: false }}
        />
      </div>

      {/* Donut chart */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface rounded-lg border border-border-light p-4">
          <h2 className="font-display font-semibold text-sm text-foreground mb-4">Test Distribution by Phase</h2>
          <div className="flex items-center justify-center">
            <svg viewBox="0 0 120 120" className="w-40 h-40">
              <circle cx="60" cy="60" r="50" fill="none" stroke="var(--color-surface-dim)" strokeWidth="20" />
              {segments.map((seg) => {
                if (seg.value === 0) return null;
                const circumference = 2 * Math.PI * 50;
                const dash = seg.fraction * circumference;
                const gap = circumference - dash;
                return (
                  <circle
                    key={seg.label}
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="20"
                    strokeDasharray={`${dash} ${gap}`}
                    strokeDashoffset={-seg.start * circumference}
                    transform="rotate(-90 60 60)"
                  />
                );
              })}
            </svg>
          </div>
          <div className="flex justify-center gap-4 mt-3">
            {chartData.map((d) => (
              <div key={d.label} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-xs text-on-surface-variant">{d.label} ({d.value})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent execution timeline */}
        <div className="bg-surface rounded-lg border border-border-light p-4">
          <h2 className="font-display font-semibold text-sm text-foreground mb-4">Execution Breakdown</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-on-surface">Passed</span>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-surface-dim rounded-full h-2">
                  <div className="bg-success h-2 rounded-full" style={{ width: `${data.execution.total ? (data.execution.passed / data.execution.total) * 100 : 0}%` }} />
                </div>
                <span className="text-sm font-medium text-foreground w-8 text-right">{data.execution.passed}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-on-surface">Failed</span>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-surface-dim rounded-full h-2">
                  <div className="bg-error h-2 rounded-full" style={{ width: `${data.execution.total ? (data.execution.failed / data.execution.total) * 100 : 0}%` }} />
                </div>
                <span className="text-sm font-medium text-foreground w-8 text-right">{data.execution.failed}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-on-surface">Errors</span>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-surface-dim rounded-full h-2">
                  <div className="bg-warning h-2 rounded-full" style={{ width: `${data.execution.total ? (data.execution.errored / data.execution.total) * 100 : 0}%` }} />
                </div>
                <span className="text-sm font-medium text-foreground w-8 text-right">{data.execution.errored}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-on-surface">Skipped</span>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-surface-dim rounded-full h-2">
                  <div className="bg-border h-2 rounded-full" style={{ width: `${data.execution.total ? (data.execution.skipped / data.execution.total) * 100 : 0}%` }} />
                </div>
                <span className="text-sm font-medium text-foreground w-8 text-right">{data.execution.skipped}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Report links */}
      <div className="flex gap-3">
        <Link href={`/sessions/${sessionId}/reports/functional`}><Button variant="secondary">Functional Report</Button></Link>
        <Link href={`/sessions/${sessionId}/reports/performance`}><Button variant="secondary">Performance Report</Button></Link>
        <Link href={`/sessions/${sessionId}/reports/security`}><Button variant="secondary">Security Report</Button></Link>
        <Link href={`/sessions/${sessionId}/reports/audit`}><Button variant="secondary">Audit Trail</Button></Link>
      </div>
    </div>
  );
}
