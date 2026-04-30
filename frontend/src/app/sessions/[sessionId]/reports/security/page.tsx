"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import StatCard from "@/components/ui/StatCard";
import SeverityBadge from "@/components/ui/SeverityBadge";
import Button from "@/components/ui/Button";
import { reports } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import type { SecurityFinding, Severity } from "@/lib/types";

interface SecurityData {
  totalFindings: number;
  bySeverity: Record<Severity, number>;
  findings: SecurityFinding[];
}

const SEVERITY_ORDER: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFORMATIONAL"];
const SEVERITY_COLORS: Record<Severity, string> = {
  CRITICAL: "#dc2626",
  HIGH: "#ea580c",
  MEDIUM: "#d97706",
  LOW: "#2563eb",
  INFORMATIONAL: "#6b7280",
};

export default function SecurityReportPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const [data, setData] = useState<SecurityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState("");
  const { showToast } = useToast();

  useEffect(() => {
    setLoading(true);
    reports.security(sessionId, severityFilter || undefined)
      .then((d) => setData(d as SecurityData))
      .catch((err) => showToast(err instanceof Error ? err.message : "Failed to load report", "error"))
      .finally(() => setLoading(false));
  }, [sessionId, severityFilter]);

  // Build pie chart data
  const pieData = data
    ? SEVERITY_ORDER
        .filter((s) => (data.bySeverity[s] ?? 0) > 0)
        .map((s) => ({ name: s, value: data.bySeverity[s] ?? 0, color: SEVERITY_COLORS[s] }))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-2xl text-foreground">Security Findings</h1>
        <Button variant="secondary" onClick={() => router.push(`/sessions/${sessionId}/reports/summary`)}>
          Back to Summary
        </Button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-on-surface-variant text-sm">Loading...</div>
      ) : !data ? (
        <div className="p-8 text-center text-on-surface-variant text-sm">No security data available.</div>
      ) : (
        <>
          {/* Severity distribution + donut chart */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surface rounded-lg border border-border-light p-4">
              <h2 className="font-display font-semibold text-sm text-foreground mb-3">Severity Distribution</h2>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [value, name]} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-success-container flex items-center justify-center mx-auto mb-2">
                      <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-sm text-success font-medium">No findings</p>
                  </div>
                </div>
              )}
              {pieData.length > 0 && (
                <div className="flex flex-wrap justify-center gap-3 mt-2">
                  {pieData.map((d) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-xs text-on-surface-variant">{d.name} ({d.value})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3">
              {SEVERITY_ORDER.map((sev) => (
                <StatCard
                  key={sev}
                  label={sev}
                  value={data.bySeverity[sev] ?? 0}
                />
              ))}
            </div>
          </div>

          {/* Filter */}
          <div>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-3 py-1.5 border border-border rounded-md text-sm bg-surface text-foreground"
            >
              <option value="">All Severities</option>
              {SEVERITY_ORDER.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Findings table */}
          <div className="bg-surface rounded-lg border border-border-light overflow-hidden">
            <div className="px-4 py-3 border-b border-border-light">
              <h2 className="font-display font-semibold text-sm text-foreground">Findings ({data.totalFindings})</h2>
            </div>
            {data.findings.length === 0 ? (
              <div className="p-8 text-center text-on-surface-variant text-sm">No findings match the filter.</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-on-surface-variant uppercase tracking-wider bg-surface-dim">
                    <th className="px-4 py-3 text-left font-medium">Severity</th>
                    <th className="px-4 py-3 text-left font-medium">Title</th>
                    <th className="px-4 py-3 text-left font-medium">URL</th>
                    <th className="px-4 py-3 text-left font-medium">Scan Type</th>
                    <th className="px-4 py-3 text-left font-medium">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {data.findings.map((finding) => (
                    <tr key={finding.id} className="border-t border-border-light hover:bg-surface-dim transition-colors">
                      <td className="px-4 py-3"><SeverityBadge severity={finding.severity} /></td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{finding.title}</td>
                      <td className="px-4 py-3 text-sm text-on-surface-variant font-mono truncate max-w-[200px]">{finding.url}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${finding.scanType === "ACTIVE" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
                          {finding.scanType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-on-surface-variant">{finding.category}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
