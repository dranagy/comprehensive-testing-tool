import { describe, it, expect, beforeEach } from "vitest";
import { ApprovalGateManager } from "../../../src/core/approval-gate.js";
import { SessionManager } from "../../../src/core/session.js";
import { createTestDb } from "../../helpers/test-db.js";
import { SessionError } from "../../../src/shared/errors.js";
import type { SessionConfig } from "../../../src/shared/types.js";

describe("ApprovalGateManager", () => {
  let db: ReturnType<typeof createTestDb>;
  let gateManager: ApprovalGateManager;
  let sessionManager: SessionManager;
  let sessionId: string;

  const baseConfig: SessionConfig = { browsers: ["chromium"] };

  beforeEach(() => {
    db = createTestDb();
    gateManager = new ApprovalGateManager(db);
    sessionManager = new SessionManager(db);
    const session = sessionManager.createSession("gate-test", "http://example.com", baseConfig);
    sessionId = session.id;
  });

  describe("createGate", () => {
    it("creates a PENDING gate for a phase", () => {
      const gate = gateManager.createGate(sessionId, "FUNCTIONAL");

      expect(gate.id).toBeDefined();
      expect(gate.sessionId).toBe(sessionId);
      expect(gate.phase).toBe("FUNCTIONAL");
      expect(gate.status).toBe("PENDING");
      expect(gate.resolvedBy).toBeNull();
      expect(gate.resolvedAt).toBeNull();
      expect(gate.comments).toBeNull();
    });

    it("throws for unknown session", () => {
      expect(() => gateManager.createGate("nonexistent", "FUNCTIONAL")).toThrow(SessionError);
    });

    it("throws when creating a duplicate gate for the same phase", () => {
      gateManager.createGate(sessionId, "FUNCTIONAL");
      expect(() => gateManager.createGate(sessionId, "FUNCTIONAL")).toThrow(SessionError);
      expect(() => gateManager.createGate(sessionId, "FUNCTIONAL")).toThrow("already exists");
    });

    it("allows creating gates for different phases", () => {
      const g1 = gateManager.createGate(sessionId, "FUNCTIONAL");
      const g2 = gateManager.createGate(sessionId, "PERFORMANCE");
      expect(g1.phase).toBe("FUNCTIONAL");
      expect(g2.phase).toBe("PERFORMANCE");
    });

    it("logs PHASE_STARTED to audit log", () => {
      gateManager.createGate(sessionId, "FUNCTIONAL");

      const rows = db.prepare("SELECT * FROM audit_log WHERE session_id = ? AND action = 'PHASE_STARTED'").all(sessionId) as Record<string, unknown>[];
      expect(rows).toHaveLength(1);
    });
  });

  describe("approve", () => {
    it("resolves gate to APPROVED", () => {
      gateManager.createGate(sessionId, "FUNCTIONAL");
      const resolved = gateManager.approve(sessionId, "FUNCTIONAL", "qa-engineer");

      expect(resolved.status).toBe("APPROVED");
      expect(resolved.resolvedBy).toBe("qa-engineer");
      expect(resolved.resolvedAt).toBeDefined();
    });

    it("accepts optional comments", () => {
      gateManager.createGate(sessionId, "FUNCTIONAL");
      const resolved = gateManager.approve(sessionId, "FUNCTIONAL", "qa-engineer", "Looks good");

      expect(resolved.comments).toBe("Looks good");
    });

    it("logs GATE_APPROVED to audit log", () => {
      gateManager.createGate(sessionId, "FUNCTIONAL");
      gateManager.approve(sessionId, "FUNCTIONAL", "qa-engineer");

      const rows = db.prepare("SELECT * FROM audit_log WHERE session_id = ? AND action = 'GATE_APPROVED'").all(sessionId) as Record<string, unknown>[];
      expect(rows).toHaveLength(1);
    });
  });

  describe("reject", () => {
    it("resolves gate to REJECTED", () => {
      gateManager.createGate(sessionId, "FUNCTIONAL");
      const resolved = gateManager.reject(sessionId, "FUNCTIONAL", "qa-engineer", "Needs rework");

      expect(resolved.status).toBe("REJECTED");
      expect(resolved.comments).toBe("Needs rework");
    });

    it("logs GATE_REJECTED to audit log", () => {
      gateManager.createGate(sessionId, "FUNCTIONAL");
      gateManager.reject(sessionId, "FUNCTIONAL", "qa-engineer");

      const rows = db.prepare("SELECT * FROM audit_log WHERE session_id = ? AND action = 'GATE_REJECTED'").all(sessionId) as Record<string, unknown>[];
      expect(rows).toHaveLength(1);
    });
  });

  describe("skip", () => {
    it("resolves gate to SKIPPED", () => {
      gateManager.createGate(sessionId, "PERFORMANCE");
      const resolved = gateManager.skip(sessionId, "PERFORMANCE", "qa-engineer", "Not needed");

      expect(resolved.status).toBe("SKIPPED");
    });

    it("logs GATE_SKIPPED to audit log", () => {
      gateManager.createGate(sessionId, "PERFORMANCE");
      gateManager.skip(sessionId, "PERFORMANCE", "qa-engineer");

      const rows = db.prepare("SELECT * FROM audit_log WHERE session_id = ? AND action = 'GATE_SKIPPED'").all(sessionId) as Record<string, unknown>[];
      expect(rows).toHaveLength(1);
    });
  });

  describe("resolveGate (shared behavior)", () => {
    it("throws when no gate exists for the phase", () => {
      expect(() => gateManager.approve(sessionId, "FUNCTIONAL", "user")).toThrow(SessionError);
      expect(() => gateManager.approve(sessionId, "FUNCTIONAL", "user")).toThrow("No gate found");
    });

    it("throws when gate is already resolved", () => {
      gateManager.createGate(sessionId, "FUNCTIONAL");
      gateManager.approve(sessionId, "FUNCTIONAL", "user");

      expect(() => gateManager.approve(sessionId, "FUNCTIONAL", "user")).toThrow(SessionError);
      expect(() => gateManager.reject(sessionId, "FUNCTIONAL", "user")).toThrow("already resolved");
    });
  });

  describe("isPhaseApproved", () => {
    it("returns false when no gate exists", () => {
      expect(gateManager.isPhaseApproved(sessionId, "FUNCTIONAL")).toBe(false);
    });

    it("returns false when gate is PENDING", () => {
      gateManager.createGate(sessionId, "FUNCTIONAL");
      expect(gateManager.isPhaseApproved(sessionId, "FUNCTIONAL")).toBe(false);
    });

    it("returns true when gate is APPROVED", () => {
      gateManager.createGate(sessionId, "FUNCTIONAL");
      gateManager.approve(sessionId, "FUNCTIONAL", "user");
      expect(gateManager.isPhaseApproved(sessionId, "FUNCTIONAL")).toBe(true);
    });

    it("returns false when gate is REJECTED", () => {
      gateManager.createGate(sessionId, "FUNCTIONAL");
      gateManager.reject(sessionId, "FUNCTIONAL", "user");
      expect(gateManager.isPhaseApproved(sessionId, "FUNCTIONAL")).toBe(false);
    });
  });

  describe("getPendingGates", () => {
    it("returns only PENDING gates", () => {
      gateManager.createGate(sessionId, "FUNCTIONAL");
      gateManager.createGate(sessionId, "PERFORMANCE");
      gateManager.approve(sessionId, "FUNCTIONAL", "user");

      const pending = gateManager.getPendingGates(sessionId);
      expect(pending).toHaveLength(1);
      expect(pending[0].phase).toBe("PERFORMANCE");
    });

    it("returns empty array when no pending gates", () => {
      expect(gateManager.getPendingGates(sessionId)).toEqual([]);
    });
  });
});
