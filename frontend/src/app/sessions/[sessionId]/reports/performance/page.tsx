"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import StatCard from "@/components/ui/StatCard";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/ui/StatusBadge";
import { reports } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";

interface PerfMetric {
  testCaseId: string;
  status: string;
  durationMs: number;
  responseTimeP50?: number | null;
  responseTimeP90?: number | null;
  responseTimeP95?: number | null;
  responseTimeP99?: number | null;
  throughputRps?: number | null;
  errorRate?: number | null;
  concurrentUsers?: number | null;
  slaStatus?: string;
}

interface PerfData {
  totalResults: number;
  metrics: PerfMetric[];
}

export default function PerformanceReportPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const [data, setData] = useState<PerfData | null>(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    reports.performance(sessionId)
      .then((d) => setData(d as PerfData))
      .catch((err) => showToast(err instanceof Error ? err.message : "Failed to load report", "error"))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return <div className="p-8 text-center text-on-surface-variant text-sm">Loading...</div>;
  }
  if (!data || data.metrics.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display font-bold text-2xl text-foreground">Performance Report</h1>
          <Button variant="secondary" onClick={() => router.push(`/sessions/${sessionId}/reports/summary`)}>Back to Summary</Button>
        </div>
        <div className="p-8 text-center text-on-surface-variant text-sm">No performance data available.</div>
      </div>
    );
  }

  const hasResponseTimes = data.metrics.some((m) => m.responseTimeP50 != null);
  const hasThroughput = data.metrics.some((m) => m.throughputRps != null);
  const hasErrorRate = data.metrics.some((m) => m.errorRate != null);

  // Response time percentile chart data
  const percentileData = data.metrics
    .filter((m) => m.responseTimeP50 != null)
    .map((m, i) => ({
      name: `Test ${i + 1}`,
      p50: m.responseTimeP50,
      p90: m.responseTimeP90,
      p95: m.responseTimeP95,
      p99: m.responseTimeP99,
    }));

  // Throughput area chart data
  const throughputData = data.metrics
    .filter((m) => m.throughputRps != null)
    .map((m, i) => ({
      name: `Test ${i + 1}`,
      throughput: m.throughputRps,
    }));

  // Error rate chart data
  const errorData = data.metrics
    .filter((m) => m.errorRate != null)
    .map((m, i) => ({
      name: `Test ${i + 1}`,
      errorRate: m.errorRate != null ? +(m.errorRate * 100).toFixed(2) : 0,
    }));

  // SLA status counts
  const slaPassed = data.metrics.filter((m) => m.slaStatus === "PASS").length;
  const slaFailed = data.metrics.filter((m) => m.slaStatus === "FAIL").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-2xl text-foreground">Performance Report</h1>
        <Button variant="secondary" onClick={() => router.push(`/sessions/${sessionId}/reports/summary`)}>
          Back to Summary
        </Button>
      </div>

      {/* SLA status cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="SLA Pass"
          value={slaPassed}
          icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          trend={slaFailed === 0 ? { value: "All clear", positive: true } : { value: `${slaFailed} breach(es)`, positive: false }}
        />
        <StatCard
          label="Avg Duration"
          value={`${Math.round(data.metrics.reduce((s, m) => s + m.durationMs, 0) / data.metrics.length)}ms`}
          icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
        <StatCard
          label="Total Results"
          value={data.totalResults}
          icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </div>

      {/* Response Time Percentiles Chart */}
      {hasResponseTimes && (
        <div className="bg-surface rounded-lg border border-border-light p-4">
          <h2 className="font-display font-semibold text-sm text-foreground mb-3">Response Time Percentiles</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={percentileData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e1e2ed" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} unit="ms" />
              <Tooltip formatter={(value) => [`${value}ms`]} />
              <Legend />
              <Line type="monotone" dataKey="p50" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} name="p50" />
              <Line type="monotone" dataKey="p90" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="p90" />
              <Line type="monotone" dataKey="p95" stroke="#004ac6" strokeWidth={2} dot={{ r: 3 }} name="p95" />
              <Line type="monotone" dataKey="p99" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} name="p99" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Throughput Area Chart */}
        {hasThroughput && (
          <div className="bg-surface rounded-lg border border-border-light p-4">
            <h2 className="font-display font-semibold text-sm text-foreground mb-3">Throughput (req/s)</h2>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={throughputData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e1e2ed" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="throughput" stroke="#16a34a" fill="#dcfce7" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Error Rate Chart */}
        {hasErrorRate && (
          <div className="bg-surface rounded-lg border border-border-light p-4">
            <h2 className="font-display font-semibold text-sm text-foreground mb-3">Error Rate (%)</h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={errorData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e1e2ed" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} unit="%" />
                <Tooltip formatter={(value) => [`${value}%`]} />
                <Line type="monotone" dataKey="errorRate" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Metrics table */}
      <div className="bg-surface rounded-lg border border-border-light">
        <div className="px-4 py-3 border-b border-border-light">
          <h2 className="font-display font-semibold text-sm text-foreground">All Metrics ({data.totalResults} results)</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-xs text-on-surface-variant uppercase tracking-wider bg-surface-dim">
              <th className="px-4 py-3 text-left font-medium">Test</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Duration</th>
              <th className="px-4 py-3 text-left font-medium">SLA</th>
            </tr>
          </thead>
          <tbody>
            {data.metrics.map((metric, i) => (
              <tr key={i} className="border-t border-border-light">
                <td className="px-4 py-3 text-sm font-medium text-foreground">Test {i + 1}</td>
                <td className="px-4 py-3"><StatusBadge status={metric.status as "PASSED" | "FAILED"} /></td>
                <td className="px-4 py-3 text-sm text-on-surface-variant font-mono">{metric.durationMs}ms</td>
                <td className="px-4 py-3">
                  {metric.slaStatus ? (
                    <span className={`text-xs font-bold ${metric.slaStatus === "PASS" ? "text-success" : "text-error"}`}>
                      {metric.slaStatus}
                    </span>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
