import { describe, it, expect, beforeEach } from "vitest";
import { SessionManager } from "../../../src/core/session.js";
import { createTestDb } from "../../helpers/test-db.js";
import { SessionError } from "../../../src/shared/errors.js";
import type { SessionConfig } from "../../../src/shared/types.js";

describe("SessionManager", () => {
  let db: ReturnType<typeof createTestDb>;
  let manager: SessionManager;

  const baseConfig: SessionConfig = {
    browsers: ["chromium"],
  };

  beforeEach(() => {
    db = createTestDb();
    manager = new SessionManager(db);
  });

  describe("createSession", () => {
    it("creates a session in INGESTION phase", () => {
      const session = manager.createSession("test-session", "http://localhost:3000", baseConfig);

      expect(session.id).toBeDefined();
      expect(session.name).toBe("test-session");
      expect(session.targetUrl).toBe("http://localhost:3000");
      expect(session.status).toBe("INGESTION");
      expect(session.config).toEqual(baseConfig);
      expect(session.createdAt).toBeDefined();
      expect(session.updatedAt).toBeDefined();
      expect(session.resumedFrom).toBeNull();
    });

    it("persists the session to the database", () => {
      const session = manager.createSession("persisted", "http://example.com", baseConfig);

      const retrieved = manager.getSession(session.id);
      expect(retrieved).toEqual(session);
    });

    it("logs SESSION_CREATED to audit log", () => {
      const session = manager.createSession("audit-test", "http://example.com", baseConfig);

      const rows = db.prepare("SELECT * FROM audit_log WHERE session_id = ?").all(session.id) as Record<string, unknown>[];
      expect(rows).toHaveLength(1);
      expect(rows[0].action).toBe("SESSION_CREATED");
      expect(rows[0].actor).toBe("system");
    });
  });

  describe("getSession", () => {
    it("returns the session by id", () => {
      const created = manager.createSession("find-me", "http://example.com", baseConfig);
      const found = manager.getSession(created.id);
      expect(found.id).toBe(created.id);
    });

    it("throws SessionError for unknown id", () => {
      expect(() => manager.getSession("nonexistent")).toThrow(SessionError);
      expect(() => manager.getSession("nonexistent")).toThrow("Session not found");
    });
  });

  describe("advancePhase", () => {
    it("advances INGESTION -> GENERATION", () => {
      const session = manager.createSession("advance", "http://example.com", baseConfig);
      const updated = manager.advancePhase(session.id);
      expect(updated.status).toBe("GENERATION");
    });

    it("advances GENERATION -> FUNCTIONAL", () => {
      const session = manager.createSession("advance", "http://example.com", baseConfig);
      manager.advancePhase(session.id);
      const updated = manager.advancePhase(session.id);
      expect(updated.status).toBe("FUNCTIONAL");
    });

    it("advances FUNCTIONAL -> PERFORMANCE", () => {
      const session = manager.createSession("advance", "http://example.com", baseConfig);
      manager.advancePhase(session.id);
      manager.advancePhase(session.id);
      const updated = manager.advancePhase(session.id);
      expect(updated.status).toBe("PERFORMANCE");
    });

    it("advances PERFORMANCE -> SECURITY", () => {
      const session = manager.createSession("advance", "http://example.com", baseConfig);
      for (let i = 0; i < 4; i++) manager.advancePhase(session.id);
      const updated = manager.getSession(session.id);
      expect(updated.status).toBe("SECURITY");
    });

    it("advances SECURITY -> COMPLETE", () => {
      const session = manager.createSession("advance", "http://example.com", baseConfig);
      for (let i = 0; i < 5; i++) manager.advancePhase(session.id);
      const updated = manager.getSession(session.id);
      expect(updated.status).toBe("COMPLETE");
    });

    it("throws when advancing from COMPLETE", () => {
      const session = manager.createSession("advance", "http://example.com", baseConfig);
      for (let i = 0; i < 5; i++) manager.advancePhase(session.id);

      expect(() => manager.advancePhase(session.id)).toThrow(SessionError);
      expect(() => manager.advancePhase(session.id)).toThrow("already COMPLETE");
    });

    it("throws for unknown session", () => {
      expect(() => manager.advancePhase("nonexistent")).toThrow(SessionError);
    });

    it("logs phase transition to audit log", () => {
      const session = manager.createSession("audit-advance", "http://example.com", baseConfig);
      manager.advancePhase(session.id);

      const rows = db.prepare("SELECT * FROM audit_log WHERE session_id = ? AND action = 'PHASE_COMPLETED'").all(session.id) as Record<string, unknown>[];
      expect(rows).toHaveLength(1);
      const details = JSON.parse(rows[0].details as string);
      expect(details).toEqual({ from: "INGESTION", to: "GENERATION" });
    });

    it("logs SESSION_COMPLETED when reaching COMPLETE", () => {
      const session = manager.createSession("complete-audit", "http://example.com", baseConfig);
      for (let i = 0; i < 5; i++) manager.advancePhase(session.id);

      const rows = db.prepare("SELECT * FROM audit_log WHERE session_id = ? AND action = 'SESSION_COMPLETED'").all(session.id) as Record<string, unknown>[];
      expect(rows).toHaveLength(1);
    });
  });

  describe("canAdvance", () => {
    it("returns true when session is not COMPLETE", () => {
      const session = manager.createSession("can-advance", "http://example.com", baseConfig);
      expect(manager.canAdvance(session.id)).toBe(true);
    });

    it("returns false when session is COMPLETE", () => {
      const session = manager.createSession("can-advance", "http://example.com", baseConfig);
      for (let i = 0; i < 5; i++) manager.advancePhase(session.id);
      expect(manager.canAdvance(session.id)).toBe(false);
    });
  });

  describe("resumeSession", () => {
    it("returns the current session state", () => {
      const session = manager.createSession("resume", "http://example.com", baseConfig);
      manager.advancePhase(session.id);

      const resumed = manager.resumeSession(session.id);
      expect(resumed.status).toBe("GENERATION");
    });

    it("logs SESSION_RESUMED to audit log", () => {
      const session = manager.createSession("resume", "http://example.com", baseConfig);
      manager.resumeSession(session.id);

      const rows = db.prepare("SELECT * FROM audit_log WHERE session_id = ? AND action = 'SESSION_RESUMED'").all(session.id) as Record<string, unknown>[];
      expect(rows).toHaveLength(1);
      const details = JSON.parse(rows[0].details as string);
      expect(details.resumedAtPhase).toBe("INGESTION");
    });

    it("throws when trying to resume a completed session", () => {
      const session = manager.createSession("resume", "http://example.com", baseConfig);
      for (let i = 0; i < 5; i++) manager.advancePhase(session.id);

      expect(() => manager.resumeSession(session.id)).toThrow(SessionError);
      expect(() => manager.resumeSession(session.id)).toThrow("Cannot resume completed");
    });
  });

  describe("listSessions", () => {
    it("returns all sessions", () => {
      manager.createSession("first", "http://a.com", baseConfig);
      manager.createSession("second", "http://b.com", baseConfig);

      const list = manager.listSessions();
      expect(list).toHaveLength(2);
      const names = list.map((s) => s.name);
      expect(names).toContain("first");
      expect(names).toContain("second");
    });

    it("returns empty array when no sessions exist", () => {
      expect(manager.listSessions()).toEqual([]);
    });
  });
});
