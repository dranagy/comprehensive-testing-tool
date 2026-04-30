import fs from "node:fs";
import path from "node:path";
import { initializeDatabase } from "../../db/migrations.js";
import { SessionManager } from "../../core/session.js";
import { AuditLogger } from "../../core/audit-log.js";
import { ApprovalGateManager } from "../../core/approval-gate.js";
import { TestCaseRepository } from "../../db/repositories/test-case-repo.js";
import { ExecutionResultRepository } from "../../db/repositories/execution-result-repo.js";
import { loadConfig, configToSessionConfig } from "../../core/config.js";
import type { Session } from "../../shared/types.js";

function openDb() {
  const cttDir = path.join(process.cwd(), ".ctt");
  if (!fs.existsSync(cttDir)) {
    fs.mkdirSync(cttDir, { recursive: true });
  }
  return initializeDatabase(path.join(cttDir, "sessions.db"));
}

function formatSessionRow(session: Session): string {
  return `  ${session.id}  ${session.name.padEnd(20)}  ${session.status.padEnd(12)}  ${session.targetUrl}  ${session.createdAt}`;
}

export async function sessionCreate(options: {
  target?: string;
}): Promise<void> {
  try {
    const db = openDb();

    // Load existing config
    const config = loadConfig();
    const targetUrl = options.target ?? config.target;
    const sessionConfig = configToSessionConfig(config);

    const sessionManager = new SessionManager(db);
    const auditLogger = new AuditLogger(db);

    const session = sessionManager.createSession(
      `session-${Date.now()}`,
      targetUrl,
      sessionConfig,
    );

    auditLogger.log(session.id, "SESSION_CREATED", "system", {
      name: session.name,
      targetUrl,
    });

    console.log("New session created successfully.");
    console.log(`  Session ID: ${session.id}`);
    console.log(`  Name:       ${session.name}`);
    console.log(`  Target:     ${session.targetUrl}`);
    console.log(`  Status:     ${session.status}`);

    db.close();
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error creating session: ${message}`);
    process.exit(1);
  }
}

export async function sessionResume(sessionId: string): Promise<void> {
  try {
    const db = openDb();
    const sessionManager = new SessionManager(db);
    const auditLogger = new AuditLogger(db);

    const session = sessionManager.resumeSession(sessionId);

    auditLogger.log(session.id, "SESSION_RESUMED", "system", {
      resumedAtPhase: session.status,
    });

    console.log("Session resumed successfully.");
    console.log(`  Session ID: ${session.id}`);
    console.log(`  Name:       ${session.name}`);
    console.log(`  Status:     ${session.status}`);
    console.log(`  Target:     ${session.targetUrl}`);
    console.log(`  Created:    ${session.createdAt}`);
    console.log(`  Updated:    ${session.updatedAt}`);

    db.close();
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error resuming session: ${message}`);
    process.exit(1);
  }
}

export async function sessionStatus(): Promise<void> {
  try {
    const db = openDb();
    const sessionManager = new SessionManager(db);
    const approvalGateManager = new ApprovalGateManager(db);
    const testCaseRepo = new TestCaseRepository(db);
    const executionResultRepo = new ExecutionResultRepository(db);

    const sessions = sessionManager.listSessions();
    if (sessions.length === 0) {
      console.log("No sessions found. Run 'ctt init' to create one.");
      db.close();
      process.exit(0);
      return;
    }

    // Find the latest session
    const session = sessions[0]; // listSessions returns DESC by created_at

    console.log(`Session: ${session.name} (${session.id})`);
    console.log(`  Target:  ${session.targetUrl}`);
    console.log(`  Status:  ${session.status}`);
    console.log(`  Created: ${session.createdAt}`);
    console.log(`  Updated: ${session.updatedAt}`);

    // Test counts by phase
    const phases: Array<"FUNCTIONAL" | "PERFORMANCE" | "SECURITY"> = [
      "FUNCTIONAL",
      "PERFORMANCE",
      "SECURITY",
    ];
    console.log("\n  Test case counts:");
    for (const phase of phases) {
      const count = testCaseRepo.countByPhase(session.id, phase);
      console.log(`    ${phase}: ${count}`);
    }

    // Pending approval gates
    const pendingGates = approvalGateManager.getPendingGates(session.id);
    if (pendingGates.length > 0) {
      console.log("\n  Pending approval gates:");
      for (const gate of pendingGates) {
        console.log(
          `    Phase: ${gate.phase}  Status: ${gate.status}  Created: ${gate.createdAt}`,
        );
      }
    } else {
      console.log("\n  No pending approval gates.");
    }

    // Execution summary
    const summary = executionResultRepo.getSummary(session.id);
    if (summary.total > 0) {
      console.log("\n  Execution results:");
      console.log(`    Total:   ${summary.total}`);
      console.log(`    Passed:  ${summary.passed}`);
      console.log(`    Failed:  ${summary.failed}`);
      console.log(`    Errored: ${summary.errored}`);
      console.log(`    Skipped: ${summary.skipped}`);
    }

    db.close();
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error getting session status: ${message}`);
    process.exit(1);
  }
}

export async function sessionList(): Promise<void> {
  try {
    const db = openDb();
    const sessionManager = new SessionManager(db);

    const sessions = sessionManager.listSessions();

    if (sessions.length === 0) {
      console.log("No sessions found. Run 'ctt init' to create one.");
      db.close();
      process.exit(0);
      return;
    }

    console.log(
      `  ${"ID".padEnd(36)}  ${"Name".padEnd(20)}  ${"Status".padEnd(12)}  ${"Target".padEnd(30)}  Created`,
    );
    console.log(
      `  ${"-".repeat(36)}  ${"-".repeat(20)}  ${"-".repeat(12)}  ${"-".repeat(30)}  ${"-".repeat(24)}`,
    );
    for (const session of sessions) {
      console.log(formatSessionRow(session));
    }

    db.close();
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error listing sessions: ${message}`);
    process.exit(1);
  }
}

export async function sessionExport(
  sessionId: string,
  options: { format?: string; output?: string },
): Promise<void> {
  try {
    const db = openDb();
    const sessionManager = new SessionManager(db);
    const auditLogger = new AuditLogger(db);
    const testCaseRepo = new TestCaseRepository(db);
    const executionResultRepo = new ExecutionResultRepository(db);

    // Verify session exists
    const session = sessionManager.getSession(sessionId);

    // Gather full audit trail
    const auditTrail = auditLogger.exportSessionLog(session.id);
    const testCases = testCaseRepo.getBySession(session.id);
    const executionResults = executionResultRepo.getBySession(session.id);

    const exportData = {
      session: {
        id: session.id,
        name: session.name,
        status: session.status,
        targetUrl: session.targetUrl,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
      testCases: testCases.map((tc) => ({
        id: tc.id,
        name: tc.name,
        phase: tc.phase,
        approvalStatus: tc.approvalStatus,
        definition: tc.definition,
      })),
      executionResults: executionResults.map((er) => ({
        id: er.id,
        testCaseId: er.testCaseId,
        status: er.status,
        durationMs: er.durationMs,
        errorMessage: er.errorMessage,
        startedAt: er.startedAt,
        completedAt: er.completedAt,
      })),
      auditTrail,
    };

    const outputFormat = options.format ?? "json";
    let content: string;

    if (outputFormat === "html") {
      content = generateHtmlExport(exportData);
    } else {
      content = JSON.stringify(exportData, null, 2);
    }

    if (options.output) {
      fs.writeFileSync(options.output, content, "utf-8");
      console.log(`Session exported to: ${options.output}`);
    } else {
      console.log(content);
    }

    db.close();
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error exporting session: ${message}`);
    process.exit(1);
  }
}

function generateHtmlExport(data: Record<string, unknown>): string {
  const session = data.session as Record<string, string>;
  const testCases = data.testCases as Array<Record<string, unknown>>;
  const executionResults = data.executionResults as Array<Record<string, unknown>>;
  const auditTrail = data.auditTrail as Array<Record<string, unknown>>;

  const passCount = executionResults.filter((r) => r.status === "PASSED").length;
  const failCount = executionResults.filter((r) => r.status === "FAILED").length;
  const errorCount = executionResults.filter((r) => r.status === "ERROR").length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>CTT Session Report: ${session.name}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 960px; margin: 0 auto; padding: 20px; }
  h1 { color: #1a1a1a; border-bottom: 2px solid #e0e0e0; padding-bottom: 8px; }
  h2 { color: #333; margin-top: 24px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #e0e0e0; }
  th { background: #f5f5f5; font-weight: 600; }
  .pass { color: #2e7d32; }
  .fail { color: #c62828; }
  .error { color: #e65100; }
  .summary { display: flex; gap: 24px; margin: 16px 0; }
  .summary-card { padding: 16px; border-radius: 8px; background: #f5f5f5; min-width: 120px; text-align: center; }
  .summary-card .number { font-size: 2em; font-weight: bold; }
</style>
</head>
<body>
  <h1>Session Report: ${session.name}</h1>
  <p><strong>ID:</strong> ${session.id} | <strong>Status:</strong> ${session.status} | <strong>Target:</strong> ${session.targetUrl}</p>

  <div class="summary">
    <div class="summary-card"><div class="number">${testCases.length}</div>Test Cases</div>
    <div class="summary-card"><div class="number pass">${passCount}</div>Passed</div>
    <div class="summary-card"><div class="number fail">${failCount}</div>Failed</div>
    <div class="summary-card"><div class="number error">${errorCount}</div>Errors</div>
  </div>

  <h2>Test Cases</h2>
  <table>
    <tr><th>Name</th><th>Phase</th><th>Status</th></tr>
    ${testCases.map((tc) => `<tr><td>${String(tc.name)}</td><td>${String(tc.phase)}</td><td>${String(tc.approvalStatus)}</td></tr>`).join("\n    ")}
  </table>

  <h2>Execution Results</h2>
  <table>
    <tr><th>Test Case</th><th>Status</th><th>Duration</th><th>Error</th></tr>
    ${executionResults.map((er) => `<tr><td>${String(er.testCaseId)}</td><td class="${String(er.status).toLowerCase()}">${String(er.status)}</td><td>${String(er.durationMs)}ms</td><td>${er.errorMessage ? String(er.errorMessage) : "-"}</td></tr>`).join("\n    ")}
  </table>

  <h2>Audit Trail</h2>
  <table>
    <tr><th>Timestamp</th><th>Action</th><th>Actor</th></tr>
    ${auditTrail.map((entry) => `<tr><td>${String(entry.timestamp)}</td><td>${String(entry.action)}</td><td>${String(entry.actor)}</td></tr>`).join("\n    ")}
  </table>

  <p style="color: #999; margin-top: 40px;">Generated by CTT on ${new Date().toISOString()}</p>
</body>
</html>`;
}
