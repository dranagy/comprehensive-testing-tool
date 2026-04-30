/**
 * Full-workflow integration test.
 *
 * Exercises the complete CTT workflow end-to-end through the Express API:
 * create session → upload documents (ingest) → generate SECURITY tests →
 * list test cases → approve → dry-run → summary report → audit trail → export.
 */

import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app } from "../../src/api/server.js";
import { getDb } from "../../src/api/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MD_FIXTURE = path.resolve(__dirname, "../fixtures/test-cases.md");

let sessionId: string;

describe("Complete Testing Workflow", () => {
  beforeAll(() => {
    // Use a fresh in-memory DB for the entire suite
    getDb(":memory:");
  });

  it("Step 1 — creates a session in INGESTION status", async () => {
    const res = await request(app)
      .post("/api/sessions")
      .send({ name: "E2E Test", targetUrl: "http://localhost:9999" });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe("INGESTION");
    sessionId = res.body.id as string;
  });

  it("Step 2 — uploads a markdown document via ingest", async () => {
    const res = await request(app)
      .post(`/api/ingest/${sessionId}/upload`)
      .attach("files", MD_FIXTURE);
    expect(res.status).toBe(200);
    expect(res.body.documentsProcessed).toBe(1);
  });

  it("Step 3 — generates SECURITY test cases", async () => {
    const res = await request(app).post(`/api/generate/${sessionId}/SECURITY`);
    expect(res.status).toBe(200);
    expect(res.body.generatedCount).toBe(2);
  });

  it("Step 4 — lists generated test cases with GENERATED status", async () => {
    const res = await request(app).get(
      `/api/review/${sessionId}/test-cases?status=GENERATED`,
    );
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    const statuses = (res.body as Array<{ approvalStatus: string }>).map(
      (tc) => tc.approvalStatus,
    );
    expect(statuses.every((s) => s === "GENERATED")).toBe(true);
  });

  it("Step 5 — approves SECURITY tests", async () => {
    const res = await request(app)
      .post(`/api/review/${sessionId}/approve`)
      .send({ phase: "SECURITY" });
    expect(res.status).toBe(200);
    expect(res.body.approved).toBeGreaterThan(0);
  });

  it("Step 6 — approved tests show APPROVED status", async () => {
    const res = await request(app).get(
      `/api/review/${sessionId}/test-cases?phase=SECURITY`,
    );
    expect(res.status).toBe(200);
    const statuses = (res.body as Array<{ approvalStatus: string }>).map(
      (tc) => tc.approvalStatus,
    );
    expect(statuses.includes("APPROVED")).toBe(true);
  });

  it("Step 7 — dry run returns list of approved tests without executing", async () => {
    const res = await request(app)
      .post(`/api/run/${sessionId}/run`)
      .send({ phase: "SECURITY", dryRun: true });
    expect(res.status).toBe(200);
    expect(res.body.dryRun).toBe(true);
    expect(res.body.testCount).toBeGreaterThan(0);
    expect(res.body.runId).toBeNull();
  });

  it("Step 8 — summary report returns testCases and execution data", async () => {
    const res = await request(app).get(`/api/reports/${sessionId}/summary`);
    expect(res.status).toBe(200);
    expect(res.body.testCases).toBeDefined();
    expect(res.body.execution).toBeDefined();
    expect(res.body.testCases.security).toBeGreaterThan(0);
  });

  it("Step 9 — audit trail has entries for session creation and test generation", async () => {
    const res = await request(app).get(`/api/reports/${sessionId}/audit`);
    expect(res.status).toBe(200);
    expect(res.body.entries.length).toBeGreaterThan(0);

    const actions = (res.body.entries as Array<{ action: string }>).map(
      (e) => e.action,
    );
    expect(actions).toContain("SESSION_CREATED");
    expect(actions).toContain("TESTS_GENERATED");
  });

  it("Step 10 — exports full session data", async () => {
    const res = await request(app).get(`/api/sessions/${sessionId}/export`);
    expect(res.status).toBe(200);
    expect(res.body.session.id).toBe(sessionId);
    expect(Array.isArray(res.body.testCases)).toBe(true);
    expect(res.body.testCases.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.auditTrail)).toBe(true);
  });
});

