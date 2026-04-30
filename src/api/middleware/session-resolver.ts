import type { Request, Response, NextFunction } from "express";
import { SessionManager } from "../../core/session.js";
import { getDb } from "../db.js";
import { ApiError } from "./error-handler.js";
import "../types.js";

export function resolveSession(req: Request, _res: Response, next: NextFunction) {
  const sessionId = req.params.sessionId as string;
  if (!sessionId) {
    throw new ApiError(400, "Missing sessionId parameter");
  }

  const db = getDb();
  const sessionManager = new SessionManager(db);

  try {
    const session = sessionManager.getSession(sessionId);
    req.session = session;
    next();
  } catch {
    throw new ApiError(404, `Session not found: ${sessionId}`);
  }
}
