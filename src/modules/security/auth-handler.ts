import type { AuthContext } from "./types.js";

export class AuthHandler {
  private context: AuthContext | null = null;

  setContext(context: AuthContext): void {
    this.context = context;
  }

  getContext(): AuthContext | null {
    return this.context;
  }

  clearContext(): void {
    this.context = null;
  }

  hasContext(): boolean {
    return this.context !== null;
  }

  getCookieHeader(): string | null {
    if (!this.context) return null;
    return `${this.context.cookieName}=${this.context.sessionToken}`;
  }
}
