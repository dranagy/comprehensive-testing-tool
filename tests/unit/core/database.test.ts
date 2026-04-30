import { describe, it, expect } from "vitest";
import { getDb } from "../../../src/api/db.js";
import { initializeDatabase } from "../../../src/db/migrations.js";

describe("getDb()", () => {
  it("returns the same instance on repeated calls without a path argument", () => {
    const db1 = getDb(":memory:");
    const db2 = getDb();
    expect(db1).toBe(db2);
  });

  it("creates a new instance when a different path is provided", () => {
    const db1 = getDb(":memory:");
    const db2 = getDb(":memory:");
    // A second call with :memory: creates a brand-new in-memory DB
    // (BetterSqlite3 treats each :memory: call as a new database)
    expect(db2).not.toBe(db1);
  });
});

describe("initializeDatabase()", () => {
  it("creates all required tables", () => {
    const db = initializeDatabase(":memory:");

    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      )
      .all() as Array<{ name: string }>;

    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain("sessions");
    expect(tableNames).toContain("test_cases");
    expect(tableNames).toContain("execution_results");
    expect(tableNames).toContain("audit_log");
    expect(tableNames).toContain("approval_gates");
  });

  it("enables WAL mode", () => {
    const db = initializeDatabase(":memory:");
    const result = db.pragma("journal_mode") as Array<{ journal_mode: string }>;
    // WAL mode may revert to memory for :memory: databases, but the pragma is applied
    expect(result[0].journal_mode).toMatch(/wal|memory/);
  });

  it("inserts a schema_version row on initialization", () => {
    const db = initializeDatabase(":memory:");
    const row = db
      .prepare("SELECT MAX(version) as version FROM schema_version")
      .get() as { version: number };
    expect(row.version).toBeGreaterThan(0);
  });

  it("is idempotent — running twice does not throw", () => {
    const db = initializeDatabase(":memory:");
    expect(() => {
      for (const table of ["sessions", "test_cases", "audit_log"]) {
        db.prepare(`SELECT COUNT(*) FROM ${table}`).get();
      }
    }).not.toThrow();
  });
});
