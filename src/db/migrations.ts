import BetterSqlite3 from "better-sqlite3";
import { ALL_TABLES, SCHEMA_VERSION } from "./schema.js";

export function initializeDatabase(dbPath: string): BetterSqlite3.Database {
  const db = new BetterSqlite3(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  runMigrations(db);
  return db;
}

function runMigrations(db: BetterSqlite3.Database): void {
  // Create tables
  for (const sql of ALL_TABLES) {
    db.exec(sql);
  }

  // Check current version
  const row = db.prepare("SELECT MAX(version) as version FROM schema_version").get() as
    | { version: number | null }
    | undefined;

  const currentVersion = row?.version ?? 0;

  if (currentVersion < SCHEMA_VERSION) {
    db.prepare("INSERT INTO schema_version (version) VALUES (?)").run(SCHEMA_VERSION);
  }
}
