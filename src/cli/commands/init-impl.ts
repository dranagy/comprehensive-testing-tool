import fs from "node:fs";
import path from "node:path";
import { writeConfigFile, configToSessionConfig } from "../../core/config.js";
import { initializeDatabase } from "../../db/migrations.js";
import { SessionManager } from "../../core/session.js";
import { AuditLogger } from "../../core/audit-log.js";

export async function initCommand(options: {
  target: string;
  name: string;
  browsers: string;
}): Promise<void> {
  try {
    const cttDir = path.join(process.cwd(), ".ctt");

    // Create .ctt/ directory if it does not exist
    if (!fs.existsSync(cttDir)) {
      fs.mkdirSync(cttDir, { recursive: true });
    }

    // Write ctt.config.json
    const configPath = writeConfigFile(options.target, options.name);
    console.log(`Configuration written to: ${configPath}`);

    // Initialize database
    const dbPath = path.join(cttDir, "sessions.db");
    const db = initializeDatabase(dbPath);
    console.log(`Database initialized at: ${dbPath}`);

    // Create a session using the config
    const sessionManager = new SessionManager(db);
    const auditLogger = new AuditLogger(db);

    // Load the written config to derive SessionConfig
    const { loadConfig } = await import("../../core/config.js");
    const cttConfig = loadConfig(configPath);
    const sessionConfig = configToSessionConfig(cttConfig);

    const session = sessionManager.createSession(
      options.name,
      options.target,
      sessionConfig,
    );

    auditLogger.log(session.id, "SESSION_CREATED", "system", {
      name: options.name,
      target: options.target,
    });

    console.log(`\nSession created successfully.`);
    console.log(`  Session ID: ${session.id}`);
    console.log(`  Name:       ${session.name}`);
    console.log(`  Target:     ${session.targetUrl}`);
    console.log(`  Status:     ${session.status}`);
    console.log(`  Config:     ${configPath}`);

    db.close();
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error during initialization: ${message}`);
    process.exit(1);
  }
}
