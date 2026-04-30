import type { Command } from "commander";

export function registerRunCommand(program: Command): void {
  program
    .command("run [testIds...]")
    .description("Execute approved test cases")
    .option("--phase <phase>", "Run all tests in a specific phase")
    .option("--filter <tag>", "Run tests matching tag")
    .option("--failed", "Re-run previously failed tests")
    .option("--parallel <n>", "Number of parallel workers", "1")
    .option("--timeout <ms>", "Test timeout in ms", "30000")
    .option("--dry-run", "Show what would run without executing")
    .action(async (testIds: string[], options) => {
      const { runCommand } = await import("./run-impl.js");
      await runCommand(testIds, options);
    });
}
