import type { Command } from "commander";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize a new testing project in the current directory")
    .requiredOption("--target <url>", "Target application URL")
    .option("--name <name>", "Project/session name", process.cwd().split(/[/\\]/).pop() ?? "ctt-project")
    .option("--browsers <list>", "Comma-separated browser list", "chromium")
    .action(async (options) => {
      const { initCommand } = await import("./init-impl.js");
      await initCommand(options);
    });
}
