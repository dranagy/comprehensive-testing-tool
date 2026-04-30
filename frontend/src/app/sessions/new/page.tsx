"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { sessions as sessionsApi } from "@/lib/api-client";
import type { BrowserType, PerformanceConfig, SecurityConfig, SlaConfig } from "@/lib/types";

const BROWSERS: BrowserType[] = ["chromium", "firefox", "webkit"];
const SEVERITY_OPTIONS: SecurityConfig["severityThreshold"][] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFORMATIONAL"];

export default function NewSessionPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [browsers, setBrowsers] = useState<BrowserType[]>(["chromium"]);
  const [perfOpen, setPerfOpen] = useState(false);
  const [secOpen, setSecOpen] = useState(false);
  const [perf, setPerf] = useState<PerformanceConfig>({
    virtualUsers: 10,
    rampUpSeconds: 30,
    durationSeconds: 60,
    sla: { responseTimeP95Ms: 2000, errorRateMax: 0.05, throughputMinRps: 10 },
  });
  const [sec, setSec] = useState<SecurityConfig>({
    zapPath: "",
    passiveScan: true,
    activeScan: false,
    severityThreshold: "MEDIUM",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleBrowser(b: BrowserType) {
    setBrowsers((prev) =>
      prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetUrl.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const session = await sessionsApi.create({
        name: name.trim() || undefined,
        targetUrl: targetUrl.trim(),
        config: {
          browsers,
          performance: perfOpen ? perf : undefined,
          security: secOpen ? sec : undefined,
        },
      });
      router.push(`/sessions/${session.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="font-display font-bold text-2xl text-foreground mb-6">New Session</h1>

      {error && (
        <div className="mb-4 p-3 bg-error-container text-error rounded-md text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-on-surface mb-1">Target URL *</label>
          <input
            type="url"
            required
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full px-3 py-2 border border-border rounded-md bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-on-surface mb-1">Session Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My test session"
            className="w-full px-3 py-2 border border-border rounded-md bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-on-surface mb-2">Browsers</label>
          <div className="flex gap-4">
            {BROWSERS.map((b) => (
              <label key={b} className="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer">
                <input
                  type="checkbox"
                  checked={browsers.includes(b)}
                  onChange={() => toggleBrowser(b)}
                  className="rounded border-border text-primary focus:ring-primary/30"
                />
                {b}
              </label>
            ))}
          </div>
        </div>

        {/* Performance config */}
        <div className="border border-border-light rounded-lg">
          <button
            type="button"
            onClick={() => setPerfOpen(!perfOpen)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-on-surface hover:bg-surface-dim transition-colors"
          >
            Performance Configuration
            <svg className={`w-4 h-4 transition-transform ${perfOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {perfOpen && (
            <div className="px-4 pb-4 space-y-3 border-t border-border-light pt-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1">Virtual Users</label>
                  <input type="number" min={1} value={perf.virtualUsers} onChange={(e) => setPerf({ ...perf, virtualUsers: Number(e.target.value) })} className="w-full px-2 py-1.5 border border-border rounded text-sm bg-surface text-foreground" />
                </div>
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1">Ramp Up (s)</label>
                  <input type="number" min={0} value={perf.rampUpSeconds} onChange={(e) => setPerf({ ...perf, rampUpSeconds: Number(e.target.value) })} className="w-full px-2 py-1.5 border border-border rounded text-sm bg-surface text-foreground" />
                </div>
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1">Duration (s)</label>
                  <input type="number" min={1} value={perf.durationSeconds} onChange={(e) => setPerf({ ...perf, durationSeconds: Number(e.target.value) })} className="w-full px-2 py-1.5 border border-border rounded text-sm bg-surface text-foreground" />
                </div>
              </div>
              <p className="text-xs font-medium text-on-surface-variant pt-1">SLA Thresholds</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1">P95 Resp. Time (ms)</label>
                  <input type="number" min={0} value={perf.sla?.responseTimeP95Ms ?? 2000} onChange={(e) => setPerf({ ...perf, sla: { ...perf.sla!, responseTimeP95Ms: Number(e.target.value) } })} className="w-full px-2 py-1.5 border border-border rounded text-sm bg-surface text-foreground" />
                </div>
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1">Max Error Rate</label>
                  <input type="number" min={0} max={1} step={0.01} value={perf.sla?.errorRateMax ?? 0.05} onChange={(e) => setPerf({ ...perf, sla: { ...perf.sla!, errorRateMax: Number(e.target.value) } })} className="w-full px-2 py-1.5 border border-border rounded text-sm bg-surface text-foreground" />
                </div>
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1">Min Throughput (rps)</label>
                  <input type="number" min={0} value={perf.sla?.throughputMinRps ?? 10} onChange={(e) => setPerf({ ...perf, sla: { ...perf.sla!, throughputMinRps: Number(e.target.value) } })} className="w-full px-2 py-1.5 border border-border rounded text-sm bg-surface text-foreground" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Security config */}
        <div className="border border-border-light rounded-lg">
          <button
            type="button"
            onClick={() => setSecOpen(!secOpen)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-on-surface hover:bg-surface-dim transition-colors"
          >
            Security Configuration
            <svg className={`w-4 h-4 transition-transform ${secOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {secOpen && (
            <div className="px-4 pb-4 space-y-3 border-t border-border-light pt-3">
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">ZAP Path</label>
                <input type="text" value={sec.zapPath} onChange={(e) => setSec({ ...sec, zapPath: e.target.value })} placeholder="/usr/share/zap" className="w-full px-2 py-1.5 border border-border rounded text-sm bg-surface text-foreground" />
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer">
                  <input type="checkbox" checked={sec.passiveScan} onChange={(e) => setSec({ ...sec, passiveScan: e.target.checked })} className="rounded border-border text-primary" />
                  Passive Scan
                </label>
                <label className="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer">
                  <input type="checkbox" checked={sec.activeScan} onChange={(e) => setSec({ ...sec, activeScan: e.target.checked })} className="rounded border-border text-primary" />
                  Active Scan
                </label>
              </div>
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Severity Threshold</label>
                <select value={sec.severityThreshold} onChange={(e) => setSec({ ...sec, severityThreshold: e.target.value as SecurityConfig["severityThreshold"] })} className="px-2 py-1.5 border border-border rounded text-sm bg-surface text-foreground">
                  {SEVERITY_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={submitting || !targetUrl.trim()}>
            {submitting ? "Creating..." : "Create Session"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
