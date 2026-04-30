import type { ExecutionResult, OutputFormat, SecurityFinding } from "../shared/types.js";

export function formatOutput(data: unknown, format: OutputFormat): string {
  switch (format) {
    case "json":
      return JSON.stringify(data, null, 2);
    case "junit":
      return toJUnit(data as JunitData);
    case "terminal":
    default:
      return toTerminal(data);
  }
}

interface JunitData {
  total?: number;
  passed?: number;
  failed?: number;
  errored?: number;
  skipped?: number;
  durationMs?: number;
  results?: ExecutionResult[];
}

function toTerminal(data: unknown): string {
  if (typeof data === "string") return data;
  return JSON.stringify(data, null, 2);
}

function toJUnit(data: JunitData): string {
  const tests = data.total ?? 0;
  const failures = data.failed ?? 0;
  const errors = data.errored ?? 0;
  const time = ((data.durationMs ?? 0) / 1000).toFixed(3);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<testsuites tests="${tests}" failures="${failures}" errors="${errors}" time="${time}">\n`;
  xml += `  <testsuite name="ctt-test-suite" tests="${tests}" failures="${failures}" errors="${errors}" time="${time}">\n`;

  if (data.results) {
    for (const result of data.results) {
      xml += `    <testcase name="${escapeXml(result.testCaseId)}" time="${(result.durationMs / 1000).toFixed(3)}"`;
      if (result.status === "FAILED") {
        xml += `>\n      <failure message="${escapeXml(result.errorMessage ?? "Test failed")}"/>\n    </testcase>\n`;
      } else if (result.status === "ERROR" || result.status === "TIMEOUT") {
        xml += `>\n      <error message="${escapeXml(result.errorMessage ?? "Test errored")}"/>\n    </testcase>\n`;
      } else if (result.status === "SKIPPED") {
        xml += `>\n      <skipped/>\n    </testcase>\n`;
      } else {
        xml += `/>\n`;
      }
    }
  }

  xml += `  </testsuite>\n</testsuites>`;
  return xml;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function formatFindingsTable(findings: SecurityFinding[]): string {
  if (findings.length === 0) return "No security findings.";

  const severityOrder: Record<string, string> = {
    CRITICAL: "CRITICAL",
    HIGH: "HIGH",
    MEDIUM: "MEDIUM",
    LOW: "LOW",
    INFORMATIONAL: "INFO",
  };

  const sorted = [...findings].sort((a, b) => {
    const order = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFORMATIONAL"];
    return order.indexOf(a.severity) - order.indexOf(b.severity);
  });

  let output = "\nSecurity Findings:\n";
  output += "─".repeat(80) + "\n";
  for (const f of sorted) {
    const sev = severityOrder[f.severity] ?? f.severity;
    output += `[${sev.padEnd(8)}] ${f.title}\n`;
    output += `          Category: ${f.category} | URL: ${f.url}\n`;
    if (f.evidence) {
      output += `          Evidence: ${f.evidence.substring(0, 100)}\n`;
    }
    output += "\n";
  }
  output += "─".repeat(80) + "\n";
  output += `Total findings: ${findings.length}\n`;

  return output;
}
