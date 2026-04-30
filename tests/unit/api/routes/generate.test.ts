import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { v4 as uuidv4 } from "uuid";
import { app } from "../../../../src/api/server.js";
import { getDb } from "../../../../src/api/db.js";
import { TestCaseRepository } from "../../../../src/db/repositories/test-case-repo.js";
import type { TestCase } from "../../../../src/shared/types.js";

beforeEach(() => {
  getDb(":memory:");
});

async function createSession(): Promise<string> {
  const res = await request(app)
    .post("/api/sessions")
    .send({ name: "Generate Session", targetUrl: "http://localhost:9999" });
  return res.body.id as string;
}

/** Directly insert a minimal FUNCTIONAL test case into the DB for seeding purposes. */
function seedFunctionalTestDirectly(sessionId: string): void {
  const db = getDb();
  const repo = new TestCaseRepository(db);
  const tc: TestCase = {
    id: uuidv4(),
    sessionId,
    sourceDocumentId: null,
    phase: "FUNCTIONAL",
    name: "Seeded Functional Test",
    description: "Direct DB seed",
    definition: {
      steps: [{ action: "navigate", selector: "/", description: "Navigate to root" }],
      assertions: [{ type: "status", expected: "200" }],
    },
    approvalStatus: "GENERATED",
    tags: [],
    editHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  repo.createMany([tc]);
}

describe("POST /api/generate/:sessionId (all phases)", () => {
  it("generates test cases for all phases and returns phase results", async () => {
    const sessionId = await createSession();
    seedFunctionalTestDirectly(sessionId);

    const res = await request(app).post(`/api/generate/${sessionId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.phases)).toBe(true);
    const phases = res.body.phases as Array<{ phase: string; generatedCount: number }>;
    expect(phases.some((p) => p.phase === "SECURITY")).toBe(true);
    expect(phases.some((p) => p.phase === "PERFORMANCE")).toBe(true);
  });
});

describe("POST /api/generate/:sessionId/:phase", () => {
  it("generates FUNCTIONAL tests (returns count of existing functional tests)", async () => {
    const sessionId = await createSession();
    seedFunctionalTestDirectly(sessionId);

    const res = await request(app).post(`/api/generate/${sessionId}/FUNCTIONAL`);
    expect(res.status).toBe(200);
    expect(res.body.phase).toBe("FUNCTIONAL");
    expect(typeof res.body.generatedCount).toBe("number");
    expect(res.body.generatedCount).toBeGreaterThan(0);
  });

  it("generates SECURITY tests and returns 2 scan test cases", async () => {
    const sessionId = await createSession();

    const res = await request(app).post(`/api/generate/${sessionId}/SECURITY`);
    expect(res.status).toBe(200);
    expect(res.body.phase).toBe("SECURITY");
    expect(res.body.generatedCount).toBe(2);
  });

  it("derives PERFORMANCE tests from existing FUNCTIONAL tests", async () => {
    const sessionId = await createSession();
    seedFunctionalTestDirectly(sessionId);

    const res = await request(app).post(`/api/generate/${sessionId}/PERFORMANCE`);
    expect(res.status).toBe(200);
    expect(res.body.phase).toBe("PERFORMANCE");
    expect(res.body.generatedCount).toBeGreaterThan(0);
  });

  it("returns 400 when generating PERFORMANCE without any functional tests", async () => {
    const sessionId = await createSession();

    const res = await request(app).post(`/api/generate/${sessionId}/PERFORMANCE`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/functional/i);
  });

  it("returns 400 for an invalid phase name", async () => {
    const sessionId = await createSession();

    const res = await request(app).post(`/api/generate/${sessionId}/INVALID`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("returns 404 for an unknown session", async () => {
    const res = await request(app).post("/api/generate/nonexistent/FUNCTIONAL");
    expect(res.status).toBe(404);
  });
});

