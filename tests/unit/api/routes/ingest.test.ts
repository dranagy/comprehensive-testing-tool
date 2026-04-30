import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app } from "../../../../src/api/server.js";
import { getDb } from "../../../../src/api/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, "../../../fixtures");
const MD_FIXTURE = path.join(FIXTURES_DIR, "test-cases.md");
const TXT_FIXTURE = path.join(FIXTURES_DIR, "simple.txt");
const SAMPLE_MD = path.join(FIXTURES_DIR, "sample-docs", "login-test.md");

beforeEach(() => {
  getDb(":memory:");
});

async function createSession(): Promise<string> {
  const res = await request(app)
    .post("/api/sessions")
    .send({ name: "Ingest Session", targetUrl: "http://localhost:9999" });
  return res.body.id as string;
}

describe("POST /api/ingest/:sessionId/upload", () => {
  it("accepts a markdown file and returns document info", async () => {
    const sessionId = await createSession();
    const res = await request(app)
      .post(`/api/ingest/${sessionId}/upload`)
      .attach("files", MD_FIXTURE);
    expect(res.status).toBe(200);
    expect(res.body.documentsProcessed).toBe(1);
    expect(Array.isArray(res.body.results)).toBe(true);
  });

  it("accepts a txt file", async () => {
    const sessionId = await createSession();
    const res = await request(app)
      .post(`/api/ingest/${sessionId}/upload`)
      .attach("files", TXT_FIXTURE);
    expect(res.status).toBe(200);
    expect(res.body.documentsProcessed).toBe(1);
  });

  it("handles multiple files in a single upload", async () => {
    const sessionId = await createSession();
    const res = await request(app)
      .post(`/api/ingest/${sessionId}/upload`)
      .attach("files", MD_FIXTURE)
      .attach("files", TXT_FIXTURE);
    expect(res.status).toBe(200);
    expect(res.body.documentsProcessed).toBe(2);
  });

  it("returns 400 when no files are uploaded", async () => {
    const sessionId = await createSession();
    const res = await request(app).post(`/api/ingest/${sessionId}/upload`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("returns 404 for an unknown session ID", async () => {
    const res = await request(app)
      .post("/api/ingest/nonexistent-session/upload")
      .attach("files", MD_FIXTURE);
    expect(res.status).toBe(404);
  });

  it("increments totalTestsGenerated for uploaded files", async () => {
    const sessionId = await createSession();
    const res = await request(app)
      .post(`/api/ingest/${sessionId}/upload`)
      .attach("files", MD_FIXTURE);
    expect(res.status).toBe(200);
    expect(typeof res.body.totalTestsGenerated).toBe("number");
  });

  it("reports format for each uploaded file", async () => {
    const sessionId = await createSession();
    const res = await request(app)
      .post(`/api/ingest/${sessionId}/upload`)
      .attach("files", SAMPLE_MD);
    expect(res.status).toBe(200);
    const result = res.body.results[0] as { format: string };
    expect(result.format).toBeTruthy();
  });
});
