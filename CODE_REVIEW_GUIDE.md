# Code Review Guide for GitHub Copilot

This document provides detailed instructions for performing a comprehensive code review of the Comprehensive Testing Tool (CTT). Use this as your review checklist and context guide.

---

## Project Overview

**CTT** is a unified local testing platform combining functional, performance, and DAST security testing. It has two main components:

| Component | Location | Stack |
|-----------|----------|-------|
| Backend (CLI + API) | `src/` | TypeScript, Express 5, BetterSQLite3, Playwright, Commander.js |
| Frontend (Web UI) | `frontend/src/` | Next.js 16, React 19, Tailwind CSS v4, Recharts |

**Key Facts:**
- ESM-only project (`"type": "module"`)
- Backend compiles to `dist/` via `tsc`
- Frontend uses Next.js App Router with Turbopack
- Database: SQLite via BetterSQLite3 (file at `.ctt/sessions.db`)
- No authentication on the API (local-only design)
- 155 backend unit/integration tests passing via Vitest

---

## Review Priorities

Review in this order (highest to lowest impact):

### Priority 1 — Security Vulnerabilities
**Goal:** Find any OWASP Top 10 issues, injection points, or data exposure.

**Files to check:**

| File | What to look for |
|------|-----------------|
| `src/api/routes/ingest.ts` | File upload validation: is the file type whitelist enforced server-side? Can path traversal occur? Is the upload directory writable by the process? |
| `src/api/routes/review.ts` | SQL injection in query params (`phase`, `status`, `tags`). Check if user input reaches SQL queries unsanitized. |
| `src/api/routes/reports.ts` | Same — check all `req.query` and `req.params` usage for injection. |
| `src/api/routes/run.ts` | The run endpoint spawns Playwright browsers. Check if `browser`, `testIds`, `tags` inputs could be exploited. |
| `src/api/routes/sessions.ts` | Check `targetUrl` validation — can an attacker provide `file:///etc/passwd` or internal IPs (SSRF)? |
| `src/api/routes/generate.ts` | Check `phase` param validation against the whitelist. |
| `src/api/server.ts` | CORS is fully open (`app.use(cors())`). Is this acceptable for local-only use? |
| `src/api/middleware/error-handler.ts` | Does the error handler leak stack traces or internal details to clients? |

**Specific checks:**
- [ ] All `req.params` values are validated before use (especially `sessionId`, `phase`, `testId`)
- [ ] All `req.query` values are validated (especially `status`, `severity`, `action`)
- [ ] File uploads reject unexpected MIME types server-side (not just client-side)
- [ ] No `eval()`, `Function()`, or `child_process.exec()` with user input
- [ ] Error responses don't include stack traces in production
- [ ] No hardcoded secrets or API keys

### Priority 2 — Data Integrity and Race Conditions
**Goal:** Ensure database operations are safe, atomic, and consistent.

**Files to check:**

| File | What to look for |
|------|-----------------|
| `src/db/repositories/*.ts` | All 6 repository files. Check for race conditions in concurrent access. BetterSQLite3 is synchronous but the API is async — are there places where multiple requests could corrupt data? |
| `src/api/routes/run.ts` | Test execution is async. Can two runs start simultaneously for the same session? Is there locking? |
| `src/core/session.ts` | Phase transitions — can a session be advanced past its current state incorrectly? |
| `src/core/approval-gate.ts` | Gate resolution — can a gate be approved twice? Is the state machine enforced? |
| `src/api/db.ts` | Database singleton — is it thread-safe? Does WAL mode handle concurrent reads? |

**Specific checks:**
- [ ] SQLite WAL mode is enabled for concurrent read/write safety
- [ ] Test execution has a mutex or status check to prevent duplicate runs
- [ ] Session phase transitions are validated (can't skip phases)
- [ ] Approval gates can't be resolved twice
- [ ] Transaction usage where multiple tables are modified atomically

### Priority 3 — Type Safety and API Contract
**Goal:** Ensure TypeScript types match runtime data and API contracts are correct.

**Files to check:**

| File | What to look for |
|------|-----------------|
| `src/shared/types.ts` | Master type definitions. Do they match what the repositories actually store/return? |
| `src/api/types.ts` | Express Request augmentation. Is the `session` property always populated when accessed? |
| `src/api/routes/*.ts` | All route handlers — check `as string` casts on `req.params`. Express 5 types params as `string \| string[]`. Are there unsafe casts? |
| `frontend/src/lib/types.ts` | Frontend types. Do they match the backend API responses? Specifically check `PerfMetric`, `SecurityFinding`, `Session`, `TestCase`. |
| `frontend/src/lib/api-client.ts` | API client method signatures. Do the generic type parameters match what the API actually returns? |
| `frontend/src/lib/session-context.tsx` | Context type and provider. Is the loading state handled correctly on initial render? |

**Specific checks:**
- [ ] Backend `req.params.sessionId as string` casts are safe (Express 5 types them as `string | string[]`)
- [ ] Frontend `PerfMetric` type matches the shape returned by `/api/reports/:sessionId/performance`
- [ ] `ExecutionResult.networkLog` is typed as `unknown[]` — should it be more specific?
- [ ] `ExecutionResult.artifacts` is typed as `Record<string, unknown>` — is this adequate?
- [ ] All API client methods use correct HTTP methods and paths
- [ ] The `useSession()` hook handles the case where SessionProvider hasn't loaded yet

### Priority 4 — Error Handling and Resilience
**Goal:** Ensure errors are caught, reported, and don't leave the system in a bad state.

**Files to check:**

| File | What to look for |
|------|-----------------|
| `src/api/middleware/error-handler.ts` | Is `ApiError` used consistently? Does the handler catch async errors? |
| `src/api/middleware/session-resolver.ts` | What happens if the session ID doesn't exist? Is the error response helpful? |
| `src/api/routes/run.ts` | What happens if Playwright crashes? Is the run marked as errored? Are resources cleaned up? |
| `src/core/runner.ts` | Test runner — does it handle timeouts, crashes, and cleanup? |
| `frontend/src/components/ui/Toast.tsx` | Toast system — does it handle rapid fire errors? Memory leak from unclosed timeouts? |
| `frontend/src/components/ui/ErrorBoundary.tsx` | Does the retry mechanism actually work? State reset correctness? |
| All `frontend/src/app/**/*.tsx` | Every page that calls the API — do they all use `showToast` for error reporting? Are there remaining `.catch(() => {})` patterns? |

**Specific checks:**
- [ ] All API routes use `try/catch` or Express 5's native async error handling
- [ ] Playwright browser contexts are always closed (even on error) — look for missing `finally` blocks
- [ ] WebSocket connections are cleaned up when runs complete or clients disconnect
- [ ] No silent error swallowing anywhere (especially in the API layer)
- [ ] The `ErrorBoundary` catches render errors in every page

### Priority 5 — Frontend Architecture
**Goal:** Check React patterns, performance, and Next.js best practices.

**Files to check:**

| File | What to look for |
|------|-----------------|
| `frontend/src/components/layout/Sidebar.tsx` | Session-scoped links — are they correct? Does active state highlight properly for nested routes? |
| `frontend/src/components/layout/TopBar.tsx` | Session selector — does it navigate correctly? What if there are no sessions? |
| `frontend/src/components/layout/AppShell.tsx` | Provider nesting order: ToastProvider wraps AppShell which wraps SessionProvider. Is this correct? |
| `frontend/src/app/sessions/[sessionId]/reports/summary/page.tsx` | SVG donut chart — is the math correct for stroke-dasharray calculations? |
| `frontend/src/app/sessions/[sessionId]/reports/performance/page.tsx` | Recharts usage — are all charts responsive? Do they handle empty data gracefully? |
| `frontend/src/app/sessions/[sessionId]/reports/functional/page.tsx` | Duration bucket algorithm — does it handle edge cases (all same duration, single test, zero duration)? |
| `frontend/src/app/sessions/[sessionId]/run/[runId]/page.tsx` | WebSocket — is there reconnection logic? Cleanup on unmount? |
| `frontend/src/app/globals.css` | Tailwind CSS v4 syntax — is `@theme inline` correct? Are all custom properties referenced in components? |
| `frontend/src/app/layout.tsx` | Font loading — are Inter and Manrope loaded correctly? Does the CSS variable setup match? |

**Specific checks:**
- [ ] All page components have `"use client"` directive where needed
- [ ] Dynamic params use `use(params)` pattern (Next.js 16 convention for `Promise<{...}>` params)
- [ ] `useEffect` cleanup functions are present where needed (WebSocket, intervals)
- [ ] No React key warnings (every `.map()` has a unique key)
- [ ] `localStorage` access is guarded with `typeof window !== "undefined"` check
- [ ] Components that use `useSession()` and `useToast()` are always inside their respective providers

### Priority 6 — Code Quality and Maintainability
**Goal:** Catch code smells, dead code, and maintainability issues.

**General checks across all files:**

- [ ] No `any` types without justification
- [ ] No commented-out code blocks
- [ ] No `console.log` left in production code (only `console.error` for errors)
- [ ] No hardcoded magic numbers without named constants
- [ ] No duplicate logic that should be extracted into shared utilities
- [ ] Consistent naming conventions (camelCase for variables/functions, PascalCase for types/components)
- [ ] No circular dependencies between modules
- [ ] Error messages are user-friendly and actionable
- [ ] No unnecessary `as` type assertions where TypeScript could infer correctly

---

## File-by-File Review Checklist

### Backend Core Files

| File | Lines | Key Concerns |
|------|-------|-------------|
| `src/api/server.ts` | ~87 | Route mounting order, CORS policy, WebSocket setup, error handler placement |
| `src/api/db.ts` | ~20 | Singleton pattern, WAL mode, migration execution |
| `src/api/types.ts` | ~10 | Global type augmentation correctness |
| `src/api/middleware/error-handler.ts` | ~30 | ApiError class, error response format, stack trace handling |
| `src/api/middleware/session-resolver.ts` | ~20 | Session loading, 404 handling, error forwarding |
| `src/core/session.ts` | ~100+ | Phase state machine, session lifecycle |
| `src/core/runner.ts` | ~150+ | Test execution, browser management, timeout handling |
| `src/core/approval-gate.ts` | ~80+ | Gate state machine, validation |
| `src/core/audit-log.ts` | ~50+ | Insert-only audit, timestamp handling |
| `src/db/repositories/test-case-repo.ts` | ~80+ | CRUD operations, SQL correctness |
| `src/db/repositories/execution-result-repo.ts` | ~80+ | Result storage, summary aggregation |
| `src/db/repositories/security-finding-repo.ts` | ~60+ | Finding storage, severity counts |
| `src/modules/functional/browser-manager.ts` | ~80+ | Browser lifecycle, context isolation |
| `src/modules/performance/artillery-runner.ts` | ~80+ | Load test execution, metric collection |
| `src/modules/security/zap-scanner.ts` | ~80+ | ZAP integration, proxy management |

### Backend Route Files

| File | Endpoints | Key Concerns |
|------|-----------|-------------|
| `src/api/routes/sessions.ts` | 6 | Input validation, session creation, phase advancement |
| `src/api/routes/ingest.ts` | 1 | File upload security, multipart handling, file type validation |
| `src/api/routes/generate.ts` | 2 | Phase validation, generate-all logic |
| `src/api/routes/review.ts` | 7 | Query param validation, approval logic, gate resolution |
| `src/api/routes/run.ts` | 2 | Run configuration, async execution, cancellation, Playwright integration |
| `src/api/routes/reports.ts` | 5 | Route paths correct (no double `reports/`), query filters |
| `src/api/routes/config.ts` | 3 | Config update validation, reset safety |

### Frontend Core Files

| File | Key Concerns |
|------|-------------|
| `frontend/src/lib/api-client.ts` | All API paths correct, typed responses, error parsing |
| `frontend/src/lib/types.ts` | All interfaces match backend responses |
| `frontend/src/lib/session-context.tsx` | Provider/hook pattern, localStorage handling, loading states |
| `frontend/src/components/layout/Sidebar.tsx` | Navigation links correct, active state detection |
| `frontend/src/components/layout/TopBar.tsx` | Session selector behavior, navigation on select |
| `frontend/src/components/layout/AppShell.tsx` | Provider composition |
| `frontend/src/components/ui/Toast.tsx` | Memory management, auto-dismiss, stacking |
| `frontend/src/components/ui/ErrorBoundary.tsx` | Error catching, retry mechanism |
| `frontend/src/components/ui/StatCard.tsx` | Prop types, trend rendering |
| `frontend/src/components/ui/StatusBadge.tsx` | All statuses handled with correct colors |
| `frontend/src/components/ui/SeverityBadge.tsx` | All severities handled |
| `frontend/src/components/ui/Button.tsx` | Variant styles, disabled state |
| `frontend/src/components/ui/ConfirmDialog.tsx` | Open/close state, focus management |
| `frontend/src/components/ui/PhaseProgressBar.tsx` | Phase progression display |

### Frontend Page Files (18 routes)

| Route | File | Key Concerns |
|-------|------|-------------|
| `/` | `app/page.tsx` | Session list, stat cards, error handling |
| `/sessions/new` | `app/sessions/new/page.tsx` | Form validation, config defaults |
| `/sessions/[sessionId]` | `app/sessions/[sessionId]/page.tsx` | Session loading, phase actions |
| `/sessions/[sessionId]/ingest` | `app/sessions/[sessionId]/ingest/page.tsx` | File upload, drag-and-drop |
| `/sessions/[sessionId]/test-cases` | `app/sessions/[sessionId]/test-cases/page.tsx` | Filtering, bulk actions |
| `/sessions/[sessionId]/test-cases/[testId]` | `app/sessions/[sessionId]/test-cases/[testId]/page.tsx` | Detail display, approve/reject |
| `/sessions/[sessionId]/test-cases/[testId]/edit` | `app/sessions/[sessionId]/test-cases/[testId]/edit/page.tsx` | Step reordering, save logic |
| `/sessions/[sessionId]/approval` | `app/sessions/[sessionId]/approval/page.tsx` | Gate resolution, comment handling |
| `/sessions/[sessionId]/run` | `app/sessions/[sessionId]/run/page.tsx` | Run configuration, selection modes |
| `/sessions/[sessionId]/run/[runId]` | `app/sessions/[sessionId]/run/[runId]/page.tsx` | WebSocket progress, cleanup |
| `/sessions/[sessionId]/reports/summary` | `app/sessions/[sessionId]/reports/summary/page.tsx` | SVG chart math, stat calculations |
| `/sessions/[sessionId]/reports/functional` | `app/sessions/[sessionId]/reports/functional/page.tsx` | Recharts bar charts, duration histogram |
| `/sessions/[sessionId]/reports/performance` | `app/sessions/[sessionId]/reports/performance/page.tsx` | Percentile charts, SLA calculation |
| `/sessions/[sessionId]/reports/security` | `app/sessions/[sessionId]/reports/security/page.tsx` | PieChart, severity filtering |
| `/sessions/[sessionId]/reports/audit` | `app/sessions/[sessionId]/reports/audit/page.tsx` | Timeline, action filtering |
| `/sessions/[sessionId]/export` | `app/sessions/[sessionId]/export/page.tsx` | Export format selection |
| `/settings` | `app/settings/page.tsx` | Config loading/saving, form handling |

---

## Known Architectural Decisions

These are intentional and should not be flagged as issues:

1. **No API authentication** — Designed for local use only. Do not suggest adding JWT/OAuth.
2. **Synchronous SQLite** — BetterSQLite3 is synchronous by design. Do not suggest switching to an async driver.
3. **`"use client"` on all page components** — Required because all pages use hooks (`useState`, `useEffect`, etc.).
4. **`use(params)` pattern** — Next.js 16 convention. Dynamic route params are `Promise<T>` and must be unwrapped.
5. **`as string` casts on `req.params`** — Express 5 types params as `string | string[]`. These casts are acceptable with validation.
6. **Tailwind CSS v4 `@theme inline`** — Correct syntax for Tailwind v4. Do not suggest v3 patterns.
7. **No ESLint in frontend** — Currently no ESLint config in the frontend. This is a known gap, not a bug.
8. **Recharts for data visualization** — Intentional choice. Do not suggest alternative charting libraries.

---

## Review Output Format

For each issue found, provide:

```
### [SEVERITY] Issue Title

**File:** `path/to/file.ts:line_number`
**Category:** Security | Data Integrity | Type Safety | Error Handling | Architecture | Quality
**Severity:** CRITICAL | HIGH | MEDIUM | LOW

**Problem:**
Description of what's wrong.

**Impact:**
What could go wrong if this isn't fixed.

**Fix:**
```typescript
// Show the corrected code
```

**Alternatively:**
If there's a simpler fix or a different approach worth considering.
```

---

## Summary Checklist

Before marking the review complete, confirm:

- [ ] All 7 backend route files reviewed
- [ ] All 6 database repository files reviewed
- [ ] All 4 core module files reviewed
- [ ] API server, middleware, and WebSocket reviewed
- [ ] All 18 frontend page files reviewed
- [ ] All shared frontend components reviewed
- [ ] Types match between frontend and backend
- [ ] No security vulnerabilities found (or all found ones are documented)
- [ ] No data integrity risks found
- [ ] Error handling is consistent across all layers
- [ ] All known architectural decisions are respected
