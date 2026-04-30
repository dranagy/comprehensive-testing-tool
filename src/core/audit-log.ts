import BetterSqlite3 from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import { AuditLogRepository } from "../db/repositories/audit-log-repo.js";
import type { AuditAction, AuditLogEntry } from "../shared/types.js";

export interface ExportedAuditEntry {
  timestamp: string;
  action: string;
  actor: string;
  details: Record<string, unknown> | null;
}

export class AuditLogger {
  private repo: AuditLogRepository;

  constructor(db: BetterSqlite3.Database) {
    this.repo = new AuditLogRepository(db);
  }

  log(
    sessionId: string,
    action: AuditAction,
    actor?: string,
    details?: Record<string, unknown>,
  ): AuditLogEntry {
    const entry: AuditLogEntry = {
      id: uuidv4(),
      sessionId,
      action,
      actor: actor ?? "system",
      details: details ?? null,
      timestamp: new Date().toISOString(),
    };

    this.repo.insert(entry);
    return entry;
  }

  getSessionLog(sessionId: string): AuditLogEntry[] {
    return this.repo.getBySession(sessionId);
  }

  exportSessionLog(sessionId: string): ExportedAuditEntry[] {
    const entries = this.repo.exportSession(sessionId);
    return entries.map((entry) => ({
      timestamp: entry.timestamp,
      action: entry.action,
      actor: entry.actor,
      details: entry.details,
    }));
  }
}
