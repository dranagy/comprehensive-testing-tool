import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app } from "../../../../src/api/server.js";
import { getDb } from "../../../../src/api/db.js";
import { ApprovalGateManager } from "../../../../src/core/approval-gate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MD_FIXTURE = path.resolve(__dirname, "../../../fixtures/test-cases.md");

beforeEach(() => {
  getDb(":memory:");
});

async function createSession(): Promise<string> {
  const res = await request(app)
    .post("/api/sessions")
    .send({ name: "Review Session", targetUrl: "http://localhost:9999" });
  return res.body.id as string;
}

/** Seed test cases by generating SECURITY tests (always produces 2 cases). */
async function seedTests(sessionId: string): Promise<string[]> {
  await request(app).post(`/api/generate/${sessionId}/SECURITY`);
  const listRes = await request(app).get(`/api/review/${sessionId}/test-cases`);
  return (listRes.body as Array<{ id: string }>).map((tc) => tc.id);
}

describe("GET /api/review/:sessionId/test-cases", () => {
  it("returns all test cases for a session", async () => {
    const sessionId = await createSession();
    await seedTests(sessionId);

    const res = await request(app).get(`/api/review/${sessionId}/test-cases`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("filters by phase when ?phase=SECURITY is provided", async () => {
    const sessionId = await createSession();
    await seedTests(sessionId);

    const res = await request(app).get(`/api/review/${sessionId}/test-cases?phase=SECURITY`);
    expect(res.status).toBe(200);
    const phases = (res.body as Array<{ phase: string }>).map((tc) => tc.phase);
    expect(phases.every((p) => p === "SECURITY")).toBe(true);
  });

  it("filters by status when ?status=GENERATED is provided", async () => {
    const sessionId = await createSession();
    await seedTests(sessionId);

    const res = await request(app).get(`/api/review/${sessionId}/test-cases?status=GENERATED`);
    expect(res.status).toBe(200);
    const statuses = (res.body as Array<{ approvalStatus: string }>).map((tc) => tc.approvalStatus);
    expect(statuses.every((s) => s === "GENERATED")).toBe(true);
  });
});

describe("GET /api/review/:sessionId/test-cases/:testId", () => {
  it("returns a single test case by ID", async () => {
    const sessionId = await createSession();
    const testIds = await seedTests(sessionId);

    const res = await request(app).get(`/api/review/${sessionId}/test-cases/${testIds[0]}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(testIds[0]);
  });

  it("returns 404 for a non-existent test ID", async () => {
    const sessionId = await createSession();
    const res = await request(app).get(`/api/review/${sessionId}/test-cases/nonexistent-test`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});

describe("PUT /api/review/:sessionId/test-cases/:testId", () => {
  it("updates the test case definition and records an edit history entry", async () => {
    const sessionId = await createSession();
    const testIds = await seedTests(sessionId);

    const newDefinition = {
      steps: [{ action: "navigate" as const, selector: "/updated", description: "Updated step" }],
      assertions: [{ type: "text" as const, expected: "Updated" }],
    };

    const res = await request(app)
      .put(`/api/review/${sessionId}/test-cases/${testIds[0]}`)
      .send({ definition: newDefinition });
    expect(res.status).toBe(200);
    expect(res.body.definition.steps[0].selector).toBe("/updated");
    expect(Array.isArray(res.body.editHistory)).toBe(true);
    expect(res.body.editHistory.length).toBeGreaterThan(0);
  });

  it("returns 400 when definition is missing in the body", async () => {
    const sessionId = await createSession();
    const testIds = await seedTests(sessionId);

    const res = await request(app)
      .put(`/api/review/${sessionId}/test-cases/${testIds[0]}`)
      .send({});
    expect(res.status).toBe(400);
  });
});

describe("POST /api/review/:sessionId/approve", () => {
  it("approves all tests of a given phase", async () => {
    const sessionId = await createSession();
    await seedTests(sessionId);

    const res = await request(app)
      .post(`/api/review/${sessionId}/approve`)
      .send({ phase: "SECURITY" });
    expect(res.status).toBe(200);
    expect(res.body.approved).toBeGreaterThan(0);
  });

  it("approves specific tests by testIds array", async () => {
    const sessionId = await createSession();
    const testIds = await seedTests(sessionId);

    const res = await request(app)
      .post(`/api/review/${sessionId}/approve`)
      .send({ testIds: [testIds[0]] });
    expect(res.status).toBe(200);
    expect(res.body.approved).toBe(1);
  });
});

describe("POST /api/review/:sessionId/test-cases/:testId/reject", () => {
  it("rejects a test case with an optional reason", async () => {
    const sessionId = await createSession();
    const testIds = await seedTests(sessionId);

    const res = await request(app)
      .post(`/api/review/${sessionId}/test-cases/${testIds[0]}/reject`)
      .send({ reason: "Not needed" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("REJECTED");
  });

  it("returns 404 when test case does not exist", async () => {
    const sessionId = await createSession();
    const res = await request(app)
      .post(`/api/review/${sessionId}/test-cases/nonexistent/reject`)
      .send({ reason: "n/a" });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/review/:sessionId/gates", () => {
  it("returns the list of approval gates for the session", async () => {
    const sessionId = await createSession();
    const res = await request(app).get(`/api/review/${sessionId}/gates`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("POST /api/review/:sessionId/gates/:phase", () => {
  it("approves a gate and returns the updated gate object", async () => {
    const sessionId = await createSession();
    // Create a PENDING gate directly so the resolve endpoint has something to work with
    const db = getDb();
    const gateManager = new ApprovalGateManager(db);
    gateManager.createGate(sessionId, "SECURITY");

    const res = await request(app)
      .post(`/api/review/${sessionId}/gates/SECURITY`)
      .send({ action: "approve", comments: "LGTM" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("APPROVED");
    expect(res.body.phase).toBe("SECURITY");
  });

  it("returns 400 for an invalid gate action", async () => {
    const sessionId = await createSession();
    const db = getDb();
    const gateManager = new ApprovalGateManager(db);
    gateManager.createGate(sessionId, "FUNCTIONAL");

    const res = await request(app)
      .post(`/api/review/${sessionId}/gates/FUNCTIONAL`)
      .send({ action: "invalidAction" });
    expect(res.status).toBe(400);
  });
});

