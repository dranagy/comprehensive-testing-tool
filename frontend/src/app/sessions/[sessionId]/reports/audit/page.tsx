"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { reports } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import type { AuditEntry } from "@/lib/types";

interface AuditData {
  sessionId: string;
  totalEntries: number;
  entries: AuditEntry[];
}

const ACTION_STYLES: Record<string, string> = {
  create: "bg-success-container text-success",
  update: "bg-info-container text-info",
  delete: "bg-error-container text-error",
  approve: "bg-success-container text-success",
  reject: "bg-error-container text-error",
  run: "bg-info-container text-info",
  upload: "bg-purple-100 text-purple-700",
  generate: "bg-cyan-100 text-cyan-700",
};

export default function AuditPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const { showToast } = useToast();

  useEffect(() => {
    setLoading(true);
    reports.audit(sessionId, actionFilter || undefined)
      .then((d) => setData(d as AuditData))
      .catch((err) => showToast(err instanceof Error ? err.message : "Failed to load audit trail", "error"))
      .finally(() => setLoading(false));
  }, [sessionId, actionFilter]);

  const actions = [...new Set((data?.entries ?? []).map((e) => e.action.toLowerCase()))];

  function toggleExpanded(index: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-2xl text-foreground">Audit Trail</h1>
        <Button variant="secondary" onClick={() => router.push(`/sessions/${sessionId}/reports/summary`)}>
          Back to Summary
        </Button>
      </div>

      {/* Action filter */}
      <div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-1.5 border border-border rounded-md text-sm bg-surface text-foreground"
        >
          <option value="">All Actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="p-8 text-center text-on-surface-variant text-sm">Loading...</div>
      ) : !data || data.entries.length === 0 ? (
        <div className="p-8 text-center text-on-surface-variant text-sm">No audit entries found.</div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border-light" />

          <div className="space-y-1">
            {data.entries.map((entry, i) => {
              const styleKey = Object.keys(ACTION_STYLES).find((k) => entry.action.toLowerCase().includes(k)) ?? "update";
              return (
                <div key={i} className="relative pl-10">
                  {/* Dot */}
                  <div className={`absolute left-2.5 top-3 w-3 h-3 rounded-full border-2 border-surface ${ACTION_STYLES[styleKey]?.split(" ")[0] ?? "bg-surface-dim"}`} />

                  <div
                    className="bg-surface rounded-lg border border-border-light p-3 cursor-pointer hover:bg-surface-dim transition-colors"
                    onClick={() => toggleExpanded(i)}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ACTION_STYLES[styleKey] ?? "bg-gray-100 text-gray-600"}`}>
                        {entry.action}
                      </span>
                      <span className="text-sm text-foreground font-medium">{entry.actor}</span>
                      <span className="text-xs text-on-surface-variant ml-auto">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {expanded.has(i) && entry.details && Object.keys(entry.details).length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border-light">
                        <pre className="text-xs text-on-surface-variant font-mono whitespace-pre-wrap">
                          {JSON.stringify(entry.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
