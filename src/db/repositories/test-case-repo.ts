import BetterSqlite3 from "better-sqlite3";
import type {
  TestCase,
  TestPhase,
  ApprovalStatus,
  TestCaseDefinition,
  EditEntry,
} from "../../shared/types.js";

export class TestCaseRepository {
  private db: BetterSqlite3.Database;

  private stmtInsert: BetterSqlite3.Statement;
  private stmtSelectById: BetterSqlite3.Statement;
  private stmtSelectBySession: BetterSqlite3.Statement;
  private stmtSelectBySessionAndPhase: BetterSqlite3.Statement;
  private stmtSelectByTags: BetterSqlite3.Statement;
  private stmtUpdateApprovalStatus: BetterSqlite3.Statement;
  private stmtUpdateDefinition: BetterSqlite3.Statement;
  private stmtSelectFailedIds: BetterSqlite3.Statement;
  private stmtCountByPhase: BetterSqlite3.Statement;

  constructor(db: BetterSqlite3.Database) {
    this.db = db;

    this.stmtInsert = this.db.prepare(`
      INSERT INTO test_cases (id, session_id, source_document_id, phase, name, description, definition, approval_status, tags, edit_history, created_at, updated_at)
      VALUES (@id, @sessionId, @sourceDocumentId, @phase, @name, @description, @definition, @approvalStatus, @tags, @editHistory, @createdAt, @updatedAt)
    `);

    this.stmtSelectById = this.db.prepare(`
      SELECT * FROM test_cases WHERE id = ?
    `);

    this.stmtSelectBySession = this.db.prepare(`
      SELECT * FROM test_cases WHERE session_id = ? ORDER BY created_at ASC
    `);

    this.stmtSelectBySessionAndPhase = this.db.prepare(`
      SELECT * FROM test_cases WHERE session_id = ? AND phase = ? ORDER BY created_at ASC
    `);

    this.stmtSelectByTags = this.db.prepare(`
      SELECT * FROM test_cases WHERE session_id = ? ORDER BY created_at ASC
    `);

    this.stmtUpdateApprovalStatus = this.db.prepare(`
      UPDATE test_cases SET approval_status = ?, updated_at = datetime('now') WHERE id = ?
    `);

    this.stmtUpdateDefinition = this.db.prepare(`
      UPDATE test_cases SET definition = ?, edit_history = ?, updated_at = datetime('now') WHERE id = ?
    `);

    this.stmtSelectFailedIds = this.db.prepare(`
      SELECT DISTINCT tc.id
      FROM test_cases tc
      INNER JOIN execution_results er ON er.test_case_id = tc.id
      WHERE tc.session_id = ? AND er.status IN ('FAILED', 'ERROR', 'TIMEOUT')
    `);

    this.stmtCountByPhase = this.db.prepare(`
      SELECT COUNT(*) AS count FROM test_cases WHERE session_id = ? AND phase = ?
    `);
  }

  private mapRow(row: Record<string, unknown>): TestCase {
    return {
      id: row.id as string,
      sessionId: row.session_id as string,
      sourceDocumentId: (row.source_document_id as string) ?? null,
      phase: row.phase as TestPhase,
      name: row.name as string,
      description: row.description as string,
      definition: JSON.parse(row.definition as string) as TestCaseDefinition,
      approvalStatus: row.approval_status as ApprovalStatus,
      tags: JSON.parse(row.tags as string) as string[],
      editHistory: JSON.parse(row.edit_history as string) as EditEntry[],
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  create(testCase: TestCase): void {
    this.stmtInsert.run({
      id: testCase.id,
      sessionId: testCase.sessionId,
      sourceDocumentId: testCase.sourceDocumentId ?? null,
      phase: testCase.phase,
      name: testCase.name,
      description: testCase.description,
      definition: JSON.stringify(testCase.definition),
      approvalStatus: testCase.approvalStatus,
      tags: JSON.stringify(testCase.tags),
      editHistory: JSON.stringify(testCase.editHistory),
      createdAt: testCase.createdAt,
      updatedAt: testCase.updatedAt,
    });
  }

  createMany(cases: TestCase[]): void {
    const transaction = this.db.transaction(() => {
      for (const testCase of cases) {
        this.create(testCase);
      }
    });
    transaction();
  }

  getById(id: string): TestCase | undefined {
    const row = this.stmtSelectById.get(id) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return this.mapRow(row);
  }

  getBySession(sessionId: string, phase?: TestPhase): TestCase[] {
    const rows = phase
      ? (this.stmtSelectBySessionAndPhase.all(sessionId, phase) as Record<string, unknown>[])
      : (this.stmtSelectBySession.all(sessionId) as Record<string, unknown>[]);
    return rows.map((row) => this.mapRow(row));
  }

  getByTags(sessionId: string, tags: string[]): TestCase[] {
    const allCases = this.stmtSelectByTags.all(sessionId) as Record<string, unknown>[];
    return allCases
      .map((row) => this.mapRow(row))
      .filter((tc) => tags.some((tag) => tc.tags.includes(tag)));
  }

  updateApprovalStatus(id: string, status: ApprovalStatus): void {
    this.stmtUpdateApprovalStatus.run(status, id);
  }

  updateDefinition(id: string, definition: TestCaseDefinition, editEntry: EditEntry): void {
    // Fetch the current edit history so we can append the new entry
    const current = this.getById(id);
    const editHistory = current ? [...current.editHistory, editEntry] : [editEntry];
    this.stmtUpdateDefinition.run(
      JSON.stringify(definition),
      JSON.stringify(editHistory),
      id,
    );
  }

  getFailedTestIds(sessionId: string): string[] {
    const rows = this.stmtSelectFailedIds.all(sessionId) as Record<string, unknown>[];
    return rows.map((row) => row.id as string);
  }

  countByPhase(sessionId: string, phase: TestPhase): number {
    const row = this.stmtCountByPhase.get(sessionId, phase) as Record<string, unknown>;
    return (row.count as number) ?? 0;
  }
}
