"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/ui/StatusBadge";
import { review } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import type { ApprovalGate, TestPhase } from "@/lib/types";

const PHASE_COLORS: Record<TestPhase, string> = {
  FUNCTIONAL: "border-l-cyan-500",
  PERFORMANCE: "border-l-amber-500",
  SECURITY: "border-l-red-500",
};

export default function ApprovalPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const [gates, setGates] = useState<ApprovalGate[]>([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    review.getGates(sessionId)
      .then(setGates)
      .catch((err) => showToast(err instanceof Error ? err.message : "Failed to load gates", "error"))
      .finally(() => setLoading(false));
  }, [sessionId]);

  async function handleResolve(phase: string, action: "approve" | "reject" | "skip") {
    setActing(phase);
    try {
      const updated = await review.resolveGate(sessionId, phase, action, comments[phase] || undefined);
      setGates((prev) => prev.map((g) => (g.phase === phase ? updated : g)));
    } catch {}
    setActing(null);
  }

  if (loading) {
    return <div className="p-8 text-center text-on-surface-variant text-sm">Loading...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-2xl text-foreground">Approval Gates</h1>
        <Button variant="secondary" onClick={() => router.push(`/sessions/${sessionId}`)}>
          Back to Session
        </Button>
      </div>

      {gates.length === 0 ? (
        <div className="bg-surface rounded-lg border border-border-light p-8 text-center text-on-surface-variant text-sm">
          No approval gates found.
        </div>
      ) : (
        <div className="space-y-4">
          {gates.map((gate) => {
            const isPending = gate.status === "PENDING";
            return (
              <div
                key={gate.id}
                className={`bg-surface rounded-lg border border-border-light border-l-4 ${PHASE_COLORS[gate.phase]} p-4`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="font-display font-semibold text-foreground">{gate.phase}</h3>
                    <StatusBadge status={gate.status} size="md" />
                  </div>
                  {gate.resolvedBy && (
                    <span className="text-xs text-on-surface-variant">
                      by {gate.resolvedBy} {gate.resolvedAt ? `at ${new Date(gate.resolvedAt).toLocaleString()}` : ""}
                    </span>
                  )}
                </div>

                {gate.comments && (
                  <p className="text-sm text-on-surface-variant mb-3 italic">&ldquo;{gate.comments}&rdquo;</p>
                )}

                {isPending && (
                  <div className="space-y-3 pt-2 border-t border-border-light">
                    <textarea
                      placeholder="Optional comment..."
                      value={comments[gate.phase] ?? ""}
                      onChange={(e) => setComments((prev) => ({ ...prev, [gate.phase]: e.target.value }))}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface text-foreground resize-none h-16 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleResolve(gate.phase, "approve")} disabled={acting === gate.phase}>
                        Approve
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => handleResolve(gate.phase, "reject")} disabled={acting === gate.phase}>
                        Reject
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleResolve(gate.phase, "skip")} disabled={acting === gate.phase}>
                        Skip
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
