"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/ui/StatusBadge";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { review } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import type { TestCase } from "@/lib/types";

const ACTION_ICONS: Record<string, string> = {
  click: "M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5",
  type: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
  navigate: "M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3",
  wait: "M12 6v6l4 2",
  select: "M8 9l4-4 4 4m0 6l-4 4-4-4",
  submit: "M12 19l9 2-9-18-9 18 9-2zm0 0v-8",
};

export default function TestCaseDetailPage({ params }: { params: Promise<{ sessionId: string; testId: string }> }) {
  const { sessionId, testId } = use(params);
  const router = useRouter();
  const [testCase, setTestCase] = useState<TestCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    review.getTestCase(sessionId, testId)
      .then(setTestCase)
      .catch((err) => showToast(err instanceof Error ? err.message : "Failed to load test case", "error"))
      .finally(() => setLoading(false));
  }, [sessionId, testId]);

  if (loading) {
    return <div className="p-8 text-center text-on-surface-variant text-sm">Loading...</div>;
  }
  if (!testCase) {
    return <div className="p-8 text-center text-on-surface-variant text-sm">Test case not found.</div>;
  }

  const { definition } = testCase;

  async function handleApprove() {
    try {
      await review.approve(sessionId, { testIds: [testId] });
      if (testCase) setTestCase({ ...testCase, approvalStatus: "APPROVED" });
    } catch {}
    setConfirmAction(null);
  }

  async function handleReject() {
    try {
      await review.reject(sessionId, testId);
      if (testCase) setTestCase({ ...testCase, approvalStatus: "REJECTED" });
    } catch {}
    setConfirmAction(null);
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-xl text-foreground">{testCase.name}</h1>
          {testCase.description && (
            <p className="text-sm text-on-surface-variant mt-1">{testCase.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={testCase.phase} size="md" />
          <StatusBadge status={testCase.approvalStatus} size="md" />
        </div>
      </div>

      {/* Metadata */}
      <div className="bg-surface rounded-lg border border-border-light p-4">
        <div className="flex flex-wrap gap-2 mb-3">
          {testCase.tags.map((tag) => (
            <span key={tag} className="text-xs bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-full">{tag}</span>
          ))}
        </div>
        <div className="text-xs text-on-surface-variant">
          Created {new Date(testCase.createdAt).toLocaleString()} | Updated {new Date(testCase.updatedAt).toLocaleString()}
        </div>
      </div>

      {/* Steps */}
      <div>
        <h2 className="font-display font-semibold text-sm text-foreground mb-3">Steps</h2>
        <div className="space-y-2">
          {definition.steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3 bg-surface rounded-lg border border-border-light p-3">
              <div className="w-7 h-7 rounded-full bg-primary-light flex items-center justify-center text-xs font-bold text-primary shrink-0 mt-0.5">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-on-surface-variant shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={ACTION_ICONS[step.action] ?? "M9 5l7 7-7 7"} />
                  </svg>
                  <span className="text-xs font-semibold text-on-surface-variant uppercase">{step.action}</span>
                  <span className="text-sm text-foreground font-mono bg-surface-dim px-1.5 py-0.5 rounded">{step.selector}</span>
                </div>
                {step.value && <p className="text-sm text-on-surface-variant mt-1">Value: <span className="font-mono">{step.value}</span></p>}
                <p className="text-sm text-on-surface-variant mt-1">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Assertions */}
      <div>
        <h2 className="font-display font-semibold text-sm text-foreground mb-3">Assertions</h2>
        <div className="space-y-2">
          {definition.assertions.map((assertion, i) => (
            <div key={i} className="flex items-center gap-3 bg-surface rounded-lg border border-border-light p-3">
              <span className="text-xs font-semibold text-on-surface-variant uppercase bg-secondary-container px-2 py-0.5 rounded-full">{assertion.type}</span>
              <span className="text-sm text-foreground font-mono">{assertion.expected}</span>
              {assertion.selector && (
                <span className="text-xs text-on-surface-variant font-mono bg-surface-dim px-1.5 py-0.5 rounded">{assertion.selector}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Edit history */}
      {testCase.editHistory.length > 0 && (
        <div>
          <h2 className="font-display font-semibold text-sm text-foreground mb-3">Edit History</h2>
          <div className="space-y-2">
            {testCase.editHistory.map((entry, i) => (
              <div key={i} className="text-xs text-on-surface-variant bg-surface-dim rounded p-2">
                <span className="font-medium text-on-surface">{entry.field}</span> changed at{" "}
                {new Date(entry.timestamp).toLocaleString()}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="flex gap-3 pt-2 border-t border-border-light">
        <Button variant="secondary" onClick={() => router.push(`/sessions/${sessionId}/test-cases/${testId}/edit`)}>
          Edit
        </Button>
        <Button onClick={() => setConfirmAction("approve")}>Approve</Button>
        <Button variant="danger" onClick={() => setConfirmAction("reject")}>Reject</Button>
      </div>

      <ConfirmDialog
        open={confirmAction === "approve"}
        title="Approve Test Case"
        message="Are you sure you want to approve this test case?"
        confirmLabel="Approve"
        onConfirm={handleApprove}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        open={confirmAction === "reject"}
        title="Reject Test Case"
        message="Are you sure you want to reject this test case?"
        confirmLabel="Reject"
        variant="danger"
        onConfirm={handleReject}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
