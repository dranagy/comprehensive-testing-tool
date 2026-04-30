import { Router } from "express";
import path from "node:path";
import { v4 as uuidv4 } from "uuid";
import { SessionManager } from "../../core/session.js";
import { AuditLogger } from "../../core/audit-log.js";
import { TestCaseRepository } from "../../db/repositories/test-case-repo.js";
import { getDb } from "../db.js";
import { resolveSession } from "../middleware/session-resolver.js";
import "../types.js";
import type { TestPhase, TestCase, TestCaseDefinition } from "../../shared/types.js";

export const generateRouter = Router();

// Generate all phases
generateRouter.post("/:sessionId", resolveSession, async (req, res) => {
  const db = getDb();
  const auditLogger = new AuditLogger(db);
  const testCaseRepo = new TestCaseRepository(db);
  const session = req.session!;

  const phases: TestPhase[] = ["FUNCTIONAL", "PERFORMANCE", "SECURITY"];
  const results: Array<{ phase: string; generatedCount: number }> = [];

  for (const phase of phases) {
    const existing = testCaseRepo.getBySession(session.id, phase);
    if (existing.length > 0) {
      results.push({ phase, generatedCount: existing.length });
      continue;
    }

    let generatedCount = 0;

    if (phase === "FUNCTIONAL") {
      // Functional tests are generated via the ingest route, not here
      generatedCount = 0;
    } else if (phase === "PERFORMANCE") {
      const functionalTests = testCaseRepo.getBySession(session.id, "FUNCTIONAL");
      if (functionalTests.length > 0) {
        const now = new Date().toISOString();
        const perfCases: TestCase[] = functionalTests.map((ft) => ({
          id: uuidv4(),
          sessionId: session.id,
          sourceDocumentId: ft.sourceDocumentId,
          phase: "PERFORMANCE" as TestPhase,
          name: `Perf: ${ft.name}`,
          description: `Performance scenario derived from: ${ft.name}`,
          definition: {
            steps: ft.definition.steps,
            assertions: [{ type: "status" as const, expected: "200" }],
          },
          approvalStatus: "GENERATED",
          tags: [...ft.tags, "performance", "derived"],
          editHistory: [],
          createdAt: now,
          updatedAt: now,
        }));
        testCaseRepo.createMany(perfCases);
        generatedCount = perfCases.length;
      }
    } else if (phase === "SECURITY") {
      const now = new Date().toISOString();
      const securityCases: TestCase[] = [
        {
          id: uuidv4(),
          sessionId: session.id,
          sourceDocumentId: null,
          phase: "SECURITY",
          name: "Security Scan - Passive",
          description: "Passive security scan",
          definition: {
            steps: [{ action: "navigate" as const, selector: "/", description: "Navigate to root for passive scan" }],
            assertions: [{ type: "status" as const, expected: "200" }],
          },
          approvalStatus: "GENERATED",
          tags: ["security", "passive"],
          editHistory: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: uuidv4(),
          sessionId: session.id,
          sourceDocumentId: null,
          phase: "SECURITY",
          name: "Security Scan - Active",
          description: "Active security scan",
          definition: {
            steps: [{ action: "navigate" as const, selector: "/", description: "Navigate to root for active scan" }],
            assertions: [{ type: "status" as const, expected: "200" }],
          },
          approvalStatus: "GENERATED",
          tags: ["security", "active"],
          editHistory: [],
          createdAt: now,
          updatedAt: now,
        },
      ];
      testCaseRepo.createMany(securityCases);
      generatedCount = securityCases.length;
    }

    results.push({ phase, generatedCount });
    auditLogger.log(session.id, "TESTS_GENERATED", "api", { phase, count: generatedCount });
  }

  res.json({ phases: results });
});

// Generate tests by phase
generateRouter.post("/:sessionId/:phase", resolveSession, async (req, res) => {
  const phase = (req.params.phase as string)?.toUpperCase() as TestPhase;
  if (!["FUNCTIONAL", "PERFORMANCE", "SECURITY"].includes(phase)) {
    res.status(400).json({ error: `Invalid phase: ${phase}` });
    return;
  }

  const db = getDb();
  const auditLogger = new AuditLogger(db);
  const testCaseRepo = new TestCaseRepository(db);

  const session = req.session!;
  let generatedCount = 0;

  if (phase === "FUNCTIONAL") {
    const existing = testCaseRepo.getBySession(session.id, "FUNCTIONAL");
    generatedCount = existing.length;
  } else if (phase === "PERFORMANCE") {
    const existing = testCaseRepo.getBySession(session.id, "PERFORMANCE");
    if (existing.length > 0) {
      generatedCount = existing.length;
    } else {
      const functionalTests = testCaseRepo.getBySession(session.id, "FUNCTIONAL");
      if (functionalTests.length === 0) {
        res.status(400).json({
          error: "No functional tests found. Ingest documents first.",
        });
        return;
      }

      const now = new Date().toISOString();
      const perfCases: TestCase[] = functionalTests.map((ft) => ({
        id: uuidv4(),
        sessionId: session.id,
        sourceDocumentId: ft.sourceDocumentId,
        phase: "PERFORMANCE" as TestPhase,
        name: `Perf: ${ft.name}`,
        description: `Performance scenario derived from: ${ft.name}`,
        definition: {
          steps: ft.definition.steps,
          assertions: [{ type: "status" as const, expected: "200" }],
        },
        approvalStatus: "GENERATED",
        tags: [...ft.tags, "performance", "derived"],
        editHistory: [],
        createdAt: now,
        updatedAt: now,
      }));

      testCaseRepo.createMany(perfCases);
      generatedCount = perfCases.length;
    }
  } else if (phase === "SECURITY") {
    const existing = testCaseRepo.getBySession(session.id, "SECURITY");
    if (existing.length > 0) {
      generatedCount = existing.length;
    } else {
      const now = new Date().toISOString();
      const securityCases: TestCase[] = [
        {
          id: uuidv4(),
          sessionId: session.id,
          sourceDocumentId: null,
          phase: "SECURITY",
          name: "Security Scan - Passive",
          description: "Passive security scan",
          definition: {
            steps: [
              {
                action: "navigate" as const,
                selector: "/",
                description: "Navigate to root for passive scan",
              },
            ],
            assertions: [{ type: "status" as const, expected: "200" }],
          },
          approvalStatus: "GENERATED",
          tags: ["security", "passive"],
          editHistory: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: uuidv4(),
          sessionId: session.id,
          sourceDocumentId: null,
          phase: "SECURITY",
          name: "Security Scan - Active",
          description: "Active security scan",
          definition: {
            steps: [
              {
                action: "navigate" as const,
                selector: "/",
                description: "Navigate to root for active scan",
              },
            ],
            assertions: [{ type: "status" as const, expected: "200" }],
          },
          approvalStatus: "GENERATED",
          tags: ["security", "active"],
          editHistory: [],
          createdAt: now,
          updatedAt: now,
        },
      ];

      testCaseRepo.createMany(securityCases);
      generatedCount = securityCases.length;
    }
  }

  auditLogger.log(session.id, "TESTS_GENERATED", "api", {
    phase,
    count: generatedCount,
  });

  res.json({ phase, generatedCount });
});
