import type { Session } from "../shared/types.js";

declare global {
  namespace Express {
    interface Request {
      session?: Session;
    }
  }
}
