import BetterSqlite3 from "better-sqlite3";
import type { AuditLogEntry, AuditAction } from "../../shared/types.js";

export class AuditLogRepository {
  private db: BetterSqlite3.Database;

  private stmtInsert: BetterSqlite3.Statement;
  private stmtSelectBySession: BetterSqlite3.Statement;

  constructor(db: BetterSqlite3.Database) {
    this.db = db;

    this.stmtInsert = this.db.prepare(`
      INSERT INTO audit_log (id, session_id, action, actor, details, timestamp)
      VALUES (@id, @sessionId, @action, @actor, @details, @timestamp)
    `);

    this.stmtSelectBySession = this.db.prepare(`
      SELECT * FROM audit_log WHERE session_id = ? ORDER BY timestamp ASC
    `);
  }

  private mapRow(row: Record<string, unknown>): AuditLogEntry {
    return {
      id: row.id as string,
      sessionId: row.session_id as string,
      action: row.action as AuditAction,
      actor: row.actor as string,
      details: row.details
        ? (JSON.parse(row.details as string) as Record<string, unknown>)
        : null,
      timestamp: row.timestamp as string,
    };
  }

  insert(entry: AuditLogEntry): void {
    this.stmtInsert.run({
      id: entry.id,
      sessionId: entry.sessionId,
      action: entry.action,
      actor: entry.actor,
      details: entry.details ? JSON.stringify(entry.details) : null,
      timestamp: entry.timestamp,
    });
  }

  getBySession(sessionId: string): AuditLogEntry[] {
    const rows = this.stmtSelectBySession.all(sessionId) as Record<string, unknown>[];
    return rows.map((row) => this.mapRow(row));
  }

  exportSession(sessionId: string): AuditLogEntry[] {
    return this.getBySession(sessionId);
  }
}
