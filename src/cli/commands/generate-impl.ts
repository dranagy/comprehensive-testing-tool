import fs from "node:fs";
import path from "node:path";
import { v4 as uuidv4 } from "uuid";
import { initializeDatabase } from "../../db/migrations.js";
import { SessionManager } from "../../core/session.js";
import { AuditLogger } from "../../core/audit-log.js";
import { TestCaseRepository } from "../../db/repositories/test-case-repo.js";
import type { TestPhase, TestCase, TestCaseDefinition } from "../../shared/types.js";

export async function generateCommand(
  phase: string | undefined,
  options: { session?: string },
): Promise<void> {
  try {
    const cttDir = path.join(process.cwd(), ".ctt");
    if (!fs.existsSync(cttDir)) {
      fs.mkdirSync(cttDir, { recursive: true });
    }
    const db = initializeDatabase(path.join(cttDir, "sessions.db"));

    const sessionManager = new SessionManager(db);
    const auditLogger = new AuditLogger(db);
    const testCaseRepo = new TestCaseRepository(db);

    // Resolve session
    const sessions = sessionManager.listSessions();
    if (sessions.length === 0) {
      console.error(
        "No sessions found. Run 'ctt init' to create a project first.",
      );
      db.close();
      process.exit(1);
      return;
    }

    const sessionId = options.session ?? sessions[0].id;
    const session = sessionManager.getSession(sessionId);

    const normalizedPhase = (phase ?? "functional").toUpperCase();
    let testPhase: TestPhase;
    let generatedCount = 0;

    if (
      normalizedPhase === "FUNCTIONAL" ||
      normalizedPhase === "FUNCTIONAL"
    ) {
      testPhase = "FUNCTIONAL";
      generatedCount = await generateFunctionalTests(
        session.id,
        testCaseRepo,
        auditLogger,
      );
    } else if (normalizedPhase === "PERFORMANCE") {
      testPhase = "PERFORMANCE";
      generatedCount = await generatePerformanceTests(
        session.id,
        testCaseRepo,
        auditLogger,
      );
    } else if (normalizedPhase === "SECURITY") {
      testPhase = "SECURITY";
      generatedCount = await generateSecurityTests(
        session.id,
        testCaseRepo,
        auditLogger,
      );
    } else {
      console.error(
        `Unknown phase: ${phase}. Use "functional", "performance", or "security".`,
      );
      db.close();
      process.exit(1);
      return;
    }

    auditLogger.log(session.id, "TESTS_GENERATED", "system", {
      phase: testPhase,
      count: generatedCount,
    });

    console.log(
      `\nGenerated ${generatedCount} ${testPhase.toLowerCase()} test case(s) for session ${session.name}.`,
    );

    db.close();
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error during generation: ${message}`);
    process.exit(1);
  }
}

/**
 * Generate functional tests from ingested documents.
 * Reads existing GENERATED test cases (already created during ingestion)
 * and reports the count. If none exist, provides a hint to run ingest first.
 */
async function generateFunctionalTests(
  sessionId: string,
  testCaseRepo: TestCaseRepository,
  auditLogger: AuditLogger,
): Promise<number> {
  const existingFunctional = testCaseRepo.getBySession(sessionId, "FUNCTIONAL");

  if (existingFunctional.length === 0) {
    console.log(
      "No functional test definitions found. Run 'ctt ingest <files>' first to parse documents and generate test cases.",
    );
    return 0;
  }

  // Tests were already created during ingestion. Report the count.
  const generatedCount = existingFunctional.length;

  console.log(
    `Found ${generatedCount} functional test definition(s) from ingested documents.`,
  );

  // Log the generation
  auditLogger.log(sessionId, "TESTS_GENERATED", "system", {
    phase: "FUNCTIONAL",
    count: generatedCount,
  });

  return generatedCount;
}

/**
 * Placeholder: Convert functional tests to performance scenarios.
 * Creates basic performance test definitions derived from functional test steps.
 */
async function generatePerformanceTests(
  sessionId: string,
  testCaseRepo: TestCaseRepository,
  auditLogger: AuditLogger,
): Promise<number> {
  const existingPerformance = testCaseRepo.getBySession(
    sessionId,
    "PERFORMANCE",
  );

  if (existingPerformance.length > 0) {
    console.log(
      `Found ${existingPerformance.length} existing performance test(s).`,
    );
    return existingPerformance.length;
  }

  // Derive performance tests from functional test cases
  const functionalTests = testCaseRepo.getBySession(sessionId, "FUNCTIONAL");

  if (functionalTests.length === 0) {
    console.log(
      "No functional tests found to derive performance scenarios from. Run 'ctt ingest' and 'ctt generate functional' first.",
    );
    return 0;
  }

  const now = new Date().toISOString();
  const performanceCases: TestCase[] = functionalTests.map((ft) => {
    // Create a simplified performance scenario based on the functional test
    const perfDefinition: TestCaseDefinition = {
      steps: ft.definition.steps,
      assertions: [
        {
          type: "status" as const,
          expected: "200",
        },
      ],
    };

    return {
      id: uuidv4(),
      sessionId,
      sourceDocumentId: ft.sourceDocumentId,
      phase: "PERFORMANCE" as TestPhase,
      name: `Perf: ${ft.name}`,
      description: `Performance scenario derived from functional test: ${ft.name}`,
      definition: perfDefinition,
      approvalStatus: "GENERATED",
      tags: [...ft.tags, "performance", "derived"],
      editHistory: [],
      createdAt: now,
      updatedAt: now,
    };
  });

  testCaseRepo.createMany(performanceCases);

  console.log(
    `Generated ${performanceCases.length} performance scenario(s) from functional tests.`,
  );
  console.log("  Note: Performance test execution is a placeholder in MVP.");

  auditLogger.log(sessionId, "TESTS_GENERATED", "system", {
    phase: "PERFORMANCE",
    count: performanceCases.length,
    derivedFrom: "FUNCTIONAL",
  });

  return performanceCases.length;
}

/**
 * Placeholder: Generate security scan config.
 * Creates a basic security test case derived from the session target URL.
 */
async function generateSecurityTests(
  sessionId: string,
  testCaseRepo: TestCaseRepository,
  auditLogger: AuditLogger,
): Promise<number> {
  const existingSecurity = testCaseRepo.getBySession(sessionId, "SECURITY");

  if (existingSecurity.length > 0) {
    console.log(
      `Found ${existingSecurity.length} existing security test(s).`,
    );
    return existingSecurity.length;
  }

  // Create a placeholder security scan test case
  const now = new Date().toISOString();
  const securityCase: TestCase = {
    id: uuidv4(),
    sessionId,
    sourceDocumentId: null,
    phase: "SECURITY",
    name: "Security Scan - Passive",
    description:
      "Automated passive security scan configuration (placeholder for MVP)",
    definition: {
      steps: [
        {
          action: "navigate" as const,
          selector: "/",
          description: "Navigate to application root for passive scan",
        },
      ],
      assertions: [
        {
          type: "status" as const,
          expected: "200",
        },
      ],
    },
    approvalStatus: "GENERATED",
    tags: ["security", "passive", "placeholder"],
    editHistory: [],
    createdAt: now,
    updatedAt: now,
  };

  const activeScanCase: TestCase = {
    id: uuidv4(),
    sessionId,
    sourceDocumentId: null,
    phase: "SECURITY",
    name: "Security Scan - Active",
    description:
      "Automated active security scan configuration (placeholder for MVP)",
    definition: {
      steps: [
        {
          action: "navigate" as const,
          selector: "/",
          description: "Navigate to application root for active scan",
        },
      ],
      assertions: [
        {
          type: "status" as const,
          expected: "200",
        },
      ],
    },
    approvalStatus: "GENERATED",
    tags: ["security", "active", "placeholder"],
    editHistory: [],
    createdAt: now,
    updatedAt: now,
  };

  const securityCases = [securityCase, activeScanCase];
  testCaseRepo.createMany(securityCases);

  console.log(
    `Generated ${securityCases.length} security scan configuration(s).`,
  );
  console.log("  Note: Security scan execution is a placeholder in MVP.");

  auditLogger.log(sessionId, "TESTS_GENERATED", "system", {
    phase: "SECURITY",
    count: securityCases.length,
    placeholder: true,
  });

  return securityCases.length;
}
