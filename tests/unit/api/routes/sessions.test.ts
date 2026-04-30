import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../../../src/api/server.js";
import { getDb } from "../../../../src/api/db.js";

// Reset to a fresh in-memory DB before each test to ensure isolation
beforeEach(() => {
  getDb(":memory:");
});

describe("GET /api/sessions", () => {
  it("returns an empty array when there are no sessions", async () => {
    const res = await request(app).get("/api/sessions");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });
});

describe("POST /api/sessions", () => {
  it("creates a session with required targetUrl", async () => {
    const res = await request(app)
      .post("/api/sessions")
      .send({ name: "My Session", targetUrl: "http://localhost:9999" });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe("My Session");
    expect(res.body.targetUrl).toBe("http://localhost:9999");
    expect(res.body.status).toBe("INGESTION");
  });

  it("generates a default name if name is omitted", async () => {
    const res = await request(app)
      .post("/api/sessions")
      .send({ targetUrl: "http://localhost:9999" });
    expect(res.status).toBe(201);
    expect(res.body.name).toMatch(/^session-/);
  });

  it("returns 400 if targetUrl is missing", async () => {
    const res = await request(app)
      .post("/api/sessions")
      .send({ name: "No URL" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("returns the created session in subsequent list call", async () => {
    await request(app)
      .post("/api/sessions")
      .send({ name: "Listed", targetUrl: "http://example.com" });

    const listRes = await request(app).get("/api/sessions");
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].name).toBe("Listed");
  });
});

describe("GET /api/sessions/:sessionId", () => {
  it("returns session details including testCounts", async () => {
    const created = await request(app)
      .post("/api/sessions")
      .send({ name: "Detail Test", targetUrl: "http://localhost" });
    const sessionId = created.body.id as string;

    const res = await request(app).get(`/api/sessions/${sessionId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(sessionId);
    expect(res.body.testCounts).toBeDefined();
    expect(res.body.testCounts.functional).toBe(0);
  });

  it("returns 404 for unknown session ID", async () => {
    const res = await request(app).get("/api/sessions/nonexistent-id");
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});

describe("POST /api/sessions/:sessionId/resume", () => {
  it("resumes an existing session and returns updated session", async () => {
    const created = await request(app)
      .post("/api/sessions")
      .send({ name: "Resume Test", targetUrl: "http://localhost" });
    const sessionId = created.body.id as string;

    const res = await request(app).post(`/api/sessions/${sessionId}/resume`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(sessionId);
  });
});

describe("POST /api/sessions/:sessionId/advance", () => {
  it("advances the session to the next phase", async () => {
    const created = await request(app)
      .post("/api/sessions")
      .send({ name: "Advance Test", targetUrl: "http://localhost" });
    const sessionId = created.body.id as string;

    const res = await request(app).post(`/api/sessions/${sessionId}/advance`);
    expect(res.status).toBe(200);
    expect(res.body.status).not.toBe("INGESTION");
  });
});

describe("GET /api/sessions/:sessionId/export", () => {
  it("returns full session export with session, testCases, executionResults, and auditTrail", async () => {
    const created = await request(app)
      .post("/api/sessions")
      .send({ name: "Export Test", targetUrl: "http://localhost" });
    const sessionId = created.body.id as string;

    const res = await request(app).get(`/api/sessions/${sessionId}/export`);
    expect(res.status).toBe(200);
    expect(res.body.session).toBeDefined();
    expect(res.body.session.id).toBe(sessionId);
    expect(Array.isArray(res.body.testCases)).toBe(true);
    expect(Array.isArray(res.body.executionResults)).toBe(true);
    expect(Array.isArray(res.body.auditTrail)).toBe(true);
  });
});
