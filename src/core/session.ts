import BetterSqlite3 from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import { SessionRepository } from "../db/repositories/session-repo.js";
import { AuditLogRepository } from "../db/repositories/audit-log-repo.js";
import { SessionError } from "../shared/errors.js";
import type { Phase, Session, SessionConfig, AuditAction } from "../shared/types.js";

const PHASE_SEQUENCE: Phase[] = [
  "INGESTION",
  "GENERATION",
  "FUNCTIONAL",
  "PERFORMANCE",
  "SECURITY",
  "COMPLETE",
];

function phaseIndex(phase: Phase): number {
  const idx = PHASE_SEQUENCE.indexOf(phase);
  if (idx === -1) {
    throw new SessionError(
      `Unknown phase: ${phase}`,
      "INVALID_PHASE",
      "Check the session status value",
    );
  }
  return idx;
}

export class SessionManager {
  private repo: SessionRepository;
  private auditRepo: AuditLogRepository;

  constructor(db: BetterSqlite3.Database) {
    this.repo = new SessionRepository(db);
    this.auditRepo = new AuditLogRepository(db);
  }

  createSession(name: string, targetUrl: string, config: SessionConfig): Session {
    const now = new Date().toISOString();
    const session: Session = {
      id: uuidv4(),
      name,
      status: "INGESTION",
      targetUrl,
      config,
      createdAt: now,
      updatedAt: now,
      resumedFrom: null,
    };

    this.repo.create(session);

    this.auditRepo.insert({
      id: uuidv4(),
      sessionId: session.id,
      action: "SESSION_CREATED" as AuditAction,
      actor: "system",
      details: { name, targetUrl, initialPhase: "INGESTION" },
      timestamp: now,
    });

    return session;
  }

  getSession(id: string): Session {
    const session = this.repo.getById(id);
    if (!session) {
      throw new SessionError(
        `Session not found: ${id}`,
        "SESSION_NOT_FOUND",
        "Provide a valid session ID",
        id,
      );
    }
    return session;
  }

  advancePhase(id: string): Session {
    const session = this.getSession(id);

    if (session.status === "COMPLETE") {
      throw new SessionError(
        `Session ${id} is already COMPLETE`,
        "SESSION_ALREADY_COMPLETE",
        "No further phase transitions are possible",
        id,
      );
    }

    const currentIdx = phaseIndex(session.status);
    const nextIdx = currentIdx + 1;

    if (nextIdx >= PHASE_SEQUENCE.length) {
      throw new SessionError(
        `Cannot advance session ${id} beyond COMPLETE`,
        "NO_NEXT_PHASE",
        "The session has reached the final phase",
        id,
      );
    }

    const nextPhase = PHASE_SEQUENCE[nextIdx];

    this.repo.updateStatus(id, nextPhase);

    const action: AuditAction =
      nextPhase === "COMPLETE" ? "SESSION_COMPLETED" : "PHASE_COMPLETED";

    this.auditRepo.insert({
      id: uuidv4(),
      sessionId: id,
      action,
      actor: "system",
      details: { from: session.status, to: nextPhase },
      timestamp: new Date().toISOString(),
    });

    return this.getSession(id);
  }

  canAdvance(id: string): boolean {
    const session = this.getSession(id);
    return session.status !== "COMPLETE";
  }

  resumeSession(id: string): Session {
    const session = this.getSession(id);

    if (session.status === "COMPLETE") {
      throw new SessionError(
        `Cannot resume completed session: ${id}`,
        "SESSION_COMPLETE",
        "Start a new session instead",
        id,
      );
    }

    this.auditRepo.insert({
      id: uuidv4(),
      sessionId: id,
      action: "SESSION_RESUMED" as AuditAction,
      actor: "system",
      details: { resumedAtPhase: session.status },
      timestamp: new Date().toISOString(),
    });

    return session;
  }

  listSessions(): Session[] {
    return this.repo.list();
  }
}
