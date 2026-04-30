import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app } from "../../../../src/api/server.js";
import { getDb } from "../../../../src/api/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MD_FIXTURE = path.resolve(__dirname, "../../../fixtures/test-cases.md");

beforeEach(() => {
  getDb(":memory:");
});

async function createSession(): Promise<string> {
  const res = await request(app)
    .post("/api/sessions")
    .send({ name: "Reports Session", targetUrl: "http://localhost:9999" });
  return res.body.id as string;
}

describe("GET /api/reports/:sessionId/summary", () => {
  it("returns aggregated data with testCases and execution fields", async () => {
    const sessionId = await createSession();
    const res = await request(app).get(`/api/reports/${sessionId}/summary`);
    expect(res.status).toBe(200);
    expect(res.body.session).toBeDefined();
    expect(res.body.testCases).toBeDefined();
    expect(res.body.execution).toBeDefined();
    expect(typeof res.body.passRate).toBe("string");
  });

  it("returns 404 for an unknown session", async () => {
    const res = await request(app).get("/api/reports/nonexistent/summary");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/reports/:sessionId/functional", () => {
  it("returns functional test results with totals", async () => {
    const sessionId = await createSession();
    // Seed some tests first
    await request(app)
      .post(`/api/ingest/${sessionId}/upload`)
      .attach("files", MD_FIXTURE);

    const res = await request(app).get(`/api/reports/${sessionId}/functional`);
    expect(res.status).toBe(200);
    expect(typeof res.body.total).toBe("number");
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.summary).toBeDefined();
  });

  it("filters results by ?status=NOT_RUN", async () => {
    const sessionId = await createSession();
    await request(app)
      .post(`/api/ingest/${sessionId}/upload`)
      .attach("files", MD_FIXTURE);

    const res = await request(app).get(
      `/api/reports/${sessionId}/functional?status=NOT_RUN`,
    );
    expect(res.status).toBe(200);
    const results = res.body.results as Array<{ status: string }>;
    expect(results.every((r) => r.status === "NOT_RUN")).toBe(true);
  });
});

describe("GET /api/reports/:sessionId/performance", () => {
  it("returns performance metrics object", async () => {
    const sessionId = await createSession();
    const res = await request(app).get(`/api/reports/${sessionId}/performance`);
    expect(res.status).toBe(200);
    expect(typeof res.body.totalResults).toBe("number");
    expect(Array.isArray(res.body.metrics)).toBe(true);
  });
});

describe("GET /api/reports/:sessionId/security", () => {
  it("returns security findings with bySeverity breakdown", async () => {
    const sessionId = await createSession();
    const res = await request(app).get(`/api/reports/${sessionId}/security`);
    expect(res.status).toBe(200);
    expect(typeof res.body.totalFindings).toBe("number");
    expect(res.body.bySeverity).toBeDefined();
    expect(Array.isArray(res.body.findings)).toBe(true);
  });

  it("filters findings by ?severity=HIGH", async () => {
    const sessionId = await createSession();
    const res = await request(app).get(
      `/api/reports/${sessionId}/security?severity=HIGH`,
    );
    expect(res.status).toBe(200);
    const findings = res.body.findings as Array<{ severity: string }>;
    expect(findings.every((f) => f.severity === "HIGH")).toBe(true);
  });
});

describe("GET /api/reports/:sessionId/audit", () => {
  it("returns audit trail entries", async () => {
    const sessionId = await createSession();
    const res = await request(app).get(`/api/reports/${sessionId}/audit`);
    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBe(sessionId);
    expect(typeof res.body.totalEntries).toBe("number");
    expect(Array.isArray(res.body.entries)).toBe(true);
    // Session creation always logs at least one audit entry
    expect(res.body.totalEntries).toBeGreaterThan(0);
  });

  it("filters by ?action=SESSION_CREATED", async () => {
    const sessionId = await createSession();
    const res = await request(app).get(
      `/api/reports/${sessionId}/audit?action=SESSION_CREATED`,
    );
    expect(res.status).toBe(200);
    const entries = res.body.entries as Array<{ action: string }>;
    expect(entries.every((e) => e.action === "SESSION_CREATED")).toBe(true);
    expect(entries.length).toBeGreaterThan(0);
  });
});
