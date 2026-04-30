import BetterSqlite3 from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import { SessionManager } from "./session.js";
import { ApprovalGateManager } from "./approval-gate.js";
import { AuditLogger } from "./audit-log.js";
import { ModuleRegistry } from "../modules/module-registry.js";
import { SessionError } from "../shared/errors.js";
import type {
  Phase,
  TestPhase,
  Session,
  SessionConfig,
  AuditAction,
} from "../shared/types.js";

const PHASE_TO_TEST_PHASE: Record<string, TestPhase> = {
  FUNCTIONAL: "FUNCTIONAL",
  PERFORMANCE: "PERFORMANCE",
  SECURITY: "SECURITY",
};

const EXECUTABLE_PHASES: Phase[] = ["FUNCTIONAL", "PERFORMANCE", "SECURITY"];

export class TestRunner {
  private sessionManager: SessionManager;
  private approvalGateManager: ApprovalGateManager;
  private auditLogger: AuditLogger;
  private moduleRegistry: ModuleRegistry;

  constructor(db: BetterSqlite3.Database) {
    this.sessionManager = new SessionManager(db);
    this.approvalGateManager = new ApprovalGateManager(db);
    this.auditLogger = new AuditLogger(db);
    this.moduleRegistry = new ModuleRegistry();
  }

  get registry(): ModuleRegistry {
    return this.moduleRegistry;
  }

  async startSession(
    name: string,
    targetUrl: string,
    config: SessionConfig,
  ): Promise<Session> {
    const session = this.sessionManager.createSession(name, targetUrl, config);

    this.auditLogger.log(session.id, "SESSION_CREATED", "system", {
      name,
      targetUrl,
    });

    return session;
  }

  async runPhase(sessionId: string): Promise<Session> {
    const session = this.sessionManager.getSession(sessionId);

    if (session.status === "COMPLETE") {
      throw new SessionError(
        `Session ${sessionId} is already COMPLETE; no phases to run`,
        "SESSION_ALREADY_COMPLETE",
        "Start a new session to run additional tests",
        sessionId,
      );
    }

    if (!EXECUTABLE_PHASES.includes(session.status)) {
      throw new SessionError(
        `Session ${sessionId} is in phase ${session.status}, which has no registered test module`,
        "NO_MODULE_FOR_PHASE",
        "Advance the session to FUNCTIONAL, PERFORMANCE, or SECURITY first",
        sessionId,
      );
    }

    const testPhase = PHASE_TO_TEST_PHASE[session.status];
    if (!testPhase) {
      throw new SessionError(
        `Cannot map phase ${session.status} to a test phase`,
        "INVALID_PHASE_MAPPING",
        "Check the session phase value",
        sessionId,
      );
    }

    if (!this.approvalGateManager.isPhaseApproved(sessionId, testPhase)) {
      throw new SessionError(
        `Phase ${testPhase} is not approved for session ${sessionId}`,
        "PHASE_NOT_APPROVED",
        "Request and obtain approval before running this phase",
        sessionId,
      );
    }

    const module = this.moduleRegistry.getByPhase(testPhase);
    if (!module) {
      throw new SessionError(
        `No module registered for phase: ${testPhase}`,
        "MODULE_NOT_REGISTERED",
        `Register a module for the ${testPhase} phase before running`,
        sessionId,
      );
    }

    this.auditLogger.log(sessionId, "PHASE_STARTED" as AuditAction, "system", {
      phase: testPhase,
      moduleId: module.id,
    });

    await module.execute();

    this.auditLogger.log(sessionId, "PHASE_COMPLETED" as AuditAction, "system", {
      phase: testPhase,
      moduleId: module.id,
    });

    const updated = this.sessionManager.advancePhase(sessionId);

    return updated;
  }

  async requestApproval(sessionId: string): Promise<void> {
    const session = this.sessionManager.getSession(sessionId);

    if (session.status === "COMPLETE") {
      throw new SessionError(
        `Session ${sessionId} is already COMPLETE; cannot request approval`,
        "SESSION_ALREADY_COMPLETE",
        "Start a new session instead",
        sessionId,
      );
    }

    const testPhase = PHASE_TO_TEST_PHASE[session.status];
    if (!testPhase) {
      throw new SessionError(
        `Current phase ${session.status} does not require approval`,
        "PHASE_NOT_APPROVAL_GATE",
        "Approval gates apply to FUNCTIONAL, PERFORMANCE, and SECURITY phases",
        sessionId,
      );
    }

    this.approvalGateManager.createGate(sessionId, testPhase);

    this.auditLogger.log(
      sessionId,
      "PHASE_STARTED" as AuditAction,
      "system",
      { phase: testPhase, approvalRequested: true },
    );
  }

  async resumeAndContinue(sessionId: string): Promise<Session> {
    const session = this.sessionManager.resumeSession(sessionId);

    const testPhase = PHASE_TO_TEST_PHASE[session.status];
    if (!testPhase) {
      return session;
    }

    if (this.approvalGateManager.isPhaseApproved(sessionId, testPhase)) {
      return this.runPhase(sessionId);
    }

    return session;
  }
}
