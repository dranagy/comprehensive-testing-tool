# Full Application Testing Guide for GitHub Copilot

This document provides comprehensive instructions for testing the CTT application end-to-end. It covers backend unit tests, API integration tests, frontend component tests, and full-stack E2E scenarios.

---

## Test Environment Setup

### Prerequisites

```bash
# Install all dependencies
npm install
cd frontend && npm install && cd ..

# Install Playwright browsers (required for functional test execution)
npx playwright install chromium

# Build the backend
npm run build
```

### Test Commands

| Command | What it does |
|---------|-------------|
| `npx vitest run` | Run all 155 backend tests |
| `npx vitest run tests/unit/` | Run only unit tests |
| `npx vitest run tests/integration/` | Run only integration tests |
| `npx vitest --coverage` | Run with coverage report |
| `cd frontend && npm run build` | Verify frontend compiles |
| `npx tsc --noEmit` | Type-check backend without building |

---

## Part 1: Backend Unit Tests

The project has 155 existing tests. Run them first and ensure they all pass:

```bash
npx vitest run
```

**Expected:** 155 passed, 2 skipped (security and performance integration tests that need ZAP/Artillery).

### Existing Test Files

| File | Tests | What's covered |
|------|-------|---------------|
| `tests/unit/core/session.test.ts` | 21 | Session lifecycle, phase transitions, resumption |
| `tests/unit/core/approval-gate.test.ts` | 20 | Gate state machine, approval/rejection/skip |
| `tests/unit/core/runner.test.ts` | 19 | Test runner orchestration, parallel execution |
| `tests/unit/core/audit-log.test.ts` | 11 | Insert-only logging, export |
| `tests/unit/modules/ingestion.test.ts` | 18 | Document parsing (PDF, DOCX, TXT, MD) |
| `tests/unit/modules/browser-manager.test.ts` | 11 | Browser lifecycle, context isolation |
| `tests/unit/modules/proxy-manager.test.ts` | 12 | ZAP proxy management |
| `tests/unit/modules/findings.test.ts` | 12 | Security finding processing |
| `tests/unit/modules/sla-validator.test.ts` | 7 | SLA threshold validation |
| `tests/unit/modules/converter.test.ts` | 7 | Test case format conversion |
| `tests/unit/cli/run-command.test.ts` | 13 | CLI run command parsing |
| `tests/integration/functional-execution.test.ts` | 2 | Actual Playwright execution |
| `tests/integration/performance-execution.test.ts` | 2 | Artillery execution (1 skipped) |
| `tests/integration/security-execution.test.ts` | 2 | ZAP scanning (1 skipped) |

### Tests to Add

#### 1. API Route Tests (NEW — no tests exist yet)

Create `tests/unit/api/routes/sessions.test.ts`:

```typescript
// Test cases needed:
// - GET /api/sessions returns array of sessions
// - POST /api/sessions creates session with required targetUrl
// - POST /api/sessions returns 400 if targetUrl missing
// - GET /api/sessions/:sessionId returns session details
// - GET /api/sessions/:sessionId returns 404 for unknown ID
// - POST /api/sessions/:sessionId/resume restores session
// - POST /api/sessions/:sessionId/advance moves to next phase
// - GET /api/sessions/:sessionId/export returns full export
```

Create `tests/unit/api/routes/ingest.test.ts`:

```typescript
// Test cases needed:
// - POST /api/ingest/:sessionId/upload accepts PDF files
// - POST /api/ingest/:sessionId/upload accepts DOCX files
// - POST /api/ingest/:sessionId/upload accepts TXT files
// - POST /api/ingest/:sessionId/upload accepts MD files
// - POST /api/ingest/:sessionId/upload rejects unsupported formats
// - POST /api/ingest/:sessionId/upload returns 404 for unknown session
// - POST /api/ingest/:sessionId/upload handles multiple files
```

Create `tests/unit/api/routes/generate.test.ts`:

```typescript
// Test cases needed:
// - POST /api/generate/:sessionId generates all phases
// - POST /api/generate/:sessionId/FUNCTIONAL returns generatedCount
// - POST /api/generate/:sessionId/PERFORMANCE derives from functional
// - POST /api/generate/:sessionId/SECURITY creates scan tests
// - POST /api/generate/:sessionId/INVALID returns 400
// - POST /api/generate/:sessionId/PERFORMANCE returns 400 without functional tests
```

Create `tests/unit/api/routes/review.test.ts`:

```typescript
// Test cases needed:
// - GET /api/review/:sessionId/test-cases returns all test cases
// - GET /api/review/:sessionId/test-cases?phase=FUNCTIONAL filters by phase
// - GET /api/review/:sessionId/test-cases?status=GENERATED filters by status
// - GET /api/review/:sessionId/test-cases/:testId returns single test
// - PUT /api/review/:sessionId/test-cases/:testId updates definition
// - POST /api/review/:sessionId/approve approves by phase
// - POST /api/review/:sessionId/approve approves by testIds
// - POST /api/review/:sessionId/test-cases/:testId/reject rejects with reason
// - GET /api/review/:sessionId/gates returns all gates
// - POST /api/review/:sessionId/gates/:phase resolves gate
```

Create `tests/unit/api/routes/run.test.ts`:

```typescript
// Test cases needed:
// - POST /api/run/:sessionId/run starts execution, returns runId
// - POST /api/run/:sessionId/run with phase runs only that phase
// - POST /api/run/:sessionId/run with testIds runs specific tests
// - POST /api/run/:sessionId/run with dryRun returns test list without running
// - POST /api/run/:sessionId/run/:runId/cancel stops execution
```

Create `tests/unit/api/routes/reports.test.ts`:

```typescript
// Test cases needed:
// - GET /api/reports/:sessionId/summary returns aggregated data
// - GET /api/reports/:sessionId/functional returns test results
// - GET /api/reports/:sessionId/functional?status=PASSED filters results
// - GET /api/reports/:sessionId/performance returns metrics
// - GET /api/reports/:sessionId/security returns findings
// - GET /api/reports/:sessionId/security?severity=HIGH filters findings
// - GET /api/reports/:sessionId/audit returns audit trail
// - GET /api/reports/:sessionId/audit?action=TESTS_GENERATED filters by action
```

Create `tests/unit/api/routes/config.test.ts`:

```typescript
// Test cases needed:
// - GET /api/config returns current config
// - PUT /api/config updates config
// - PUT /api/config returns { updated: true, config: {...} }
// - POST /api/config/reset resets to defaults
```

Create `tests/unit/api/middleware/session-resolver.test.ts`:

```typescript
// Test cases needed:
// - Resolves valid session and attaches to req.session
// - Returns 404 for non-existent session ID
// - Handles malformed session ID
```

#### 2. Additional Unit Tests to Strengthen Coverage

Create `tests/unit/api/websocket/progress.test.ts`:

```typescript
// Test cases needed:
// - ProgressEmitter emits events for correct runId
// - ProgressEmitter does not emit for wrong runId
// - unsubscribe stops further emissions
// - Multiple subscribers receive the same events
```

Create `tests/unit/core/database.test.ts`:

```typescript
// Test cases needed:
// - getDb() returns same instance on repeated calls
// - Database creates all tables on initialization
// - WAL mode is enabled
// - Migrations run on initialization
```

---

## Part 2: API Integration Tests

These tests verify the full request/response cycle through Express.

### Setup Pattern

```typescript
import request from "supertest";
import { app } from "../../../src/api/server.js";
// Use an in-memory database or test-specific .ctt directory
```

### Test Scenario: Complete Workflow

Create `tests/integration/full-workflow.test.ts`:

```typescript
describe("Complete Testing Workflow", () => {
  // Step 1: Create session
  it("creates a session", async () => {
    const res = await request(app)
      .post("/api/sessions")
      .send({ name: "Test Session", targetUrl: "http://localhost:9999" });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe("INGESTION");
  });

  // Step 2: Upload documents
  it("uploads a markdown file", async () => {
    const res = await request(app)
      .post(`/api/ingest/${sessionId}/upload`)
      .attach("files", "tests/fixtures/test-cases.md");
    expect(res.status).toBe(200);
    expect(res.body.documents).toHaveLength(1);
  });

  // Step 3: Generate test cases
  it("generates functional tests", async () => {
    const res = await request(app)
      .post(`/api/generate/${sessionId}/FUNCTIONAL`);
    expect(res.status).toBe(200);
    expect(res.body.generatedCount).toBeGreaterThan(0);
  });

  // Step 4: List and review test cases
  it("lists generated test cases", async () => {
    const res = await request(app)
      .get(`/api/review/${sessionId}/test-cases?status=GENERATED`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  // Step 5: Approve test cases
  it("approves functional tests", async () => {
    const res = await request(app)
      .post(`/api/review/${sessionId}/approve`)
      .send({ phase: "FUNCTIONAL" });
    expect(res.status).toBe(200);
    expect(res.body.approved).toBeGreaterThan(0);
  });

  // Step 6: Run tests (dry run to avoid needing a real server)
  it("starts a dry run", async () => {
    const res = await request(app)
      .post(`/api/run/${sessionId}/run`)
      .send({ phase: "FUNCTIONAL", dryRun: true });
    expect(res.status).toBe(200);
    expect(res.body.dryRun).toBe(true);
    expect(res.body.testCount).toBeGreaterThan(0);
  });

  // Step 7: Get summary report
  it("returns summary report", async () => {
    const res = await request(app)
      .get(`/api/reports/${sessionId}/summary`);
    expect(res.status).toBe(200);
    expect(res.body.testCases).toBeDefined();
    expect(res.body.execution).toBeDefined();
  });

  // Step 8: Check audit trail
  it("returns audit trail", async () => {
    const res = await request(app)
      .get(`/api/reports/${sessionId}/audit`);
    expect(res.status).toBe(200);
    expect(res.body.entries.length).toBeGreaterThan(0);
  });

  // Step 9: Export session
  it("exports session data", async () => {
    const res = await request(app)
      .get(`/api/sessions/${sessionId}/export`);
    expect(res.status).toBe(200);
  });
});
```

### Test Fixtures Needed

Create these test fixture files:

**`tests/fixtures/test-cases.md`:**
```markdown
# Test Cases

## TC-001: User Login
Navigate to /login, enter username and password, click submit.
User should see the dashboard.

## TC-002: Search Functionality
Navigate to /search, type "test" in search box, press Enter.
Results should be displayed.
```

**`tests/fixtures/simple.txt`:**
```
Test case: Homepage loads
Navigate to / and verify the page loads successfully.
```

### Error Path Tests

Create `tests/integration/error-paths.test.ts`:

```typescript
describe("API Error Handling", () => {
  it("returns 400 for missing targetUrl", async () => {
    const res = await request(app)
      .post("/api/sessions")
      .send({ name: "No URL" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("returns 404 for unknown session", async () => {
    const res = await request(app)
      .get("/api/sessions/nonexistent-id");
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid generate phase", async () => {
    const res = await request(app)
      .post(`/api/generate/${sessionId}/INVALID_PHASE`);
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown test case", async () => {
    const res = await request(app)
      .get(`/api/review/${sessionId}/test-cases/nonexistent-id`);
    expect(res.status).toBe(404);
  });

  it("handles file upload with no files", async () => {
    const res = await request(app)
      .post(`/api/ingest/${sessionId}/upload`);
    expect(res.status).toBe(400);
  });

  it("handles malformed JSON body", async () => {
    const res = await request(app)
      .post("/api/sessions")
      .set("Content-Type", "application/json")
      .send("{ invalid json");
    expect(res.status).toBe(400);
  });
});
```

---

## Part 3: Frontend Build Verification

The frontend doesn't have a test framework configured yet. Verify it builds cleanly:

```bash
cd frontend
npm run build
```

**Expected output:** All 18 routes compile with no TypeScript errors.

### Frontend Tests to Add

#### Setup (if adding Vitest to frontend)

```bash
cd frontend
npm install -D vitest @testing-library/react @testing-library/jest-dom @vitejs/plugin-react jsdom
```

Create `frontend/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

#### Component Tests to Create

**`frontend/src/components/ui/Button.test.tsx`:**

```typescript
// Test cases needed:
// - Renders with default variant
// - Renders with each variant (primary, secondary, danger, ghost)
// - Renders with each size (sm, md, lg)
// - Handles click events
// - Shows disabled state and prevents clicks when disabled
// - Applies custom className
```

**`frontend/src/components/ui/StatusBadge.test.tsx`:**

```typescript
// Test cases needed:
// - Renders each status with correct color class
// - Renders with size variants
// - Handles all status values: INGESTION, GENERATION, FUNCTIONAL, PERFORMANCE, SECURITY, COMPLETE, PASSED, FAILED, ERROR, SKIPPED, TIMEOUT, PENDING, APPROVED, REJECTED, GENERATED, MODIFIED
```

**`frontend/src/components/ui/SeverityBadge.test.tsx`:**

```typescript
// Test cases needed:
// - Renders each severity: CRITICAL, HIGH, MEDIUM, LOW, INFORMATIONAL
// - Correct color for each severity
```

**`frontend/src/components/ui/Toast.test.tsx`:**

```typescript
// Test cases needed:
// - showToast adds a toast to the DOM
// - Toast auto-dismisses after 5 seconds
// - Multiple toasts stack vertically
// - Dismiss button removes toast immediately
// - Error variant uses error styling
// - Success variant uses success styling
// - useToast throws when used outside provider
```

**`frontend/src/components/ui/ErrorBoundary.test.tsx`:**

```typescript
// Test cases needed:
// - Renders children when no error
// - Shows error message when child throws
// - Retry button resets error state
// - Custom fallback renders when provided
```

**`frontend/src/lib/session-context.test.tsx`:**

```typescript
// Test cases needed:
// - Provider starts with loading=true
// - Provider fetches sessions on mount
// - setActiveSessionId writes to localStorage
// - setActiveSessionId(null) removes from localStorage
// - useSession throws when used outside provider
// - Falls back to first session if no stored ID
```

**`frontend/src/lib/api-client.test.ts`:**

```typescript
// Test cases needed:
// - sessions.list() calls GET /sessions
// - sessions.create() calls POST /sessions with body
// - ingest.upload() sends multipart form data
// - generate.all() calls POST /generate/:sessionId
// - reports paths don't have double "reports/"
// - config.update() returns ConfigUpdateResponse type
// - connectRunProgress() creates WebSocket with correct URL
// - request() throws on non-2xx responses with error message
```

#### Page Component Tests

For each page component, test:

```typescript
// Common test patterns for all pages:
// - Renders loading state initially
// - Fetches data on mount
// - Shows error toast on API failure
// - Renders data after successful fetch
// - Shows empty state when no data
// - Navigates correctly on button clicks
```

Key pages to test first:

1. **Dashboard (`page.tsx`)** — session list, stat cards
2. **Session Detail** — phase progress, test counts, quick actions
3. **Ingest** — file upload, drag-and-drop
4. **Test Cases** — filtering, bulk selection
5. **Run** — selection modes, configuration
6. **Reports (all 5)** — chart rendering, filtering

---

## Part 4: Full-Stack End-to-End Tests

These tests verify the complete stack working together.

### Manual E2E Test Plan

Execute this workflow manually to verify the full stack:

#### Prerequisites
```bash
# Terminal 1: Start API server
cd comprehensive-testing-tool
ctt serve --port 3456

# Terminal 2: Start frontend
cd comprehensive-testing-tool/frontend
npm run dev
```

#### Test 1: Dashboard Loads
1. Open http://localhost:3000
2. Verify dashboard shows "No sessions yet" message
3. Verify "New Session" button is visible

#### Test 2: Create Session
1. Click "+ New Session"
2. Fill in: Name = "E2E Test", Target URL = "http://example.com"
3. Click "Create Session"
4. Verify redirect to session detail page
5. Verify phase progress shows INGESTION

#### Test 3: Sidebar Navigation
1. Verify session-scoped sidebar links appear (Ingest, Test Cases, Approve, Run, Reports)
2. Click "Ingest" — verify navigation to `/sessions/{id}/ingest`
3. Click each sidebar link — verify correct page loads
4. Verify active link highlighting

#### Test 4: TopBar Session Selector
1. Create a second session from the dashboard
2. Return to any session page
3. Use the session selector dropdown in the top bar
4. Verify switching sessions navigates to the new session

#### Test 5: Upload Documents
1. Navigate to Ingest page
2. Create a test file: `echo "# Test\nNavigate to / and verify page loads" > test.md`
3. Upload via drag-and-drop or file picker
4. Verify uploaded document appears in the list
5. Verify "tests generated" count shows

#### Test 6: Review Test Cases
1. Navigate to Test Cases page
2. Verify generated tests appear in the table
3. Click a test case to view details
4. Verify steps and assertions display
5. Click Edit, modify a step, save
6. Verify status changes to MODIFIED
7. Go back to test case list, verify MODIFIED badge

#### Test 7: Approval Flow
1. Navigate to Approval page
2. Verify FUNCTIONAL gate shows PENDING
3. Add a comment
4. Click Approve
5. Verify gate status changes to APPROVED
6. Verify other gates still show PENDING

#### Test 8: Run Tests
1. Navigate to Run page
2. Select "By phase" → FUNCTIONAL
3. Check "Dry Run" checkbox
4. Click "Run Tests"
5. Verify test list appears (no actual execution)

#### Test 9: Reports
1. Navigate to Reports → Summary
2. Verify stat cards render (may show 0s if no tests ran)
3. Click "Functional Report" — verify page loads
4. Click "Security Report" — verify page loads
5. Click "Audit Trail" — verify timeline entries exist
6. Verify action filter works

#### Test 10: Settings
1. Navigate to Settings page
2. Verify current config loads
3. Change "Default Target URL" to something new
4. Click "Save Settings"
5. Verify success message appears
6. Click "Reset to Defaults"
7. Verify settings reset

#### Test 11: Error Handling
1. Stop the API server (Ctrl+C in Terminal 1)
2. Refresh the dashboard in the browser
3. Verify error toast appears (red notification in bottom-right)
4. Restart the API server
5. Refresh — verify data loads normally

#### Test 12: Export
1. Navigate to session detail
2. Click the export link (or navigate to `/sessions/{id}/export`)
3. Verify export options are available

---

## Part 5: Performance and Load Tests

### API Response Time Tests

Verify all API endpoints respond within acceptable time:

```bash
# Start the server
ctt serve &

# Test each endpoint
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3456/api/health
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3456/api/sessions
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3456/api/config
```

Create `curl-format.txt`:
```
time_total: %{time_total}s
```

**Expected:** All endpoints respond in under 200ms with an empty database.

### Database Performance

With a session containing 1000 test cases and 5000 execution results:

```bash
# Query performance checks
# Summary report should respond in under 500ms
# Functional report should respond in under 500ms
# Audit trail should respond in under 300ms
```

---

## Part 6: Cross-Browser Verification

If testing with multiple browsers, verify:

```bash
# The run page allows selecting chromium, firefox, webkit
# Verify browser selection is sent correctly to the API
# Verify the API accepts the browser parameter
# Verify Playwright launches the correct browser
```

---

## Test Results Template

Record your findings in this format:

```
## Test Category: [Category Name]

| Test | Status | Notes |
|------|--------|-------|
| Test description | PASS/FAIL/SKIP | Any observations |

### Failures

**[Test Name]:**
- Expected: ...
- Actual: ...
- Root cause: ...
- Suggested fix: ...

### Coverage Gaps

- [Gap description] — No test exists for [scenario]
- [Gap description] — Test exists but doesn't cover [edge case]
```

---

## Quick Reference: All API Endpoints

Use this as a checklist to ensure every endpoint is tested:

### Sessions (6 endpoints)
- [ ] `GET /api/sessions`
- [ ] `POST /api/sessions`
- [ ] `GET /api/sessions/:sessionId`
- [ ] `POST /api/sessions/:sessionId/resume`
- [ ] `POST /api/sessions/:sessionId/advance`
- [ ] `GET /api/sessions/:sessionId/export`

### Ingest (1 endpoint)
- [ ] `POST /api/ingest/:sessionId/upload`

### Generate (2 endpoints)
- [ ] `POST /api/generate/:sessionId`
- [ ] `POST /api/generate/:sessionId/:phase`

### Review (7 endpoints)
- [ ] `GET /api/review/:sessionId/test-cases`
- [ ] `GET /api/review/:sessionId/test-cases/:testId`
- [ ] `PUT /api/review/:sessionId/test-cases/:testId`
- [ ] `POST /api/review/:sessionId/approve`
- [ ] `POST /api/review/:sessionId/test-cases/:testId/reject`
- [ ] `GET /api/review/:sessionId/gates`
- [ ] `POST /api/review/:sessionId/gates/:phase`

### Run (2 endpoints)
- [ ] `POST /api/run/:sessionId/run`
- [ ] `POST /api/run/:sessionId/run/:runId/cancel`

### Reports (5 endpoints)
- [ ] `GET /api/reports/:sessionId/summary`
- [ ] `GET /api/reports/:sessionId/functional`
- [ ] `GET /api/reports/:sessionId/performance`
- [ ] `GET /api/reports/:sessionId/security`
- [ ] `GET /api/reports/:sessionId/audit`

### Config (3 endpoints)
- [ ] `GET /api/config`
- [ ] `PUT /api/config`
- [ ] `POST /api/config/reset`

### Other (2 endpoints)
- [ ] `GET /api/health`
- [ ] WebSocket `ws://localhost:3456/ws?runId=<runId>`

**Total: 28 endpoints to test**

---

## Quick Reference: All Frontend Routes

- [ ] `/` — Dashboard
- [ ] `/sessions/new` — Create session
- [ ] `/sessions/[sessionId]` — Session detail
- [ ] `/sessions/[sessionId]/ingest` — Upload documents
- [ ] `/sessions/[sessionId]/test-cases` — Test case list
- [ ] `/sessions/[sessionId]/test-cases/[testId]` — Test case detail
- [ ] `/sessions/[sessionId]/test-cases/[testId]/edit` — Edit test case
- [ ] `/sessions/[sessionId]/approval` — Approval gates
- [ ] `/sessions/[sessionId]/run` — Run configuration
- [ ] `/sessions/[sessionId]/run/[runId]` — Run progress
- [ ] `/sessions/[sessionId]/reports/summary` — Summary report
- [ ] `/sessions/[sessionId]/reports/functional` — Functional report
- [ ] `/sessions/[sessionId]/reports/performance` — Performance report
- [ ] `/sessions/[sessionId]/reports/security` — Security report
- [ ] `/sessions/[sessionId]/reports/audit` — Audit trail
- [ ] `/sessions/[sessionId]/export` — Export session
- [ ] `/settings` — Configuration

**Total: 17 unique routes + shared components**
