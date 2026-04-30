import { describe, it, expect, beforeEach } from "vitest";
import { TestRunner } from "../../../src/core/runner.js";
import { createTestDb } from "../../helpers/test-db.js";
import { SessionError } from "../../../src/shared/errors.js";
import type { TestingModule } from "../../../src/modules/module-registry.js";
import type { SessionConfig, TestPhase, ModuleContext } from "../../../src/shared/types.js";

function createMockModule(phase: TestPhase): TestingModule {
  return {
    id: `mock-${phase.toLowerCase()}`,
    name: `Mock ${phase} Module`,
    phase,
    initialize: async (_ctx: ModuleContext) => {},
    generate: async () => [],
    execute: async () => [],
    cleanup: async () => {},
  };
}

describe("TestRunner", () => {
  let db: ReturnType<typeof createTestDb>;
  let runner: TestRunner;

  const baseConfig: SessionConfig = { browsers: ["chromium"] };

  beforeEach(() => {
    db = createTestDb();
    runner = new TestRunner(db);
  });

  async function advanceToPhase(sessionId: string, phase: string): Promise<void> {
    const phases = ["INGESTION", "GENERATION", "FUNCTIONAL", "PERFORMANCE", "SECURITY", "COMPLETE"];
    const session = runner["sessionManager"].getSession(sessionId);
    const currentIdx = phases.indexOf(session.status);
    const targetIdx = phases.indexOf(phase);
    for (let i = currentIdx; i < targetIdx; i++) {
      runner["sessionManager"].advancePhase(sessionId);
    }
  }

  describe("startSession", () => {
    it("creates a new session in INGESTION phase", async () => {
      const session = await runner.startSession("test", "http://localhost:3000", baseConfig);

      expect(session.status).toBe("INGESTION");
      expect(session.name).toBe("test");
      expect(session.targetUrl).toBe("http://localhost:3000");
    });

    it("logs SESSION_CREATED to audit log", async () => {
      const session = await runner.startSession("test", "http://localhost:3000", baseConfig);

      const rows = db.prepare("SELECT * FROM audit_log WHERE session_id = ? AND action = 'SESSION_CREATED'").all(session.id) as Record<string, unknown>[];
      // SessionManager also logs one, so expect at least 1
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("runPhase", () => {
    it("throws when session is COMPLETE", async () => {
      const session = await runner.startSession("test", "http://localhost:3000", baseConfig);
      await advanceToPhase(session.id, "COMPLETE");

      await expect(runner.runPhase(session.id)).rejects.toThrow(SessionError);
      await expect(runner.runPhase(session.id)).rejects.toThrow("already COMPLETE");
    });

    it("throws when phase has no module (non-executable phases)", async () => {
      const session = await runner.startSession("test", "http://localhost:3000", baseConfig);
      // INGESTION phase has no test module
      await expect(runner.runPhase(session.id)).rejects.toThrow(SessionError);
      await expect(runner.runPhase(session.id)).rejects.toThrow("no registered test module");
    });

    it("throws when phase is not approved", async () => {
      const session = await runner.startSession("test", "http://localhost:3000", baseConfig);
      await advanceToPhase(session.id, "FUNCTIONAL");

      runner.registry.register(createMockModule("FUNCTIONAL"));

      await expect(runner.runPhase(session.id)).rejects.toThrow(SessionError);
      await expect(runner.runPhase(session.id)).rejects.toThrow("not approved");
    });

    it("throws when no module registered for the phase", async () => {
      const session = await runner.startSession("test", "http://localhost:3000", baseConfig);
      await advanceToPhase(session.id, "FUNCTIONAL");

      runner["approvalGateManager"].createGate(session.id, "FUNCTIONAL");
      runner["approvalGateManager"].approve(session.id, "FUNCTIONAL", "user");

      // No module registered
      await expect(runner.runPhase(session.id)).rejects.toThrow("No module registered");
    });

    it("executes the module and advances phase when approved", async () => {
      let executeCalled = false;
      const mockModule: TestingModule = {
        ...createMockModule("FUNCTIONAL"),
        execute: async () => {
          executeCalled = true;
          return [];
        },
      };
      runner.registry.register(mockModule);

      const session = await runner.startSession("test", "http://localhost:3000", baseConfig);
      await advanceToPhase(session.id, "FUNCTIONAL");

      runner["approvalGateManager"].createGate(session.id, "FUNCTIONAL");
      runner["approvalGateManager"].approve(session.id, "FUNCTIONAL", "user");

      const updated = await runner.runPhase(session.id);

      expect(executeCalled).toBe(true);
      expect(updated.status).toBe("PERFORMANCE");
    });

    it("logs PHASE_STARTED and PHASE_COMPLETED to audit log", async () => {
      runner.registry.register(createMockModule("FUNCTIONAL"));

      const session = await runner.startSession("test", "http://localhost:3000", baseConfig);
      await advanceToPhase(session.id, "FUNCTIONAL");

      runner["approvalGateManager"].createGate(session.id, "FUNCTIONAL");
      runner["approvalGateManager"].approve(session.id, "FUNCTIONAL", "user");

      await runner.runPhase(session.id);

      const started = db.prepare("SELECT * FROM audit_log WHERE session_id = ? AND action = 'PHASE_STARTED'").all(session.id) as Record<string, unknown>[];
      const completed = db.prepare("SELECT * FROM audit_log WHERE session_id = ? AND action = 'PHASE_COMPLETED'").all(session.id) as Record<string, unknown>[];

      // There are PHASE_STARTED entries from gate creation too, so check >= 1
      expect(started.length).toBeGreaterThanOrEqual(1);
      expect(completed.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("requestApproval", () => {
    it("creates a gate for the current executable phase", async () => {
      const session = await runner.startSession("test", "http://localhost:3000", baseConfig);
      await advanceToPhase(session.id, "FUNCTIONAL");

      await runner.requestApproval(session.id);

      const pending = runner["approvalGateManager"].getPendingGates(session.id);
      expect(pending).toHaveLength(1);
      expect(pending[0].phase).toBe("FUNCTIONAL");
      expect(pending[0].status).toBe("PENDING");
    });

    it("throws when session is COMPLETE", async () => {
      const session = await runner.startSession("test", "http://localhost:3000", baseConfig);
      await advanceToPhase(session.id, "COMPLETE");

      await expect(runner.requestApproval(session.id)).rejects.toThrow("already COMPLETE");
    });

    it("throws when phase does not require approval", async () => {
      const session = await runner.startSession("test", "http://localhost:3000", baseConfig);
      // INGESTION phase doesn't have approval gates
      await expect(runner.requestApproval(session.id)).rejects.toThrow("does not require approval");
    });
  });

  describe("resumeAndContinue", () => {
    it("returns session as-is when phase is not executable", async () => {
      const session = await runner.startSession("test", "http://localhost:3000", baseConfig);
      // INGESTION is not an executable phase
      const result = await runner.resumeAndContinue(session.id);
      expect(result.status).toBe("INGESTION");
    });

    it("returns session when phase is executable but not approved", async () => {
      const session = await runner.startSession("test", "http://localhost:3000", baseConfig);
      await advanceToPhase(session.id, "FUNCTIONAL");

      const result = await runner.resumeAndContinue(session.id);
      expect(result.status).toBe("FUNCTIONAL");
    });

    it("runs phase automatically when already approved", async () => {
      runner.registry.register(createMockModule("FUNCTIONAL"));

      const session = await runner.startSession("test", "http://localhost:3000", baseConfig);
      await advanceToPhase(session.id, "FUNCTIONAL");

      runner["approvalGateManager"].createGate(session.id, "FUNCTIONAL");
      runner["approvalGateManager"].approve(session.id, "FUNCTIONAL", "user");

      const result = await runner.resumeAndContinue(session.id);
      expect(result.status).toBe("PERFORMANCE");
    });

    it("logs SESSION_RESUMED to audit log", async () => {
      const session = await runner.startSession("test", "http://localhost:3000", baseConfig);
      await runner.resumeAndContinue(session.id);

      const rows = db.prepare("SELECT * FROM audit_log WHERE session_id = ? AND action = 'SESSION_RESUMED'").all(session.id) as Record<string, unknown>[];
      expect(rows).toHaveLength(1);
    });
  });

  describe("full workflow", () => {
    it("supports the complete phased workflow: start -> approve -> run", async () => {
      runner.registry.register(createMockModule("FUNCTIONAL"));

      // Start session
      const session = await runner.startSession("workflow", "http://localhost:3000", baseConfig);
      expect(session.status).toBe("INGESTION");

      // Advance to FUNCTIONAL
      await advanceToPhase(session.id, "FUNCTIONAL");

      // Request approval
      await runner.requestApproval(session.id);

      // Approve
      runner["approvalGateManager"].approve(session.id, "FUNCTIONAL", "qa-engineer");

      // Run phase
      const updated = await runner.runPhase(session.id);
      expect(updated.status).toBe("PERFORMANCE");
    });
  });

  describe("multi-phase gate enforcement (US1 AS3)", () => {
    it("blocks execution of next phase until explicitly approved", async () => {
      runner.registry.register(createMockModule("FUNCTIONAL"));
      runner.registry.register(createMockModule("PERFORMANCE"));

      const session = await runner.startSession("multi-gate", "http://localhost:3000", baseConfig);

      // Advance to FUNCTIONAL, approve, and run
      await advanceToPhase(session.id, "FUNCTIONAL");
      await runner.requestApproval(session.id);
      runner["approvalGateManager"].approve(session.id, "FUNCTIONAL", "qa-engineer");
      const afterFunctional = await runner.runPhase(session.id);
      expect(afterFunctional.status).toBe("PERFORMANCE");

      // PERFORMANCE phase must NOT execute without approval
      await expect(runner.runPhase(session.id)).rejects.toThrow("not approved");

      // Now approve PERFORMANCE and run
      await runner.requestApproval(session.id);
      runner["approvalGateManager"].approve(session.id, "PERFORMANCE", "qa-engineer");
      const afterPerformance = await runner.runPhase(session.id);
      expect(afterPerformance.status).toBe("SECURITY");
    });
  });

  describe("session resume restores state (US1 AS4)", () => {
    it("preserves pending approvals across resume", async () => {
      const session = await runner.startSession("resume-state", "http://localhost:3000", baseConfig);

      // Advance to FUNCTIONAL and create a gate but do NOT approve
      await advanceToPhase(session.id, "FUNCTIONAL");
      await runner.requestApproval(session.id);

      // Resume — should return session without running (gate still pending)
      const resumed = await runner.resumeAndContinue(session.id);
      expect(resumed.status).toBe("FUNCTIONAL");

      // The pending gate should still exist
      const pending = runner["approvalGateManager"].getPendingGates(session.id);
      expect(pending).toHaveLength(1);
      expect(pending[0].phase).toBe("FUNCTIONAL");
      expect(pending[0].status).toBe("PENDING");
    });

    it("preserves approved gates across resume and auto-runs", async () => {
      runner.registry.register(createMockModule("FUNCTIONAL"));

      const session = await runner.startSession("resume-approved", "http://localhost:3000", baseConfig);
      await advanceToPhase(session.id, "FUNCTIONAL");
      await runner.requestApproval(session.id);
      runner["approvalGateManager"].approve(session.id, "FUNCTIONAL", "qa-engineer");

      // Resume — gate is approved, should auto-run
      const resumed = await runner.resumeAndContinue(session.id);
      expect(resumed.status).toBe("PERFORMANCE");
    });
  });
});
