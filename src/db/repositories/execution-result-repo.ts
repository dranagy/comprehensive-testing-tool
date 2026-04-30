import BetterSqlite3 from "better-sqlite3";
import type {
  ExecutionResult,
  ExecutionStatus,
  BrowserType,
  NetworkEntry,
} from "../../shared/types.js";

export class ExecutionResultRepository {
  private db: BetterSqlite3.Database;

  private stmtInsert: BetterSqlite3.Statement;
  private stmtSelectByTestCase: BetterSqlite3.Statement;
  private stmtSelectBySession: BetterSqlite3.Statement;
  private stmtSelectFailedBySession: BetterSqlite3.Statement;
  private stmtCountTotal: BetterSqlite3.Statement;
  private stmtCountByStatus: BetterSqlite3.Statement;

  constructor(db: BetterSqlite3.Database) {
    this.db = db;

    this.stmtInsert = this.db.prepare(`
      INSERT INTO execution_results (id, test_case_id, session_id, status, duration_ms, browser, screenshot_path, network_log, error_message, artifacts, started_at, completed_at)
      VALUES (@id, @testCaseId, @sessionId, @status, @durationMs, @browser, @screenshotPath, @networkLog, @errorMessage, @artifacts, @startedAt, @completedAt)
    `);

    this.stmtSelectByTestCase = this.db.prepare(`
      SELECT * FROM execution_results WHERE test_case_id = ? ORDER BY started_at ASC
    `);

    this.stmtSelectBySession = this.db.prepare(`
      SELECT * FROM execution_results WHERE session_id = ? ORDER BY started_at ASC
    `);

    this.stmtSelectFailedBySession = this.db.prepare(`
      SELECT * FROM execution_results
      WHERE session_id = ? AND status IN ('FAILED', 'ERROR', 'TIMEOUT')
      ORDER BY started_at ASC
    `);

    this.stmtCountTotal = this.db.prepare(`
      SELECT COUNT(*) AS total FROM execution_results WHERE session_id = ?
    `);

    this.stmtCountByStatus = this.db.prepare(`
      SELECT status, COUNT(*) AS count
      FROM execution_results
      WHERE session_id = ?
      GROUP BY status
    `);
  }

  private mapRow(row: Record<string, unknown>): ExecutionResult {
    return {
      id: row.id as string,
      testCaseId: row.test_case_id as string,
      sessionId: row.session_id as string,
      status: row.status as ExecutionStatus,
      durationMs: row.duration_ms as number,
      browser: (row.browser as BrowserType) ?? null,
      screenshotPath: (row.screenshot_path as string) ?? null,
      networkLog: row.network_log
        ? (JSON.parse(row.network_log as string) as NetworkEntry[])
        : null,
      errorMessage: (row.error_message as string) ?? null,
      artifacts: JSON.parse(row.artifacts as string) as Record<string, unknown>,
      startedAt: row.started_at as string,
      completedAt: row.completed_at as string,
    };
  }

  create(result: ExecutionResult): void {
    this.stmtInsert.run({
      id: result.id,
      testCaseId: result.testCaseId,
      sessionId: result.sessionId,
      status: result.status,
      durationMs: result.durationMs,
      browser: result.browser ?? null,
      screenshotPath: result.screenshotPath ?? null,
      networkLog: result.networkLog ? JSON.stringify(result.networkLog) : null,
      errorMessage: result.errorMessage ?? null,
      artifacts: JSON.stringify(result.artifacts),
      startedAt: result.startedAt,
      completedAt: result.completedAt,
    });
  }

  getByTestCase(testCaseId: string): ExecutionResult[] {
    const rows = this.stmtSelectByTestCase.all(testCaseId) as Record<string, unknown>[];
    return rows.map((row) => this.mapRow(row));
  }

  getBySession(sessionId: string): ExecutionResult[] {
    const rows = this.stmtSelectBySession.all(sessionId) as Record<string, unknown>[];
    return rows.map((row) => this.mapRow(row));
  }

  getFailedBySession(sessionId: string): ExecutionResult[] {
    const rows = this.stmtSelectFailedBySession.all(sessionId) as Record<string, unknown>[];
    return rows.map((row) => this.mapRow(row));
  }

  getSummary(
    sessionId: string,
  ): { total: number; passed: number; failed: number; errored: number; skipped: number } {
    const totalRow = this.stmtCountTotal.get(sessionId) as Record<string, unknown>;
    const total = (totalRow.total as number) ?? 0;

    const statusRows = this.stmtCountByStatus.all(sessionId) as Record<string, unknown>[];

    const summary: Record<string, number> = {
      passed: 0,
      failed: 0,
      errored: 0,
      skipped: 0,
    };

    for (const row of statusRows) {
      const status = (row.status as string).toLowerCase();
      const count = row.count as number;
      // Map ERROR/TIMEOUT to errored, FAILED to failed, PASSED to passed, SKIPPED to skipped
      if (status === "error" || status === "timeout") {
        summary.errored += count;
      } else if (status in summary) {
        summary[status] = count;
      }
    }

    return {
      total,
      passed: summary.passed,
      failed: summary.failed,
      errored: summary.errored,
      skipped: summary.skipped,
    };
  }
}
