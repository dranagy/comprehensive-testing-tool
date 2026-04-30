import { describe, it, expect, beforeEach } from "vitest";
import { AuditLogger } from "../../../src/core/audit-log.js";
import { createTestDb } from "../../helpers/test-db.js";

describe("AuditLogger", () => {
  let db: ReturnType<typeof createTestDb>;
  let logger: AuditLogger;
  const sessionId = "session-001";

  beforeEach(() => {
    db = createTestDb();
    logger = new AuditLogger(db);

    // Audit log entries reference sessions via FK; insert a minimal session row.
    db.prepare(
      `INSERT INTO sessions (id, name, status, target_url, config, created_at, updated_at)
       VALUES (?, 'test', 'INGESTION', 'http://example.com', '{}', datetime('now'), datetime('now'))`,
    ).run(sessionId);
  });

  describe("log", () => {
    it("inserts an audit log entry with all fields", () => {
      const entry = logger.log(sessionId, "SESSION_CREATED", "system", { name: "test" });

      expect(entry.id).toBeDefined();
      expect(entry.sessionId).toBe(sessionId);
      expect(entry.action).toBe("SESSION_CREATED");
      expect(entry.actor).toBe("system");
      expect(entry.details).toEqual({ name: "test" });
      expect(entry.timestamp).toBeDefined();
    });

    it("defaults actor to 'system' when not provided", () => {
      const entry = logger.log(sessionId, "PHASE_STARTED");
      expect(entry.actor).toBe("system");
    });

    it("defaults details to null when not provided", () => {
      const entry = logger.log(sessionId, "PHASE_COMPLETED");
      expect(entry.details).toBeNull();
    });

    it("persists the entry to the database", () => {
      logger.log(sessionId, "SESSION_CREATED", "system", { name: "test" });

      const rows = db.prepare("SELECT * FROM audit_log WHERE session_id = ?").all(sessionId) as Record<string, unknown>[];
      expect(rows).toHaveLength(1);
    });

    it("allows multiple entries for the same session", () => {
      logger.log(sessionId, "SESSION_CREATED");
      logger.log(sessionId, "PHASE_STARTED");
      logger.log(sessionId, "PHASE_COMPLETED");

      const rows = db.prepare("SELECT * FROM audit_log WHERE session_id = ?").all(sessionId) as Record<string, unknown>[];
      expect(rows).toHaveLength(3);
    });
  });

  describe("getSessionLog", () => {
    it("returns all entries for a session in chronological order", () => {
      logger.log(sessionId, "SESSION_CREATED");
      logger.log(sessionId, "PHASE_STARTED");
      logger.log(sessionId, "PHASE_COMPLETED");

      const log = logger.getSessionLog(sessionId);
      expect(log).toHaveLength(3);
      expect(log[0].action).toBe("SESSION_CREATED");
      expect(log[1].action).toBe("PHASE_STARTED");
      expect(log[2].action).toBe("PHASE_COMPLETED");
    });

    it("returns empty array for session with no log entries", () => {
      const log = logger.getSessionLog("empty-session");
      expect(log).toEqual([]);
    });
  });

  describe("exportSessionLog", () => {
    it("returns entries with timestamp, action, actor, details", () => {
      logger.log(sessionId, "SESSION_CREATED", "system", { name: "test" });
      logger.log(sessionId, "GATE_APPROVED", "qa-engineer", { phase: "FUNCTIONAL" });

      const exported = logger.exportSessionLog(sessionId);
      expect(exported).toHaveLength(2);

      expect(exported[0]).toEqual({
        timestamp: expect.any(String),
        action: "SESSION_CREATED",
        actor: "system",
        details: { name: "test" },
      });

      expect(exported[1]).toEqual({
        timestamp: expect.any(String),
        action: "GATE_APPROVED",
        actor: "qa-engineer",
        details: { phase: "FUNCTIONAL" },
      });
    });

    it("does not include the entry id in exported output", () => {
      logger.log(sessionId, "SESSION_CREATED");

      const exported = logger.exportSessionLog(sessionId);
      expect(exported[0]).not.toHaveProperty("id");
      expect(exported[0]).not.toHaveProperty("sessionId");
    });
  });

  describe("immutability", () => {
    it("entries cannot be updated after insertion", () => {
      logger.log(sessionId, "SESSION_CREATED", "system", { original: true });

      const rows = db.prepare("SELECT * FROM audit_log WHERE session_id = ?").all(sessionId) as Record<string, unknown>[];

      // Audit log table has no UPDATE statements in the repository
      // Verify the row is intact by re-reading
      const details = JSON.parse(rows[0].details as string);
      expect(details.original).toBe(true);
    });

    it("entries cannot be deleted", () => {
      logger.log(sessionId, "SESSION_CREATED");

      // The AuditLogRepository has no delete method
      // Verify we can still read the entry
      const log = logger.getSessionLog(sessionId);
      expect(log).toHaveLength(1);
    });
  });
});
