import BetterSqlite3 from "better-sqlite3";
import type { Session, SessionConfig, Phase } from "../../shared/types.js";

export class SessionRepository {
  private db: BetterSqlite3.Database;

  private stmtInsert: BetterSqlite3.Statement;
  private stmtSelectById: BetterSqlite3.Statement;
  private stmtUpdateStatus: BetterSqlite3.Statement;
  private stmtUpdateConfig: BetterSqlite3.Statement;
  private stmtSelectAll: BetterSqlite3.Statement;

  constructor(db: BetterSqlite3.Database) {
    this.db = db;

    this.stmtInsert = this.db.prepare(`
      INSERT INTO sessions (id, name, status, target_url, config, created_at, updated_at, resumed_from)
      VALUES (@id, @name, @status, @targetUrl, @config, @createdAt, @updatedAt, @resumedFrom)
    `);

    this.stmtSelectById = this.db.prepare(`
      SELECT * FROM sessions WHERE id = ?
    `);

    this.stmtUpdateStatus = this.db.prepare(`
      UPDATE sessions SET status = ?, updated_at = datetime('now') WHERE id = ?
    `);

    this.stmtUpdateConfig = this.db.prepare(`
      UPDATE sessions SET config = ?, updated_at = datetime('now') WHERE id = ?
    `);

    this.stmtSelectAll = this.db.prepare(`
      SELECT * FROM sessions ORDER BY created_at DESC
    `);
  }

  private mapRow(row: BetterSqlite3.RunResult | null): Session | undefined {
    if (!row || typeof row !== "object" || !("id" in row)) {
      return undefined;
    }
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      name: r.name as string,
      status: r.status as Phase,
      targetUrl: r.target_url as string,
      config: JSON.parse(r.config as string) as SessionConfig,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
      resumedFrom: (r.resumed_from as string) ?? null,
    };
  }

  create(session: Session): void {
    this.stmtInsert.run({
      id: session.id,
      name: session.name,
      status: session.status,
      targetUrl: session.targetUrl,
      config: JSON.stringify(session.config),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      resumedFrom: session.resumedFrom ?? null,
    });
  }

  getById(id: string): Session | undefined {
    const row = this.stmtSelectById.get(id) as Record<string, unknown> | undefined;
    return this.mapRow(row as unknown as BetterSqlite3.RunResult | null);
  }

  updateStatus(id: string, status: Phase): void {
    this.stmtUpdateStatus.run(status, id);
  }

  updateConfig(id: string, config: SessionConfig): void {
    this.stmtUpdateConfig.run(JSON.stringify(config), id);
  }

  list(): Session[] {
    const rows = this.stmtSelectAll.all() as Record<string, unknown>[];
    return rows
      .map((row) => this.mapRow(row as unknown as BetterSqlite3.RunResult))
      .filter((s): s is Session => s !== undefined);
  }
}
