import BetterSqlite3 from "better-sqlite3";
import type { ApprovalGate, TestPhase, GateStatus } from "../../shared/types.js";

export class ApprovalGateRepository {
  private db: BetterSqlite3.Database;

  private stmtInsert: BetterSqlite3.Statement;
  private stmtSelectBySession: BetterSqlite3.Statement;
  private stmtSelectPending: BetterSqlite3.Statement;
  private stmtSelectByPhase: BetterSqlite3.Statement;
  private stmtResolve: BetterSqlite3.Statement;

  constructor(db: BetterSqlite3.Database) {
    this.db = db;

    this.stmtInsert = this.db.prepare(`
      INSERT INTO approval_gates (id, session_id, phase, status, resolved_by, resolved_at, comments, created_at)
      VALUES (@id, @sessionId, @phase, @status, @resolvedBy, @resolvedAt, @comments, @createdAt)
    `);

    this.stmtSelectBySession = this.db.prepare(`
      SELECT * FROM approval_gates WHERE session_id = ? ORDER BY created_at ASC
    `);

    this.stmtSelectPending = this.db.prepare(`
      SELECT * FROM approval_gates WHERE session_id = ? AND status = 'PENDING' ORDER BY created_at ASC
    `);

    this.stmtSelectByPhase = this.db.prepare(`
      SELECT * FROM approval_gates WHERE session_id = ? AND phase = ? ORDER BY created_at ASC LIMIT 1
    `);

    this.stmtResolve = this.db.prepare(`
      UPDATE approval_gates
      SET status = ?, resolved_by = ?, resolved_at = datetime('now'), comments = ?
      WHERE id = ?
    `);
  }

  private mapRow(row: Record<string, unknown>): ApprovalGate {
    return {
      id: row.id as string,
      sessionId: row.session_id as string,
      phase: row.phase as TestPhase,
      status: row.status as GateStatus,
      resolvedBy: (row.resolved_by as string) ?? null,
      resolvedAt: (row.resolved_at as string) ?? null,
      comments: (row.comments as string) ?? null,
      createdAt: row.created_at as string,
    };
  }

  create(gate: ApprovalGate): void {
    this.stmtInsert.run({
      id: gate.id,
      sessionId: gate.sessionId,
      phase: gate.phase,
      status: gate.status,
      resolvedBy: gate.resolvedBy ?? null,
      resolvedAt: gate.resolvedAt ?? null,
      comments: gate.comments ?? null,
      createdAt: gate.createdAt,
    });
  }

  getBySession(sessionId: string): ApprovalGate[] {
    const rows = this.stmtSelectBySession.all(sessionId) as Record<string, unknown>[];
    return rows.map((row) => this.mapRow(row));
  }

  getPending(sessionId: string): ApprovalGate[] {
    const rows = this.stmtSelectPending.all(sessionId) as Record<string, unknown>[];
    return rows.map((row) => this.mapRow(row));
  }

  getByPhase(sessionId: string, phase: TestPhase): ApprovalGate | undefined {
    const row = this.stmtSelectByPhase.get(sessionId, phase) as
      | Record<string, unknown>
      | undefined;
    if (!row) return undefined;
    return this.mapRow(row);
  }

  resolve(id: string, status: GateStatus, resolvedBy: string, comments: string | null): void {
    this.stmtResolve.run(status, resolvedBy, comments ?? null, id);
  }
}
