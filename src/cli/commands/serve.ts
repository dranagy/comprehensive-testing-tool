import type { Command } from "commander";

export function registerServeCommand(program: Command): void {
  program
    .command("serve")
    .description("Start the CTT API server")
    .option("-p, --port <number>", "port to listen on", "3456")
    .option("-H, --host <string>", "host to bind to", "localhost")
    .action(async (options) => {
      const { serveCommand } = await import("./serve-impl.js");
      await serveCommand(options);
    });
}
