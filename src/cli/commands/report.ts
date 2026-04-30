import type { Command } from "commander";

export function registerReportCommand(program: Command): void {
  program
    .command("report [type]")
    .description("Generate and export reports")
    .option("--output <path>", "Output file path")
    .option("--format <format>", "Report format (terminal, json, junit, html)", "terminal")
    .action(async (type: string | undefined, options) => {
      const { reportCommand } = await import("./report-impl.js");
      await reportCommand(type, options);
    });
}
