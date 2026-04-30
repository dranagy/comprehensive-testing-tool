import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { loadConfig, createDefaultConfig, writeConfigFile } from "../../core/config.js";
import { ApiError } from "../middleware/error-handler.js";

export const configRouter = Router();

// Get current config
configRouter.get("/", (_req, res) => {
  try {
    const config = loadConfig();
    res.json(config);
  } catch {
    res.json({ configured: false });
  }
});

// Update config
configRouter.put("/", (req, res) => {
  const configPath = path.join(process.cwd(), "ctt.config.json");
  const config = req.body;

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
  res.json({ updated: true, config });
});

// Reset config to defaults
configRouter.post("/reset", (req, res) => {
  const { target } = req.body as { target?: string };
  if (!target) {
    throw new ApiError(400, "target is required");
  }

  const config = createDefaultConfig(target);
  const configPath = path.join(process.cwd(), "ctt.config.json");
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

  res.json({ reset: true, config });
});
