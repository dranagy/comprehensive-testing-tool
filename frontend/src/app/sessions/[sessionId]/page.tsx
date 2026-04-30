"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PhaseProgressBar from "@/components/ui/PhaseProgressBar";
import StatCard from "@/components/ui/StatCard";
import StatusBadge from "@/components/ui/StatusBadge";
import Button from "@/components/ui/Button";
import { sessions as sessionsApi } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import type { Session, Phase } from "@/lib/types";

const PHASE_ACTIONS: Record<string, { label: string; href: string }> = {
  INGESTION: { label: "Upload Documents", href: "/ingest" },
  GENERATION: { label: "Generate Tests", href: "/test-cases" },
  FUNCTIONAL: { label: "Review Tests", href: "/test-cases" },
  PERFORMANCE: { label: "Review Tests", href: "/test-cases" },
  SECURITY: { label: "Review Tests", href: "/test-cases" },
  COMPLETE: { label: "View Reports", href: "/reports/summary" },
};

export default function SessionDetailPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    sessionsApi.get(sessionId)
      .then(setSession)
      .catch((err) => showToast(err instanceof Error ? err.message : "Failed to load session", "error"))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return <div className="p-8 text-center text-on-surface-variant text-sm">Loading session...</div>;
  }
  if (!session) {
    return <div className="p-8 text-center text-on-surface-variant text-sm">Session not found.</div>;
  }

  const counts = session.testCounts ?? { functional: 0, performance: 0, security: 0 };
  const summary = session.executionSummary;
  const pendingGates = session.pendingGates ?? [];
  const action = PHASE_ACTIONS[session.status] ?? PHASE_ACTIONS.COMPLETE;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground">{session.name}</h1>
          <p className="text-sm text-on-surface-variant mt-1">{session.targetUrl}</p>
        </div>
        <StatusBadge status={session.status} size="md" />
      </div>

      <PhaseProgressBar currentPhase={session.status} />

      {/* Test count cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface rounded-lg border border-border-light p-4">
          <p className="text-xs font-medium text-on-surface-variant uppercase">Functional Tests</p>
          <p className="text-2xl font-display font-bold text-foreground mt-1">{counts.functional}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border-light p-4">
          <p className="text-xs font-medium text-on-surface-variant uppercase">Performance Tests</p>
          <p className="text-2xl font-display font-bold text-foreground mt-1">{counts.performance}</p>
        </div>
        <div className="bg-surface rounded-lg border border-border-light p-4">
          <p className="text-xs font-medium text-on-surface-variant uppercase">Security Tests</p>
          <p className="text-2xl font-display font-bold text-foreground mt-1">{counts.security}</p>
        </div>
      </div>

      {/* Pending approval gates */}
      {pendingGates.length > 0 && (
        <div className="bg-surface rounded-lg border border-border-light">
          <div className="px-4 py-3 border-b border-border-light">
            <h2 className="font-display font-semibold text-sm text-foreground">Pending Approval Gates</h2>
          </div>
          <div className="divide-y divide-border-light">
            {pendingGates.map((gate) => (
              <div key={gate.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <StatusBadge status={gate.status} />
                  <span className="text-sm text-on-surface">{gate.phase}</span>
                </div>
                <Link href={`/sessions/${sessionId}/approval`}>
                  <Button size="sm" variant="secondary">Review</Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Execution summary */}
      {summary && (
        <div>
          <h2 className="font-display font-semibold text-sm text-foreground mb-3">Execution Summary</h2>
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Passed" value={summary.passed} icon="M5 13l4 4L19 7" />
            <StatCard label="Failed" value={summary.failed} icon="M6 18L18 6M6 6l12 12" />
            <StatCard label="Errors" value={summary.errored} icon="M12 9v2m0 4h.01" />
            <StatCard label="Skipped" value={summary.skipped} icon="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </div>
        </div>
      )}

      {/* Quick action */}
      <div className="flex gap-3">
        <Link href={`/sessions/${sessionId}${action.href}`}>
          <Button size="lg">{action.label}</Button>
        </Link>
        {session.status !== "COMPLETE" && (
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                const updated = await sessionsApi.advance(sessionId);
                setSession(updated);
              } catch {}
            }}
          >
            Advance Phase
          </Button>
        )}
      </div>
    </div>
  );
}
