import type { Logger } from "./types.js";

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export function createLogger(minLevel: LogLevel = "info"): Logger {
  const minLevelNum = LOG_LEVELS[minLevel];

  function formatMessage(level: LogLevel, message: string, args: unknown[]): string {
    const timestamp = new Date().toISOString();
    const argStr = args.length > 0 ? " " + args.map((a) => JSON.stringify(a)).join(" ") : "";
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${argStr}`;
  }

  return {
    debug(message: string, ...args: unknown[]): void {
      if (minLevelNum <= LOG_LEVELS.debug) {
        process.stderr.write(formatMessage("debug", message, args) + "\n");
      }
    },
    info(message: string, ...args: unknown[]): void {
      if (minLevelNum <= LOG_LEVELS.info) {
        process.stdout.write(formatMessage("info", message, args) + "\n");
      }
    },
    warn(message: string, ...args: unknown[]): void {
      if (minLevelNum <= LOG_LEVELS.warn) {
        process.stderr.write(formatMessage("warn", message, args) + "\n");
      }
    },
    error(message: string, ...args: unknown[]): void {
      if (minLevelNum <= LOG_LEVELS.error) {
        process.stderr.write(formatMessage("error", message, args) + "\n");
      }
    },
  };
}
