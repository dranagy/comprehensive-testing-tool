/**
 * API error-handling integration tests.
 *
 * Verifies that the API returns correct HTTP error responses for invalid
 * inputs, unknown resources, and malformed requests.
 */

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app } from "../../src/api/server.js";
import { getDb } from "../../src/api/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MD_FIXTURE = path.resolve(__dirname, "../fixtures/test-cases.md");

beforeEach(() => {
  getDb(":memory:");
});

async function createSession(): Promise<string> {
  const res = await request(app)
    .post("/api/sessions")
    .send({ name: "Error Test Session", targetUrl: "http://localhost:9999" });
  return res.body.id as string;
}

describe("API Error Handling", () => {
  describe("Sessions", () => {
    it("returns 400 for missing targetUrl on session creation", async () => {
      const res = await request(app)
        .post("/api/sessions")
        .send({ name: "No URL" });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it("returns 404 for unknown session ID", async () => {
      const res = await request(app).get("/api/sessions/nonexistent-id");
      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });
  });

  describe("Ingest", () => {
    it("returns 400 when no files are attached to the upload", async () => {
      const sessionId = await createSession();
      const res = await request(app).post(
        `/api/ingest/${sessionId}/upload`,
      );
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it("returns 404 when uploading to an unknown session", async () => {
      const res = await request(app)
        .post("/api/ingest/nonexistent/upload")
        .attach("files", MD_FIXTURE);
      expect(res.status).toBe(404);
    });
  });

  describe("Generate", () => {
    it("returns 400 for an invalid phase name", async () => {
      const sessionId = await createSession();
      const res = await request(app).post(
        `/api/generate/${sessionId}/INVALID_PHASE`,
      );
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it("returns 400 when generating PERFORMANCE with no functional tests", async () => {
      const sessionId = await createSession();
      const res = await request(app).post(
        `/api/generate/${sessionId}/PERFORMANCE`,
      );
      expect(res.status).toBe(400);
    });
  });

  describe("Review", () => {
    it("returns 404 for an unknown test case ID", async () => {
      const sessionId = await createSession();
      const res = await request(app).get(
        `/api/review/${sessionId}/test-cases/nonexistent-id`,
      );
      expect(res.status).toBe(404);
    });

    it("returns 400 when updating a test case without a definition", async () => {
      const sessionId = await createSession();
      // Seed a test case via generate/SECURITY (reliable - always produces 2)
      await request(app).post(`/api/generate/${sessionId}/SECURITY`);
      const listRes = await request(app).get(
        `/api/review/${sessionId}/test-cases`,
      );
      const testId = (listRes.body as Array<{ id: string }>)[0].id;

      const res = await request(app)
        .put(`/api/review/${sessionId}/test-cases/${testId}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe("Run", () => {
    it("returns 400 when there are no approved tests to run", async () => {
      const sessionId = await createSession();
      const res = await request(app)
        .post(`/api/run/${sessionId}/run`)
        .send({ dryRun: true });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it("returns 404 when cancelling an unknown run", async () => {
      const sessionId = await createSession();
      const res = await request(app).post(
        `/api/run/${sessionId}/run/nonexistent-run/cancel`,
      );
      expect(res.status).toBe(404);
    });
  });

  describe("Health check", () => {
    it("GET /api/health returns { status: 'ok' }", async () => {
      const res = await request(app).get("/api/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe("Unknown routes", () => {
    it("returns 404 for unknown API routes", async () => {
      const res = await request(app).get("/api/nonexistent-route");
      expect(res.status).toBe(404);
    });
  });
});
