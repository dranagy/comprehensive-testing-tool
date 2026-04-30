"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { sessions as sessionsApi } from "@/lib/api-client";

const EXPORT_FORMATS = [
  { value: "json", label: "JSON" },
  { value: "html", label: "HTML" },
];

const EXPORT_CONTENT = [
  { key: "session", label: "Session metadata", default: true },
  { key: "testCases", label: "Test cases", default: true },
  { key: "results", label: "Execution results", default: true },
  { key: "security", label: "Security findings", default: true },
  { key: "audit", label: "Audit trail", default: false },
];

export default function ExportPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const [format, setFormat] = useState("json");
  const [contentChecks, setContentChecks] = useState<Record<string, boolean>>(
    Object.fromEntries(EXPORT_CONTENT.map((c) => [c.key, c.default]))
  );
  const [exporting, setExporting] = useState(false);
  const [exportData, setExportData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleContent(key: string) {
    setContentChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const result = await sessionsApi.export(sessionId);
      if (format === "json") {
        const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `session-${sessionId}-export.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        setExportData(result);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-2xl text-foreground">Export Session</h1>
        <Button variant="secondary" onClick={() => router.push(`/sessions/${sessionId}`)}>
          Back to Session
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-error-container text-error rounded-md text-sm">{error}</div>
      )}

      {/* Format selector */}
      <div className="bg-surface rounded-lg border border-border-light p-4">
        <h2 className="font-display font-semibold text-sm text-foreground mb-3">Export Format</h2>
        <div className="flex gap-3">
          {EXPORT_FORMATS.map((f) => (
            <label
              key={f.value}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                format === f.value
                  ? "border-primary bg-primary-light text-primary"
                  : "border-border text-on-surface-variant hover:bg-surface-dim"
              }`}
            >
              <input
                type="radio"
                name="format"
                value={f.value}
                checked={format === f.value}
                onChange={() => setFormat(f.value)}
                className="sr-only"
              />
              {f.label}
            </label>
          ))}
        </div>
      </div>

      {/* Export content checklist */}
      <div className="bg-surface rounded-lg border border-border-light p-4">
        <h2 className="font-display font-semibold text-sm text-foreground mb-3">Export Content</h2>
        <div className="space-y-2">
          {EXPORT_CONTENT.map((item) => (
            <label key={item.key} className="flex items-center gap-3 text-sm text-on-surface cursor-pointer">
              <input
                type="checkbox"
                checked={contentChecks[item.key] ?? false}
                onChange={() => toggleContent(item.key)}
                className="rounded border-border text-primary"
              />
              {item.label}
            </label>
          ))}
        </div>
      </div>

      <Button size="lg" onClick={handleExport} disabled={exporting}>
        {exporting ? "Exporting..." : "Download Export"}
      </Button>

      {/* HTML preview */}
      {format === "html" && exportData && (
        <div className="bg-surface rounded-lg border border-border-light p-4">
          <h2 className="font-display font-semibold text-sm text-foreground mb-2">Preview</h2>
          <pre className="text-xs text-on-surface-variant font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
            {JSON.stringify(exportData, null, 2).slice(0, 2000)}
          </pre>
        </div>
      )}
    </div>
  );
}
