#!/usr/bin/env node
import { Command } from "commander";
import { registerInitCommand } from "./commands/init.js";
import { registerSessionCommand } from "./commands/session.js";
import { registerIngestCommand } from "./commands/ingest.js";
import { registerGenerateCommand } from "./commands/generate.js";
import { registerReviewCommand } from "./commands/review.js";
import { registerRunCommand } from "./commands/run.js";
import { registerReportCommand } from "./commands/report.js";
import { registerServeCommand } from "./commands/serve.js";

const program = new Command();

program
  .name("ctt")
  .description("Comprehensive Testing Tool — unified functional, performance, and security testing")
  .version("0.1.0")
  .option("--format <format>", "output format: json, terminal, junit", "terminal")
  .option("--config <path>", "path to configuration file")
  .option("--verbose", "enable verbose logging", false);

registerInitCommand(program);
registerSessionCommand(program);
registerIngestCommand(program);
registerGenerateCommand(program);
registerReviewCommand(program);
registerRunCommand(program);
registerReportCommand(program);
registerServeCommand(program);

program.parse(process.argv);
