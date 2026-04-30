import BetterSqlite3 from "better-sqlite3";
import type { SecurityFinding, Severity, ScanType } from "../../shared/types.js";

export class SecurityFindingRepository {
  private db: BetterSqlite3.Database;

  private stmtInsert: BetterSqlite3.Statement;
  private stmtSelectBySession: BetterSqlite3.Statement;
  private stmtSelectBySeverity: BetterSqlite3.Statement;
  private stmtSelectCountsBySeverity: BetterSqlite3.Statement;

  constructor(db: BetterSqlite3.Database) {
    this.db = db;

    this.stmtInsert = this.db.prepare(`
      INSERT INTO security_findings (id, session_id, scan_type, severity, category, title, description, evidence, url, remediation, created_at)
      VALUES (@id, @sessionId, @scanType, @severity, @category, @title, @description, @evidence, @url, @remediation, @createdAt)
    `);

    this.stmtSelectBySession = this.db.prepare(`
      SELECT * FROM security_findings WHERE session_id = ? ORDER BY created_at ASC
    `);

    this.stmtSelectBySeverity = this.db.prepare(`
      SELECT * FROM security_findings WHERE session_id = ? AND severity = ? ORDER BY created_at ASC
    `);

    this.stmtSelectCountsBySeverity = this.db.prepare(`
      SELECT severity, COUNT(*) AS count
      FROM security_findings
      WHERE session_id = ?
      GROUP BY severity
    `);
  }

  private mapRow(row: Record<string, unknown>): SecurityFinding {
    return {
      id: row.id as string,
      sessionId: row.session_id as string,
      scanType: row.scan_type as ScanType,
      severity: row.severity as Severity,
      category: row.category as string,
      title: row.title as string,
      description: row.description as string,
      evidence: (row.evidence as string) ?? null,
      url: row.url as string,
      remediation: (row.remediation as string) ?? null,
      createdAt: row.created_at as string,
    };
  }

  create(finding: SecurityFinding): void {
    this.stmtInsert.run({
      id: finding.id,
      sessionId: finding.sessionId,
      scanType: finding.scanType,
      severity: finding.severity,
      category: finding.category,
      title: finding.title,
      description: finding.description,
      evidence: finding.evidence ?? null,
      url: finding.url,
      remediation: finding.remediation ?? null,
      createdAt: finding.createdAt,
    });
  }

  createMany(findings: SecurityFinding[]): void {
    const transaction = this.db.transaction(() => {
      for (const finding of findings) {
        this.create(finding);
      }
    });
    transaction();
  }

  getBySession(sessionId: string): SecurityFinding[] {
    const rows = this.stmtSelectBySession.all(sessionId) as Record<string, unknown>[];
    return rows.map((row) => this.mapRow(row));
  }

  getBySeverity(sessionId: string, severity: Severity): SecurityFinding[] {
    const rows = this.stmtSelectBySeverity.all(sessionId, severity) as Record<
      string,
      unknown
    >[];
    return rows.map((row) => this.mapRow(row));
  }

  getCountsBySeverity(sessionId: string): Record<Severity, number> {
    const rows = this.stmtSelectCountsBySeverity.all(sessionId) as Record<string, unknown>[];

    const counts: Record<Severity, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      INFORMATIONAL: 0,
    };

    for (const row of rows) {
      const severity = row.severity as Severity;
      counts[severity] = row.count as number;
    }

    return counts;
  }
}
