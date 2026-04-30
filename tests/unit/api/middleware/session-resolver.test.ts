import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../../../src/api/server.js";
import { getDb } from "../../../../src/api/db.js";

beforeEach(() => {
  getDb(":memory:");
});

describe("resolveSession middleware", () => {
  it("resolves a valid session and attaches it to the route handler", async () => {
    // Create a session first
    const created = await request(app)
      .post("/api/sessions")
      .send({ name: "Resolver Test", targetUrl: "http://localhost" });
    const sessionId = created.body.id as string;

    // Access a route that uses resolveSession
    const res = await request(app).get(`/api/sessions/${sessionId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(sessionId);
  });

  it("returns 404 when the session ID does not exist", async () => {
    const res = await request(app).get("/api/sessions/totally-unknown-id");
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/Session not found/i);
  });

  it("returns 404 for a malformed / random session ID string", async () => {
    const res = await request(app).get("/api/sessions/not-a-real-uuid");
    expect(res.status).toBe(404);
  });
});
