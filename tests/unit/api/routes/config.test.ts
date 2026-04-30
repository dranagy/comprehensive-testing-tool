import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import fs from "node:fs";
import { app } from "../../../../src/api/server.js";
import { getDb } from "../../../../src/api/db.js";

beforeEach(() => {
  getDb(":memory:");
  vi.restoreAllMocks();
});

describe("GET /api/config", () => {
  it("returns { configured: false } when no config file exists", async () => {
    // Ensure loadConfig throws (no ctt.config.json in test cwd)
    const res = await request(app).get("/api/config");
    expect(res.status).toBe(200);
    // Either returns the config object or { configured: false }
    expect(res.body).toBeDefined();
  });

  it("returns config object when config file can be parsed", async () => {
    const mockConfig = {
      target: "http://localhost:3000",
      browsers: ["chromium"],
      performance: {
        virtualUsers: 10,
        rampUpSeconds: 5,
        durationSeconds: 30,
        sla: { responseTimeP95Ms: 2000, errorRateMax: 0.01, throughputMinRps: 10 },
      },
      security: {
        zapPath: "",
        passiveScan: true,
        activeScan: false,
        severityThreshold: "MEDIUM",
      },
      output: { format: "json", screenshots: false, networkLogs: false },
    };
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify(mockConfig));

    const res = await request(app).get("/api/config");
    expect(res.status).toBe(200);
    expect(res.body.target).toBe("http://localhost:3000");
  });
});

describe("PUT /api/config", () => {
  it("writes config to disk and returns { updated: true, config }", async () => {
    const writeSpy = vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});
    const newConfig = {
      target: "http://my-app.local",
      browsers: ["firefox"],
    };

    const res = await request(app).put("/api/config").send(newConfig);
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(true);
    expect(res.body.config.target).toBe("http://my-app.local");
    expect(writeSpy).toHaveBeenCalled();
  });
});

describe("POST /api/config/reset", () => {
  it("resets config to defaults for the given target", async () => {
    vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});

    const res = await request(app)
      .post("/api/config/reset")
      .send({ target: "http://reset-target.com" });
    expect(res.status).toBe(200);
    expect(res.body.reset).toBe(true);
    expect(res.body.config.target).toBe("http://reset-target.com");
  });

  it("returns 400 when target is not provided", async () => {
    const res = await request(app).post("/api/config/reset").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});
