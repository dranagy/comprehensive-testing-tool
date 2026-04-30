import fs from "node:fs";
import path from "node:path";
import { initializeDatabase } from "../../db/migrations.js";
import { SessionManager } from "../../core/session.js";
import { AuditLogger } from "../../core/audit-log.js";
import { ApprovalGateManager } from "../../core/approval-gate.js";
import { TestCaseRepository } from "../../db/repositories/test-case-repo.js";
import type { TestPhase, ApprovalStatus } from "../../shared/types.js";

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

export async function reviewList(options: {
  phase?: string;
}): Promise<void> {
  try {
    const db = openDb();
    const sessionManager = new SessionManager(db);
    const testCaseRepo = new TestCaseRepository(db);

    const sessionId = getLatestSessionId(sessionManager);

    let testCases;
    if (options.phase) {
      const phase = options.phase.toUpperCase() as TestPhase;
      testCases = testCaseRepo.getBySession(sessionId, phase);
    } else {
      testCases = testCaseRepo.getBySession(sessionId);
    }

    if (testCases.length === 0) {
      console.log("No test cases found.");
      db.close();
      process.exit(0);
      return;
    }

    console.log(
      `  ${"ID".padEnd(36)}  ${"Name".padEnd(30)}  ${"Phase".padEnd(12)}  ${"Status".padEnd(10)}`,
    );
    console.log(
      `  ${"-".repeat(36)}  ${"-".repeat(30)}  ${"-".repeat(12)}  ${"-".repeat(10)}`,
    );

    for (const tc of testCases) {
      const statusIcon = getStatusIcon(tc.approvalStatus);
      console.log(
        `  ${tc.id}  ${tc.name.padEnd(30)}  ${tc.phase.padEnd(12)}  ${statusIcon} ${tc.approvalStatus}`,
      );
    }

    console.log(`\nTotal: ${testCases.length} test case(s)`);

    db.close();
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error listing test cases: ${message}`);
    process.exit(1);
  }
}

export async function reviewShow(testId: string): Promise<void> {
  try {
    const db = openDb();
    const testCaseRepo = new TestCaseRepository(db);

    const testCase = testCaseRepo.getById(testId);

    if (!testCase) {
      console.error(`Test case not found: ${testId}`);
      db.close();
      process.exit(1);
      return;
    }

    console.log(`\nTest Case: ${testCase.name}`);
    console.log(`  ID:          ${testCase.id}`);
    console.log(`  Phase:       ${testCase.phase}`);
    console.log(`  Status:      ${testCase.approvalStatus}`);
    console.log(`  Description: ${testCase.description}`);
    console.log(`  Source Doc:  ${testCase.sourceDocumentId ?? "N/A"}`);
    console.log(`  Tags:        ${testCase.tags.join(", ") || "none"}`);
    console.log(`  Created:     ${testCase.createdAt}`);
    console.log(`  Updated:     ${testCase.updatedAt}`);

    console.log("\n  Steps:");
    if (testCase.definition.steps.length === 0) {
      console.log("    (none)");
    } else {
      for (let i = 0; i < testCase.definition.steps.length; i++) {
        const step = testCase.definition.steps[i];
        console.log(
          `    ${i + 1}. [${step.action}] ${step.description}`,
        );
        console.log(
          `       Selector: ${step.selector}${step.value ? `  Value: ${step.value}` : ""}`,
        );
      }
    }

    console.log("\n  Assertions:");
    if (testCase.definition.assertions.length === 0) {
      console.log("    (none)");
    } else {
      for (let i = 0; i < testCase.definition.assertions.length; i++) {
        const assertion = testCase.definition.assertions[i];
        console.log(
          `    ${i + 1}. [${assertion.type}] Expected: ${assertion.expected}${assertion.selector ? `  Selector: ${assertion.selector}` : ""}`,
        );
      }
    }

    if (testCase.editHistory.length > 0) {
      console.log("\n  Edit History:");
      for (const entry of testCase.editHistory) {
        console.log(
          `    ${entry.timestamp} - ${entry.field}: ${JSON.stringify(entry.previousValue)} -> ${JSON.stringify(entry.newValue)}`,
        );
      }
    }

    db.close();
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error showing test case: ${message}`);
    process.exit(1);
  }
}

export async function reviewEdit(testId: string): Promise<void> {
  try {
    const db = openDb();
    const testCaseRepo = new TestCaseRepository(db);

    const testCase = testCaseRepo.getById(testId);

    if (!testCase) {
      console.error(`Test case not found: ${testId}`);
      db.close();
      process.exit(1);
      return;
    }

    // For MVP: output the full test definition JSON and instructions
    console.log(`\nTest Case: ${testCase.name} (${testCase.id})`);
    console.log("\nCurrent test definition (JSON):");
    console.log(JSON.stringify(testCase.definition, null, 2));

    console.log(
      '\nTo edit this test case, modify the definition JSON and update via the config file or re-import.',
    );
    console.log(
      "Full programmatic editing will be available in a future release.",
    );

    db.close();
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error editing test case: ${message}`);
    process.exit(1);
  }
}

export async function reviewApprove(
  phase: string | undefined,
  options: { all?: boolean },
): Promise<void> {
  try {
    const db = openDb();
    const sessionManager = new SessionManager(db);
    const auditLogger = new AuditLogger(db);
    const approvalGateManager = new ApprovalGateManager(db);
    const testCaseRepo = new TestCaseRepository(db);

    const sessionId = getLatestSessionId(sessionManager);

    let phasesToApprove: TestPhase[];

    if (options.all) {
      phasesToApprove = ["FUNCTIONAL", "PERFORMANCE", "SECURITY"];
    } else if (phase) {
      phasesToApprove = [phase.toUpperCase() as TestPhase];
    } else {
      console.error(
        'Specify a phase (e.g. "functional") or use --all to approve all phases.',
      );
      db.close();
      process.exit(1);
      return;
    }

    let totalApproved = 0;

    for (const testPhase of phasesToApprove) {
      // Get all GENERATED/MODIFIED tests for this phase
      const testCases = testCaseRepo.getBySession(sessionId, testPhase);
      const pendingCases = testCases.filter(
        (tc) =>
          tc.approvalStatus === "GENERATED" || tc.approvalStatus === "MODIFIED",
      );

      if (pendingCases.length === 0) {
        console.log(
          `  No pending test cases for phase: ${testPhase}`,
        );
        continue;
      }

      // Approve each pending test case
      for (const tc of pendingCases) {
        testCaseRepo.updateApprovalStatus(tc.id, "APPROVED");

        auditLogger.log(sessionId, "TEST_APPROVED", "system", {
          testCaseId: tc.id,
          testCaseName: tc.name,
          phase: testPhase,
        });

        totalApproved++;
      }

      // Create and resolve the approval gate
      try {
        approvalGateManager.approve(
          sessionId,
          testPhase,
          "cli-user",
          `Approved ${pendingCases.length} test(s) via CLI`,
        );
      } catch {
        // Gate may already exist or be resolved -- that is acceptable
        try {
          const existingGate = approvalGateManager.getPendingGates(sessionId);
          const phaseGate = existingGate.find((g) => g.phase === testPhase);
          if (phaseGate) {
            console.log(
              `  Approval gate for ${testPhase} is already resolved: ${phaseGate.status}`,
            );
          }
        } catch {
          // Ignore gate resolution errors
        }
      }

      console.log(
        `  Approved ${pendingCases.length} test case(s) for phase: ${testPhase}`,
      );
    }

    console.log(`\nTotal approved: ${totalApproved} test case(s)`);

    db.close();
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error approving test cases: ${message}`);
    process.exit(1);
  }
}

export async function reviewReject(
  testId: string,
  options: { reason?: string },
): Promise<void> {
  try {
    const db = openDb();
    const sessionManager = new SessionManager(db);
    const auditLogger = new AuditLogger(db);
    const testCaseRepo = new TestCaseRepository(db);

    const testCase = testCaseRepo.getById(testId);

    if (!testCase) {
      console.error(`Test case not found: ${testId}`);
      db.close();
      process.exit(1);
      return;
    }

    if (
      testCase.approvalStatus === "REJECTED" ||
      testCase.approvalStatus === "APPROVED"
    ) {
      console.log(
        `Test case ${testCase.name} is already ${testCase.approvalStatus}.`,
      );
      db.close();
      process.exit(0);
      return;
    }

    testCaseRepo.updateApprovalStatus(testId, "REJECTED");

    auditLogger.log(testCase.sessionId, "TEST_REJECTED", "system", {
      testCaseId: testId,
      testCaseName: testCase.name,
      phase: testCase.phase,
      reason: options.reason ?? null,
    });

    console.log(`Rejected test case: ${testCase.name} (${testId})`);
    if (options.reason) {
      console.log(`  Reason: ${options.reason}`);
    }

    db.close();
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error rejecting test case: ${message}`);
    process.exit(1);
  }
}

function getStatusIcon(status: ApprovalStatus): string {
  switch (status) {
    case "APPROVED":
      return "[+]";
    case "REJECTED":
      return "[-]";
    case "GENERATED":
      return "[ ]";
    case "MODIFIED":
      return "[~]";
    case "SKIPPED":
      return "[/]";
    default:
      return "[?]";
  }
}
