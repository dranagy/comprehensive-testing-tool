import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../../../src/api/server.js";
import { getDb } from "../../../../src/api/db.js";

beforeEach(() => {
  getDb(":memory:");
});

async function createSession(): Promise<string> {
  const res = await request(app)
    .post("/api/sessions")
    .send({ name: "Run Session", targetUrl: "http://localhost:9999" });
  return res.body.id as string;
}

/** Generate SECURITY tests (always produces 2 cases) and approve them. */
async function seedApprovedTests(sessionId: string): Promise<string[]> {
  await request(app).post(`/api/generate/${sessionId}/SECURITY`);
  const listRes = await request(app).get(`/api/review/${sessionId}/test-cases`);
  const testIds = (listRes.body as Array<{ id: string }>).map((tc) => tc.id);
  await request(app)
    .post(`/api/review/${sessionId}/approve`)
    .send({ phase: "SECURITY" });
  return testIds;
}

describe("POST /api/run/:sessionId/run", () => {
  it("returns dryRun response without executing when dryRun=true", async () => {
    const sessionId = await createSession();
    await seedApprovedTests(sessionId);

    const res = await request(app)
      .post(`/api/run/${sessionId}/run`)
      .send({ phase: "SECURITY", dryRun: true });
    expect(res.status).toBe(200);
    expect(res.body.dryRun).toBe(true);
    expect(typeof res.body.testCount).toBe("number");
    expect(res.body.testCount).toBeGreaterThan(0);
    expect(Array.isArray(res.body.tests)).toBe(true);
    expect(res.body.runId).toBeNull();
  });

  it("lists the correct tests in dryRun response", async () => {
    const sessionId = await createSession();
    await seedApprovedTests(sessionId);

    const res = await request(app)
      .post(`/api/run/${sessionId}/run`)
      .send({ phase: "SECURITY", dryRun: true });
    expect(res.status).toBe(200);
    const tests = res.body.tests as Array<{ id: string; name: string; phase: string }>;
    expect(tests.every((t) => t.phase === "SECURITY")).toBe(true);
  });

  it("returns 400 when there are no approved tests to run", async () => {
    const sessionId = await createSession();
    // No tests approved

    const res = await request(app)
      .post(`/api/run/${sessionId}/run`)
      .send({ phase: "SECURITY", dryRun: true });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("starts an actual run and returns runId immediately when dryRun is false", async () => {
    const sessionId = await createSession();
    await seedApprovedTests(sessionId);

    const res = await request(app)
      .post(`/api/run/${sessionId}/run`)
      .send({ phase: "SECURITY", dryRun: false });
    expect(res.status).toBe(200);
    expect(res.body.runId).toBeDefined();
    expect(res.body.status).toBe("running");
    expect(typeof res.body.testCount).toBe("number");
  });
});

describe("POST /api/run/:sessionId/run/:runId/cancel", () => {
  it("returns 404 for an unknown runId", async () => {
    const sessionId = await createSession();
    const res = await request(app).post(
      `/api/run/${sessionId}/run/nonexistent-run-id/cancel`,
    );
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});

