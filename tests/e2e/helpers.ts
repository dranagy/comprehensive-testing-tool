/**
 * Shared helpers for CTT E2E tests.
 *
 * Provides typed wrappers around the CTT REST API so tests can set up state
 * directly without going through the UI when it is not the subject of the test.
 */

const API = "http://localhost:3456/api";

export interface ApiSession {
  id: string;
  name: string;
  targetUrl: string;
  status: string;
}

/** Create a session via the REST API and return it. */
export async function createSession(
  name: string,
  targetUrl = "https://example.com"
): Promise<ApiSession> {
  const res = await fetch(`${API}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, targetUrl }),
  });
  if (!res.ok) throw new Error(`Create session failed: ${res.status}`);
  return res.json();
}

/** Upload a plain-text document to a session. */
export async function uploadTextDoc(
  sessionId: string,
  filename: string,
  content: string
): Promise<void> {
  const form = new FormData();
  form.append("files", new Blob([content], { type: "text/plain" }), filename);
  const res = await fetch(`${API}/ingest/${sessionId}/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
}

/** Generate test cases for a session. */
export async function generateTests(
  sessionId: string,
  phase = "FUNCTIONAL"
): Promise<void> {
  const res = await fetch(`${API}/generate/${sessionId}/${phase}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Generate failed: ${res.status}`);
}

/** Approve all test cases in a phase. */
export async function approvePhase(
  sessionId: string,
  phase = "FUNCTIONAL"
): Promise<void> {
  const res = await fetch(`${API}/review/${sessionId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phase }),
  });
  if (!res.ok) throw new Error(`Approve failed: ${res.status}`);
}
