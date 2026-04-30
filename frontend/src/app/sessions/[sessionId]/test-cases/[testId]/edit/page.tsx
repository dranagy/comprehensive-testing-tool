"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { review } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import type { TestCase, TestStep, TestAssertion, TestCaseDefinition } from "@/lib/types";

const ACTION_OPTIONS: TestStep["action"][] = ["click", "type", "navigate", "wait", "select", "submit"];
const ASSERTION_TYPES: TestAssertion["type"][] = ["visible", "text", "url", "status", "attribute"];

function emptyStep(): TestStep {
  return { action: "click", selector: "", description: "" };
}

function emptyAssertion(): TestAssertion {
  return { type: "visible", expected: "" };
}

export default function EditTestCasePage({ params }: { params: Promise<{ sessionId: string; testId: string }> }) {
  const { sessionId, testId } = use(params);
  const router = useRouter();
  const [original, setOriginal] = useState<TestCase | null>(null);
  const [steps, setSteps] = useState<TestStep[]>([]);
  const [assertions, setAssertions] = useState<TestAssertion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    review.getTestCase(sessionId, testId)
      .then((tc) => {
        setOriginal(tc);
        setSteps(tc.definition.steps.length > 0 ? tc.definition.steps : [emptyStep()]);
        setAssertions(tc.definition.assertions.length > 0 ? tc.definition.assertions : [emptyAssertion()]);
      })
      .catch((err) => showToast(err instanceof Error ? err.message : "Failed to load test case", "error"))
      .finally(() => setLoading(false));
  }, [sessionId, testId]);

  function updateStep(index: number, field: keyof TestStep, value: string) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }

  function addStep() {
    setSteps((prev) => [...prev, emptyStep()]);
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  function moveStep(index: number, direction: -1 | 1) {
    setSteps((prev) => {
      const arr = [...prev];
      const target = index + direction;
      if (target < 0 || target >= arr.length) return arr;
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return arr;
    });
  }

  function updateAssertion(index: number, field: keyof TestAssertion, value: string) {
    setAssertions((prev) => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  }

  function addAssertion() {
    setAssertions((prev) => [...prev, emptyAssertion()]);
  }

  function removeAssertion(index: number) {
    setAssertions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    const definition: TestCaseDefinition = { steps, assertions };
    try {
      await review.updateTestCase(sessionId, testId, definition);
      router.push(`/sessions/${sessionId}/test-cases/${testId}`);
    } catch {}
    setSaving(false);
  }

  if (loading) {
    return <div className="p-8 text-center text-on-surface-variant text-sm">Loading...</div>;
  }
  if (!original) {
    return <div className="p-8 text-center text-on-surface-variant text-sm">Test case not found.</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-xl text-foreground">Edit: {original.name}</h1>
        <Button variant="ghost" onClick={() => router.push(`/sessions/${sessionId}/test-cases/${testId}`)}>
          Cancel
        </Button>
      </div>

      {/* Steps */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold text-sm text-foreground">Steps</h2>
          <Button size="sm" variant="secondary" onClick={addStep}>+ Add Step</Button>
        </div>
        <div className="space-y-3">
          {steps.map((step, i) => (
            <div key={i} className="bg-surface rounded-lg border border-border-light p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-on-surface-variant w-6">{i + 1}.</span>
                <select
                  value={step.action}
                  onChange={(e) => updateStep(i, "action", e.target.value)}
                  className="px-2 py-1 border border-border rounded text-sm bg-surface text-foreground"
                >
                  {ACTION_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
                <input
                  type="text"
                  placeholder="Selector"
                  value={step.selector}
                  onChange={(e) => updateStep(i, "selector", e.target.value)}
                  className="flex-1 px-2 py-1 border border-border rounded text-sm bg-surface text-foreground font-mono"
                />
                <button onClick={() => moveStep(i, -1)} disabled={i === 0} className="p-1 text-on-surface-variant hover:text-foreground disabled:opacity-30">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                </button>
                <button onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1} className="p-1 text-on-surface-variant hover:text-foreground disabled:opacity-30">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </button>
                <button onClick={() => removeStep(i)} className="p-1 text-error hover:text-red-700">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="flex gap-2 pl-7">
                <input
                  type="text"
                  placeholder="Value (optional)"
                  value={step.value ?? ""}
                  onChange={(e) => updateStep(i, "value", e.target.value)}
                  className="flex-1 px-2 py-1 border border-border rounded text-sm bg-surface text-foreground"
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={step.description}
                  onChange={(e) => updateStep(i, "description", e.target.value)}
                  className="flex-1 px-2 py-1 border border-border rounded text-sm bg-surface text-foreground"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Assertions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold text-sm text-foreground">Assertions</h2>
          <Button size="sm" variant="secondary" onClick={addAssertion}>+ Add Assertion</Button>
        </div>
        <div className="space-y-2">
          {assertions.map((assertion, i) => (
            <div key={i} className="flex items-center gap-2 bg-surface rounded-lg border border-border-light p-3">
              <select
                value={assertion.type}
                onChange={(e) => updateAssertion(i, "type", e.target.value)}
                className="px-2 py-1 border border-border rounded text-sm bg-surface text-foreground"
              >
                {ASSERTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input
                type="text"
                placeholder="Expected value"
                value={assertion.expected}
                onChange={(e) => updateAssertion(i, "expected", e.target.value)}
                className="flex-1 px-2 py-1 border border-border rounded text-sm bg-surface text-foreground font-mono"
              />
              <input
                type="text"
                placeholder="Selector (optional)"
                value={assertion.selector ?? ""}
                onChange={(e) => updateAssertion(i, "selector", e.target.value)}
                className="w-40 px-2 py-1 border border-border rounded text-sm bg-surface text-foreground font-mono"
              />
              <button onClick={() => removeAssertion(i)} className="p-1 text-error hover:text-red-700">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 pt-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
        <Button variant="secondary" onClick={() => router.push(`/sessions/${sessionId}/test-cases/${testId}`)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
