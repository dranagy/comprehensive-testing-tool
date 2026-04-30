"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/ui/StatusBadge";
import { review } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import type { TestCase, TestPhase, ApprovalStatus } from "@/lib/types";

const PHASE_TABS: Array<{ label: string; value: TestPhase | "ALL" }> = [
  { label: "All", value: "ALL" },
  { label: "Functional", value: "FUNCTIONAL" },
  { label: "Performance", value: "PERFORMANCE" },
  { label: "Security", value: "SECURITY" },
];

const STATUS_OPTIONS: ApprovalStatus[] = ["GENERATED", "MODIFIED", "APPROVED", "REJECTED", "SKIPPED"];

export default function TestCasesPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [phaseFilter, setPhaseFilter] = useState<TestPhase | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { showToast } = useToast();

  const fetchTests = useCallback(() => {
    setLoading(true);
    review.listTestCases(sessionId, {
      phase: phaseFilter !== "ALL" ? phaseFilter : undefined,
      status: statusFilter || undefined,
    })
      .then(setTestCases)
      .catch((err) => showToast(err instanceof Error ? err.message : "Failed to load test cases", "error"))
      .finally(() => setLoading(false));
  }, [sessionId, phaseFilter, statusFilter]);

  useEffect(() => { fetchTests(); }, [fetchTests]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === testCases.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(testCases.map((t) => t.id)));
    }
  }

  async function handleBulkApprove() {
    try {
      await review.approve(sessionId, { testIds: Array.from(selected) });
      setSelected(new Set());
      fetchTests();
    } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-2xl text-foreground">Test Cases</h1>
        <Button variant="secondary" onClick={() => router.push(`/sessions/${sessionId}`)}>
          Back to Session
        </Button>
      </div>

      {/* Phase tabs */}
      <div className="flex gap-1 border-b border-border-light">
        {PHASE_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setPhaseFilter(tab.value); setSelected(new Set()); }}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              phaseFilter === tab.value
                ? "text-primary border-b-2 border-primary"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex items-center justify-between">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setSelected(new Set()); }}
          className="px-3 py-1.5 border border-border rounded-md text-sm bg-surface text-foreground"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {selected.size > 0 && (
          <Button size="sm" onClick={handleBulkApprove}>
            Approve Selected ({selected.size})
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-surface rounded-lg border border-border-light overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-on-surface-variant text-sm">Loading...</div>
        ) : testCases.length === 0 ? (
          <div className="p-8 text-center text-on-surface-variant text-sm">No test cases found.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-xs text-on-surface-variant uppercase tracking-wider bg-surface-dim">
                <th className="px-4 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={selected.size === testCases.length && testCases.length > 0}
                    onChange={toggleAll}
                    className="rounded border-border"
                  />
                </th>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Phase</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Tags</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {testCases.map((tc) => (
                <tr
                  key={tc.id}
                  onClick={() => router.push(`/sessions/${sessionId}/test-cases/${tc.id}`)}
                  className="border-t border-border-light hover:bg-surface-dim transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(tc.id)}
                      onChange={() => toggleSelect(tc.id)}
                      className="rounded border-border"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{tc.name}</td>
                  <td className="px-4 py-3"><StatusBadge status={tc.phase} /></td>
                  <td className="px-4 py-3"><StatusBadge status={tc.approvalStatus} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {tc.tags.map((tag) => (
                        <span key={tag} className="text-xs bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-full">{tag}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant">{new Date(tc.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
