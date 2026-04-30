import fs from "node:fs";
import path from "node:path";
import { ConfigError } from "../shared/errors.js";
import type { BrowserType, OutputFormat, SessionConfig, Severity } from "../shared/types.js";

export interface CttConfig {
  target: string;
  browsers: BrowserType[];
  performance: {
    virtualUsers: number;
    rampUpSeconds: number;
    durationSeconds: number;
    sla: {
      responseTimeP95Ms: number;
      errorRateMax: number;
      throughputMinRps: number;
    };
  };
  security: {
    zapPath: string;
    passiveScan: boolean;
    activeScan: boolean;
    severityThreshold: Severity;
  };
  output: {
    format: OutputFormat;
    screenshots: boolean;
    networkLogs: boolean;
  };
}

const VALID_BROWSERS: BrowserType[] = ["chromium", "firefox", "webkit"];
const VALID_FORMATS: OutputFormat[] = ["json", "terminal", "junit"];
const VALID_THRESHOLDS: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFORMATIONAL"];

export function loadConfig(configPath?: string): CttConfig {
  const resolvedPath = configPath ?? findConfigFile();
  if (!resolvedPath) {
    throw new ConfigError(
      "No configuration file found",
      "CONFIG_NOT_FOUND",
      "Create a ctt.config.json in the project directory or specify --config <path>",
    );
  }

  if (!fs.existsSync(resolvedPath)) {
    throw new ConfigError(
      `Configuration file not found: ${resolvedPath}`,
      "CONFIG_FILE_MISSING",
      "Verify the path to your configuration file is correct",
    );
  }

  const raw = fs.readFileSync(resolvedPath, "utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ConfigError(
      `Invalid JSON in configuration file: ${resolvedPath}`,
      "CONFIG_PARSE_ERROR",
      "Fix the JSON syntax in your configuration file",
    );
  }

  return validateConfig(parsed as Partial<CttConfig>);
}

function findConfigFile(): string | null {
  const candidates = ["ctt.config.json", "ctt.config.ts"];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function validateConfig(raw: Partial<CttConfig>): CttConfig {
  if (!raw.target || typeof raw.target !== "string") {
    throw new ConfigError(
      "Missing or invalid 'target' in configuration",
      "CONFIG_INVALID_TARGET",
      "Provide a valid target URL, e.g. \"target\": \"http://localhost:3000\"",
    );
  }

  const browsers = raw.browsers ?? ["chromium"];
  for (const b of browsers) {
    if (!VALID_BROWSERS.includes(b)) {
      throw new ConfigError(
        `Invalid browser: ${b}`,
        "CONFIG_INVALID_BROWSER",
        `Use one of: ${VALID_BROWSERS.join(", ")}`,
      );
    }
  }

  const outputFormat = raw.output?.format ?? "terminal";
  if (!VALID_FORMATS.includes(outputFormat)) {
    throw new ConfigError(
      `Invalid output format: ${outputFormat}`,
      "CONFIG_INVALID_FORMAT",
      `Use one of: ${VALID_FORMATS.join(", ")}`,
    );
  }

  const threshold = raw.security?.severityThreshold ?? "MEDIUM";
  if (!VALID_THRESHOLDS.includes(threshold)) {
    throw new ConfigError(
      `Invalid severity threshold: ${threshold}`,
      "CONFIG_INVALID_THRESHOLD",
      `Use one of: ${VALID_THRESHOLDS.join(", ")}`,
    );
  }

  return {
    target: raw.target,
    browsers,
    performance: {
      virtualUsers: raw.performance?.virtualUsers ?? 50,
      rampUpSeconds: raw.performance?.rampUpSeconds ?? 30,
      durationSeconds: raw.performance?.durationSeconds ?? 60,
      sla: raw.performance?.sla ?? {
        responseTimeP95Ms: 2000,
        errorRateMax: 0.01,
        throughputMinRps: 100,
      },
    },
    security: {
      zapPath: raw.security?.zapPath ?? "",
      passiveScan: raw.security?.passiveScan ?? true,
      activeScan: raw.security?.activeScan ?? true,
      severityThreshold: threshold,
    },
    output: {
      format: outputFormat,
      screenshots: raw.output?.screenshots ?? true,
      networkLogs: raw.output?.networkLogs ?? true,
    },
  };
}

export function configToSessionConfig(cttConfig: CttConfig): SessionConfig {
  return {
    browsers: cttConfig.browsers,
    performance: cttConfig.performance,
    security: cttConfig.security,
    output: cttConfig.output,
  };
}

export function createDefaultConfig(target: string): CttConfig {
  return {
    target,
    browsers: ["chromium"],
    performance: {
      virtualUsers: 50,
      rampUpSeconds: 30,
      durationSeconds: 60,
      sla: { responseTimeP95Ms: 2000, errorRateMax: 0.01, throughputMinRps: 100 },
    },
    security: {
      zapPath: "",
      passiveScan: true,
      activeScan: true,
      severityThreshold: "MEDIUM",
    },
    output: { format: "terminal", screenshots: true, networkLogs: true },
  };
}

export function writeConfigFile(target: string, name: string): string {
  const config = createDefaultConfig(target);
  config.target = target;
  const configPath = path.join(process.cwd(), "ctt.config.json");
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  return configPath;
}
