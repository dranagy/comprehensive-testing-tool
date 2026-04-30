import BetterSqlite3 from "better-sqlite3";
import { ALL_TABLES } from "../../src/db/schema.js";

export function createTestDb(): BetterSqlite3.Database {
  const db = new BetterSqlite3(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  for (const sql of ALL_TABLES) {
    db.exec(sql);
  }
  return db;
}
