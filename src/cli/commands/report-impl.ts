import fs from "node:fs";
import path from "node:path";
import { initializeDatabase } from "../../db/migrations.js";
import { SessionManager } from "../../core/session.js";
import { AuditLogger } from "../../core/audit-log.js";
import { TestCaseRepository } from "../../db/repositories/test-case-repo.js";
import { ExecutionResultRepository } from "../../db/repositories/execution-result-repo.js";
import { SecurityFindingRepository } from "../../db/repositories/security-finding-repo.js";
import { formatOutput, formatFindingsTable } from "../output.js";
import { loadConfig } from "../../core/config.js";
import type { ExecutionResult } from "../../shared/types.js";

function openDb() {
  const cttDir = path.join(process.cwd(), ".ctt");
  if (!fs.existsSync(cttDir)) {
    fs.mkdirSync(cttDir, { recursive: true });
  }
  return initializeDatabase(path.join(cttDir, "sessions.db"));
}

function getLatestSessionId(sessionManager: SessionManager): string {
  const sessions = sessionManager.listSessions();
  if (sessions.length === 0) {
    console.error(
      "No sessions found. Run 'ctt init' to create a project first.",
    );
    process.exit(1);
    throw new Error("unreachable");
  }
  return sessions[0].id;
}

export async function reportCommand(
  type: string | undefined,
  options: Record<string, unknown>,
): Promise<void> {
  try {
    const db = openDb();
    const sessionManager = new SessionManager(db);
    const auditLogger = new AuditLogger(db);
    const testCaseRepo = new TestCaseRepository(db);
    const executionResultRepo = new ExecutionResultRepository(db);
    const securityFindingRepo = new SecurityFindingRepository(db);

    const sessionId = (options.session as string | undefined) ?? getLatestSessionId(sessionManager);
    const session = sessionManager.getSession(sessionId);

    // Determine output format
    let outputFormat: "json" | "terminal" | "junit" = "terminal";
    try {
      const config = loadConfig();
      outputFormat = config.output.format;
    } catch {
      // Use default terminal format
    }
    if (options.format === "json") outputFormat = "json";
    if (options.format === "junit") outputFormat = "junit";

    const reportType = (type ?? "summary").toLowerCase();

    switch (reportType) {
      case "summary":
        await reportSummary(
          session.id,
          session.name,
          testCaseRepo,
          executionResultRepo,
          securityFindingRepo,
          outputFormat,
          options,
        );
        break;
      case "functional":
        await reportFunctional(
          session.id,
          testCaseRepo,
          executionResultRepo,
          outputFormat,
          options,
        );
        break;
      case "performance":
        await reportPerformance(
          session.id,
          executionResultRepo,
          outputFormat,
          options,
        );
        break;
      case "security":
        await reportSecurity(
          session.id,
          securityFindingRepo,
          outputFormat,
          options,
        );
        break;
      case "audit":
        await reportAudit(
          session.id,
          auditLogger,
          outputFormat,
          options,
        );
        break;
      default:
        console.error(
          `Unknown report type: ${type}. Use "summary", "functional", "performance", "security", or "audit".`,
        );
        db.close();
        process.exit(1);
        return;
    }

    db.close();
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error generating report: ${message}`);
    process.exit(1);
  }
}

async function reportSummary(
  sessionId: string,
  sessionName: string,
  testCaseRepo: TestCaseRepository,
  executionResultRepo: ExecutionResultRepository,
  securityFindingRepo: SecurityFindingRepository,
  format: "json" | "terminal" | "junit",
  options: Record<string, unknown>,
): Promise<void> {
  const executionSummary = executionResultRepo.getSummary(sessionId);
  const functionalCount = testCaseRepo.countByPhase(sessionId, "FUNCTIONAL");
  const performanceCount = testCaseRepo.countByPhase(sessionId, "PERFORMANCE");
  const securityCount = testCaseRepo.countByPhase(sessionId, "SECURITY");
  const securityFindings = securityFindingRepo.getBySession(sessionId);
  const severityCounts = securityFindingRepo.getCountsBySeverity(sessionId);

  const reportData = {
    session: {
      id: sessionId,
      name: sessionName,
    },
    testCases: {
      functional: functionalCount,
      performance: performanceCount,
      security: securityCount,
      total: functionalCount + performanceCount + securityCount,
    },
    execution: executionSummary,
    security: {
      findings: securityFindings.length,
      bySeverity: severityCounts,
    },
  };

  if (format === "json") {
    const output = formatOutput(reportData, "json");
    writeOutput(output, options);
  } else {
    console.log(`\nSession Summary: ${sessionName}`);
    console.log(`  Session ID: ${sessionId}`);
    console.log("\n  Test Cases:");
    console.log(`    Functional:  ${functionalCount}`);
    console.log(`    Performance: ${performanceCount}`);
    console.log(`    Security:    ${securityCount}`);
    console.log(`    Total:       ${functionalCount + performanceCount + securityCount}`);

    if (executionSummary.total > 0) {
      console.log("\n  Execution Results:");
      console.log(`    Total:   ${executionSummary.total}`);
      console.log(`    Passed:  ${executionSummary.passed}`);
      console.log(`    Failed:  ${executionSummary.failed}`);
      console.log(`    Errored: ${executionSummary.errored}`);
      console.log(`    Skipped: ${executionSummary.skipped}`);

      const passRate =
        executionSummary.total > 0
          ? ((executionSummary.passed / executionSummary.total) * 100).toFixed(1)
          : "0.0";
      console.log(`    Pass Rate: ${passRate}%`);
    } else {
      console.log("\n  No execution results yet.");
    }

    if (securityFindings.length > 0) {
      console.log("\n  Security Findings:");
      console.log(`    Total: ${securityFindings.length}`);
      for (const [severity, count] of Object.entries(severityCounts)) {
        if (count > 0) {
          console.log(`    ${severity}: ${count}`);
        }
      }
    }
  }
}

async function reportFunctional(
  sessionId: string,
  testCaseRepo: TestCaseRepository,
  executionResultRepo: ExecutionResultRepository,
  format: "json" | "terminal" | "junit",
  options: Record<string, unknown>,
): Promise<void> {
  const testCases = testCaseRepo.getBySession(sessionId, "FUNCTIONAL");
  const executionResults = executionResultRepo.getBySession(sessionId);
  const executionSummary = executionResultRepo.getSummary(sessionId);

  // Map execution results by test case ID for quick lookup
  const resultsByTest = new Map(
    executionResults.map((er) => [er.testCaseId, er]),
  );

  if (format === "json" || format === "junit") {
    const output = formatOutput(
      {
        total: executionSummary.total,
        passed: executionSummary.passed,
        failed: executionSummary.failed,
        errored: executionSummary.errored,
        skipped: executionSummary.skipped,
        results: executionResults,
      },
      format,
    );
    writeOutput(output, options);
    return;
  }

  console.log("\nFunctional Test Report");
  console.log("=" .repeat(60));

  const totalDuration = executionResults.reduce(
    (sum, er) => sum + er.durationMs,
    0,
  );

  console.log(`  Total tests:  ${testCases.length}`);
  console.log(`  Executed:     ${executionSummary.total}`);
  console.log(`  Passed:       ${executionSummary.passed}`);
  console.log(`  Failed:       ${executionSummary.failed}`);
  console.log(`  Errored:      ${executionSummary.errored}`);
  console.log(`  Skipped:      ${executionSummary.skipped}`);
  console.log(`  Duration:     ${(totalDuration / 1000).toFixed(2)}s`);

  console.log("\n  Test Details:");
  for (const tc of testCases) {
    const result = resultsByTest.get(tc.id);
    const status = result?.status ?? "NOT RUN";
    const duration = result ? `${result.durationMs}ms` : "-";
    const icon =
      status === "PASSED"
        ? "[PASS]"
        : status === "FAILED"
          ? "[FAIL]"
          : status === "ERROR"
            ? "[ERR ]"
            : status === "SKIPPED"
              ? "[SKIP]"
              : "[----]";
    console.log(`    ${icon} ${tc.name} (${duration})`);
    if (result?.errorMessage) {
      console.log(`         Error: ${result.errorMessage}`);
    }
  }
}

async function reportPerformance(
  sessionId: string,
  executionResultRepo: ExecutionResultRepository,
  format: "json" | "terminal" | "junit",
  options: Record<string, unknown>,
): Promise<void> {
  const executionResults = executionResultRepo.getBySession(sessionId);
  const perfResults = executionResults.filter(
    (er: ExecutionResult) => er.artifacts && er.artifacts.metric,
  );

  if (format === "json") {
    const metrics = perfResults.map((er: ExecutionResult) => er.artifacts.metric);
    const output = formatOutput(
      {
        totalResults: perfResults.length,
        metrics,
        results: perfResults.map((er: ExecutionResult) => ({
          testCaseId: er.testCaseId,
          status: er.status,
          durationMs: er.durationMs,
          errorMessage: er.errorMessage,
        })),
      },
      "json",
    );
    writeOutput(output, options);
    return;
  }

  console.log("\nPerformance Report");
  console.log("=".repeat(60));

  if (perfResults.length === 0) {
    console.log("  No performance test results found.");
    console.log("  Run 'ctt run --phase performance' to execute performance tests.");
    return;
  }

  for (const er of perfResults) {
    const metric = er.artifacts.metric as Record<string, unknown> | undefined;
    const slaStatus = metric?.slaStatus ?? "N/A";
    const slaIcon = slaStatus === "PASS" ? "[PASS]" : slaStatus === "FAIL" ? "[FAIL]" : "[----]";

    console.log(`  ${slaIcon} SLA Status: ${String(slaStatus)}`);
    console.log(`    Test Case: ${er.testCaseId}`);
    console.log(`    Duration:  ${er.durationMs}ms`);

    if (metric) {
      if (metric.responseTimeP50 != null) console.log(`    p50:       ${metric.responseTimeP50}ms`);
      if (metric.responseTimeP90 != null) console.log(`    p90:       ${metric.responseTimeP90}ms`);
      if (metric.responseTimeP95 != null) console.log(`    p95:       ${metric.responseTimeP95}ms`);
      if (metric.responseTimeP99 != null) console.log(`    p99:       ${metric.responseTimeP99}ms`);
      if (metric.throughputRps != null) console.log(`    Throughput: ${metric.throughputRps} rps`);
      if (metric.errorRate != null) console.log(`    Error Rate: ${(Number(metric.errorRate) * 100).toFixed(2)}%`);
    }

    if (er.errorMessage) {
      console.log(`    Error: ${er.errorMessage}`);
    }
    console.log();
  }

  const passed = perfResults.filter((er: ExecutionResult) => er.status === "PASSED").length;
  const failed = perfResults.filter((er: ExecutionResult) => er.status === "FAILED").length;
  console.log(`  Total: ${perfResults.length} | Passed: ${passed} | Failed: ${failed}`);
}

async function reportSecurity(
  sessionId: string,
  securityFindingRepo: SecurityFindingRepository,
  format: "json" | "terminal" | "junit",
  options: Record<string, unknown>,
): Promise<void> {
  const findings = securityFindingRepo.getBySession(sessionId);
  const severityCounts = securityFindingRepo.getCountsBySeverity(sessionId);

  if (format === "json") {
    const output = formatOutput(
      {
        totalFindings: findings.length,
        bySeverity: severityCounts,
        findings,
      },
      "json",
    );
    writeOutput(output, options);
    return;
  }

  console.log("\nSecurity Report");
  console.log("=".repeat(60));

  if (findings.length === 0) {
    console.log(
      "  No security findings recorded. Run 'ctt run --phase security' to scan.",
    );
    return;
  }

  console.log(formatFindingsTable(findings));

  console.log("\n  Findings by Severity:");
  for (const [severity, count] of Object.entries(severityCounts)) {
    if (count > 0) {
      console.log(`    ${severity}: ${count}`);
    }
  }

  console.log("\n  Detailed Findings:");
  for (const f of findings) {
    console.log(`    [${f.severity}] ${f.title}`);
    console.log(`      URL:      ${f.url}`);
    console.log(`      Scan:     ${f.scanType}`);
    console.log(`      Category: ${f.category}`);
    if (f.evidence) {
      console.log(`      Evidence: ${f.evidence}`);
    }
    if (f.remediation) {
      console.log(`      Fix:      ${f.remediation}`);
    }
    console.log();
  }
}

async function reportAudit(
  sessionId: string,
  auditLogger: AuditLogger,
  format: "json" | "terminal" | "junit",
  options: Record<string, unknown>,
): Promise<void> {
  const auditTrail = auditLogger.exportSessionLog(sessionId);

  if (format === "json") {
    const output = formatOutput(
      {
        sessionId,
        entries: auditTrail,
        totalEntries: auditTrail.length,
      },
      "json",
    );
    writeOutput(output, options);
    return;
  }

  console.log("\nAudit Trail");
  console.log("=".repeat(80));
  console.log(`  Session: ${sessionId}`);
  console.log(`  Total entries: ${auditTrail.length}`);
  console.log();

  for (const entry of auditTrail) {
    const details = entry.details
      ? ` | ${JSON.stringify(entry.details)}`
      : "";
    console.log(
      `  ${entry.timestamp}  [${entry.action.padEnd(20)}]  ${entry.actor}${details}`,
    );
  }

  console.log("-".repeat(80));
}

function writeOutput(
  content: string,
  options: Record<string, unknown>,
): void {
  const outputPath = options.output as string | undefined;
  if (outputPath) {
    fs.writeFileSync(outputPath, content, "utf-8");
    console.log(`Report written to: ${outputPath}`);
  } else {
    console.log(content);
  }
}
