import type { Command } from "commander";

export function registerSessionCommand(program: Command): void {
  const session = program.command("session").description("Manage testing sessions");

  session
    .command("create")
    .description("Start a new testing session")
    .option("--target <url>", "Target application URL")
    .action(async (options) => {
      const { sessionCreate } = await import("./session-impl.js");
      await sessionCreate(options);
    });

  session
    .command("resume <sessionId>")
    .description("Resume an interrupted session")
    .action(async (sessionId: string) => {
      const { sessionResume } = await import("./session-impl.js");
      await sessionResume(sessionId);
    });

  session
    .command("status")
    .description("Show current session state")
    .action(async () => {
      const { sessionStatus } = await import("./session-impl.js");
      await sessionStatus();
    });

  session
    .command("list")
    .description("List all sessions")
    .action(async () => {
      const { sessionList } = await import("./session-impl.js");
      await sessionList();
    });

  session
    .command("export <sessionId>")
    .description("Export session audit trail")
    .option("--format <format>", "Export format (json, html)", "json")
    .option("--output <path>", "Output file path")
    .action(async (sessionId: string, options) => {
      const { sessionExport } = await import("./session-impl.js");
      await sessionExport(sessionId, options);
    });
}
