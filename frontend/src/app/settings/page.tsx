"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { config as configApi } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import type { BrowserType } from "@/lib/types";

const BROWSERS: BrowserType[] = ["chromium", "firefox", "webkit"];

interface SettingsForm {
  targetUrl: string;
  browsers: BrowserType[];
  virtualUsers: number;
  rampUpSeconds: number;
  durationSeconds: number;
  zapPath: string;
  passiveScan: boolean;
  activeScan: boolean;
  format: string;
  screenshots: boolean;
  networkLogs: boolean;
}

const DEFAULTS: SettingsForm = {
  targetUrl: "",
  browsers: ["chromium"],
  virtualUsers: 10,
  rampUpSeconds: 30,
  durationSeconds: 60,
  zapPath: "",
  passiveScan: true,
  activeScan: false,
  format: "json",
  screenshots: true,
  networkLogs: false,
};

export default function SettingsPage() {
  const [form, setForm] = useState<SettingsForm>({ ...DEFAULTS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    configApi.get()
      .then((cfg) => {
        const data = cfg as Record<string, unknown>;
        setForm({
          targetUrl: (data.targetUrl as string) ?? DEFAULTS.targetUrl,
          browsers: (data.browsers as BrowserType[]) ?? DEFAULTS.browsers,
          virtualUsers: (data.virtualUsers as number) ?? DEFAULTS.virtualUsers,
          rampUpSeconds: (data.rampUpSeconds as number) ?? DEFAULTS.rampUpSeconds,
          durationSeconds: (data.durationSeconds as number) ?? DEFAULTS.durationSeconds,
          zapPath: (data.zapPath as string) ?? DEFAULTS.zapPath,
          passiveScan: (data.passiveScan as boolean) ?? DEFAULTS.passiveScan,
          activeScan: (data.activeScan as boolean) ?? DEFAULTS.activeScan,
          format: (data.format as string) ?? DEFAULTS.format,
          screenshots: (data.screenshots as boolean) ?? DEFAULTS.screenshots,
          networkLogs: (data.networkLogs as boolean) ?? DEFAULTS.networkLogs,
        });
      })
      .catch((err) => showToast(err instanceof Error ? err.message : "Failed to load settings", "error"))
      .finally(() => setLoading(false));
  }, []);

  function toggleBrowser(b: BrowserType) {
    setForm((prev) => ({
      ...prev,
      browsers: prev.browsers.includes(b) ? prev.browsers.filter((x) => x !== b) : [...prev.browsers, b],
    }));
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      await configApi.update(form as unknown as Record<string, unknown>);
      setMessage({ type: "success", text: "Settings saved successfully." });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    try {
      await configApi.reset("all");
      setForm({ ...DEFAULTS });
      setMessage({ type: "success", text: "Settings reset to defaults." });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to reset settings" });
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-on-surface-variant text-sm">Loading settings...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="font-display font-bold text-2xl text-foreground">Settings</h1>

      {message && (
        <div className={`p-3 rounded-md text-sm ${message.type === "success" ? "bg-success-container text-success" : "bg-error-container text-error"}`}>
          {message.text}
        </div>
      )}

      {/* General */}
      <div className="bg-surface rounded-lg border border-border-light p-4 space-y-4">
        <h2 className="font-display font-semibold text-sm text-foreground">General</h2>
        <div>
          <label className="block text-sm font-medium text-on-surface mb-1">Default Target URL</label>
          <input
            type="url"
            value={form.targetUrl}
            onChange={(e) => setForm({ ...form, targetUrl: e.target.value })}
            placeholder="https://example.com"
            className="w-full px-3 py-2 border border-border rounded-md bg-surface text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-on-surface mb-2">Default Browsers</label>
          <div className="flex gap-4">
            {BROWSERS.map((b) => (
              <label key={b} className="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.browsers.includes(b)}
                  onChange={() => toggleBrowser(b)}
                  className="rounded border-border text-primary"
                />
                {b}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Performance config */}
      <div className="bg-surface rounded-lg border border-border-light p-4 space-y-4">
        <h2 className="font-display font-semibold text-sm text-foreground">Performance Defaults</h2>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">Virtual Users</label>
            <input type="number" min={1} value={form.virtualUsers} onChange={(e) => setForm({ ...form, virtualUsers: Number(e.target.value) })} className="w-full px-2 py-1.5 border border-border rounded text-sm bg-surface text-foreground" />
          </div>
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">Ramp Up (s)</label>
            <input type="number" min={0} value={form.rampUpSeconds} onChange={(e) => setForm({ ...form, rampUpSeconds: Number(e.target.value) })} className="w-full px-2 py-1.5 border border-border rounded text-sm bg-surface text-foreground" />
          </div>
          <div>
            <label className="block text-xs text-on-surface-variant mb-1">Duration (s)</label>
            <input type="number" min={1} value={form.durationSeconds} onChange={(e) => setForm({ ...form, durationSeconds: Number(e.target.value) })} className="w-full px-2 py-1.5 border border-border rounded text-sm bg-surface text-foreground" />
          </div>
        </div>
      </div>

      {/* Security config */}
      <div className="bg-surface rounded-lg border border-border-light p-4 space-y-4">
        <h2 className="font-display font-semibold text-sm text-foreground">Security Defaults</h2>
        <div>
          <label className="block text-xs text-on-surface-variant mb-1">ZAP Path</label>
          <input type="text" value={form.zapPath} onChange={(e) => setForm({ ...form, zapPath: e.target.value })} className="w-full px-2 py-1.5 border border-border rounded text-sm bg-surface text-foreground" />
        </div>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer">
            <input type="checkbox" checked={form.passiveScan} onChange={(e) => setForm({ ...form, passiveScan: e.target.checked })} className="rounded border-border text-primary" />
            Passive Scan
          </label>
          <label className="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer">
            <input type="checkbox" checked={form.activeScan} onChange={(e) => setForm({ ...form, activeScan: e.target.checked })} className="rounded border-border text-primary" />
            Active Scan
          </label>
        </div>
      </div>

      {/* Output config */}
      <div className="bg-surface rounded-lg border border-border-light p-4 space-y-4">
        <h2 className="font-display font-semibold text-sm text-foreground">Output Defaults</h2>
        <div>
          <label className="block text-xs text-on-surface-variant mb-1">Export Format</label>
          <select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} className="px-2 py-1.5 border border-border rounded text-sm bg-surface text-foreground">
            <option value="json">JSON</option>
            <option value="html">HTML</option>
          </select>
        </div>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer">
            <input type="checkbox" checked={form.screenshots} onChange={(e) => setForm({ ...form, screenshots: e.target.checked })} className="rounded border-border text-primary" />
            Capture Screenshots
          </label>
          <label className="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer">
            <input type="checkbox" checked={form.networkLogs} onChange={(e) => setForm({ ...form, networkLogs: e.target.checked })} className="rounded border-border text-primary" />
            Capture Network Logs
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
        <Button variant="secondary" onClick={handleReset}>
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
}
