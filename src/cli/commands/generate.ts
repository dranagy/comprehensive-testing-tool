import type { Command } from "commander";

export function registerGenerateCommand(program: Command): void {
  program
    .command("generate [phase]")
    .description("Generate automated test cases from ingested documents")
    .option("--session <id>", "Session ID", "current")
    .action(async (phase: string | undefined, options) => {
      const { generateCommand } = await import("./generate-impl.js");
      await generateCommand(phase, options);
    });
}
