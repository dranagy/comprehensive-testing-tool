import type { Command } from "commander";

export function registerIngestCommand(program: Command): void {
  program
    .command("ingest <files...>")
    .description("Upload and process context documents for test generation")
    .option("--session <id>", "Session ID", "current")
    .action(async (files: string[], options) => {
      const { ingestCommand } = await import("./ingest-impl.js");
      await ingestCommand(files, options);
    });
}
