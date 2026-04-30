import path from "node:path";
import BetterSqlite3 from "better-sqlite3";
import { initializeDatabase } from "../db/migrations.js";

let dbInstance: BetterSqlite3.Database | null = null;

export function getDb(dbPath?: string): BetterSqlite3.Database {
  if (dbInstance && !dbPath) return dbInstance;

  const resolved = dbPath ?? path.join(process.cwd(), ".ctt", "sessions.db");
  dbInstance = initializeDatabase(resolved);
  return dbInstance;
}
