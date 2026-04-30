export class ModuleError extends Error {
  constructor(
    message: string,
    public readonly module: string,
    public readonly code: string,
    public readonly actionable: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ModuleError";
  }
}

export class ConfigError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly actionable: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ConfigError";
  }
}

export class SessionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly actionable: string,
    public readonly sessionId?: string,
  ) {
    super(message);
    this.name = "SessionError";
  }
}

export class ExecutionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly actionable: string,
    public readonly testCaseId?: string,
  ) {
    super(message);
    this.name = "ExecutionError";
  }
}

export class IngestionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly actionable: string,
    public readonly filename?: string,
  ) {
    super(message);
    this.name = "IngestionError";
  }
}
