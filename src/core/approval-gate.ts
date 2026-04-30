import BetterSqlite3 from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import { ApprovalGateRepository } from "../db/repositories/approval-gate-repo.js";
import { AuditLogRepository } from "../db/repositories/audit-log-repo.js";
import { SessionRepository } from "../db/repositories/session-repo.js";
import { SessionError } from "../shared/errors.js";
import type {
  ApprovalGate,
  TestPhase,
  GateStatus,
  AuditAction,
} from "../shared/types.js";

export class ApprovalGateManager {
  private gateRepo: ApprovalGateRepository;
  private auditRepo: AuditLogRepository;
  private sessionRepo: SessionRepository;

  constructor(db: BetterSqlite3.Database) {
    this.gateRepo = new ApprovalGateRepository(db);
    this.auditRepo = new AuditLogRepository(db);
    this.sessionRepo = new SessionRepository(db);
  }

  createGate(sessionId: string, phase: TestPhase): ApprovalGate {
    const session = this.sessionRepo.getById(sessionId);
    if (!session) {
      throw new SessionError(
        `Session not found: ${sessionId}`,
        "SESSION_NOT_FOUND",
        "Provide a valid session ID",
        sessionId,
      );
    }

    const existing = this.gateRepo.getByPhase(sessionId, phase);
    if (existing) {
      throw new SessionError(
        `Gate already exists for session ${sessionId} phase ${phase}`,
        "GATE_ALREADY_EXISTS",
        "Resolve the existing gate before creating a new one for this phase",
        sessionId,
      );
    }

    const gate: ApprovalGate = {
      id: uuidv4(),
      sessionId,
      phase,
      status: "PENDING",
      resolvedBy: null,
      resolvedAt: null,
      comments: null,
      createdAt: new Date().toISOString(),
    };

    this.gateRepo.create(gate);

    this.auditRepo.insert({
      id: uuidv4(),
      sessionId,
      action: "PHASE_STARTED" as AuditAction,
      actor: "system",
      details: { phase, gateId: gate.id, gateStatus: "PENDING" },
      timestamp: gate.createdAt,
    });

    return gate;
  }

  approve(sessionId: string, phase: TestPhase, resolvedBy: string, comments?: string): ApprovalGate {
    return this.resolveGate(sessionId, phase, "APPROVED", resolvedBy, comments);
  }

  reject(sessionId: string, phase: TestPhase, resolvedBy: string, comments?: string): ApprovalGate {
    return this.resolveGate(sessionId, phase, "REJECTED", resolvedBy, comments);
  }

  skip(sessionId: string, phase: TestPhase, resolvedBy: string, comments?: string): ApprovalGate {
    return this.resolveGate(sessionId, phase, "SKIPPED", resolvedBy, comments);
  }

  isPhaseApproved(sessionId: string, phase: TestPhase): boolean {
    const gate = this.gateRepo.getByPhase(sessionId, phase);
    return gate?.status === "APPROVED";
  }

  getPendingGates(sessionId: string): ApprovalGate[] {
    return this.gateRepo.getPending(sessionId);
  }

  private resolveGate(
    sessionId: string,
    phase: TestPhase,
    status: GateStatus,
    resolvedBy: string,
    comments?: string,
  ): ApprovalGate {
    const gate = this.gateRepo.getByPhase(sessionId, phase);
    if (!gate) {
      throw new SessionError(
        `No gate found for session ${sessionId} phase ${phase}`,
        "GATE_NOT_FOUND",
        "Create a gate for this phase before resolving it",
        sessionId,
      );
    }

    if (gate.status !== "PENDING") {
      throw new SessionError(
        `Gate ${gate.id} is already resolved with status: ${gate.status}`,
        "GATE_ALREADY_RESOLVED",
        "Cannot change the resolution of an already-resolved gate",
        sessionId,
      );
    }

    const now = new Date().toISOString();

    this.gateRepo.resolve(gate.id, status, resolvedBy, comments ?? null);

    const actionMap: Record<GateStatus, AuditAction> = {
      APPROVED: "GATE_APPROVED",
      REJECTED: "GATE_REJECTED",
      SKIPPED: "GATE_SKIPPED",
      PENDING: "GATE_APPROVED", // unreachable but satisfies type checker
    };

    this.auditRepo.insert({
      id: uuidv4(),
      sessionId,
      action: actionMap[status],
      actor: resolvedBy,
      details: { phase, gateId: gate.id, status, comments: comments ?? null },
      timestamp: now,
    });

    const updated = this.gateRepo.getByPhase(sessionId, phase);
    return updated!;
  }
}
