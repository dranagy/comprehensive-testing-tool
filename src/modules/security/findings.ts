import { v4 as uuidv4 } from "uuid";
import type { SecurityFinding, Severity, ScanType } from "../../shared/types.js";
import type { ZapAlert } from "./types.js";

const RISK_TO_SEVERITY: Record<string, Severity> = {
  "0": "INFORMATIONAL",
  "1": "LOW",
  "2": "MEDIUM",
  "3": "HIGH",
};

export function categorizeSeverity(riskCode: string, confidence?: string): Severity {
  const base = RISK_TO_SEVERITY[riskCode] ?? "INFORMATIONAL";

  // Upgrade to CRITICAL if risk is HIGH (3) and confidence is also HIGH (3)
  if (riskCode === "3" && confidence === "3") {
    return "CRITICAL";
  }

  return base;
}

export function processFindings(
  alerts: ZapAlert[],
  sessionId: string,
  scanType: ScanType,
): SecurityFinding[] {
  const seen = new Set<string>();
  const findings: SecurityFinding[] = [];

  for (const alert of alerts) {
    const dedupKey = `${alert.pluginId}:${alert.url}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    const severity = categorizeSeverity(alert.riskcode, alert.confidence);
    const now = new Date().toISOString();

    findings.push({
      id: uuidv4(),
      sessionId,
      scanType,
      severity,
      category: alert.pluginId,
      title: alert.alert,
      description: alert.description,
      evidence: alert.evidence ?? null,
      url: alert.url,
      remediation: alert.solution ?? null,
      createdAt: now,
    });
  }

  return findings;
}
