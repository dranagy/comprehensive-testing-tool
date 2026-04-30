# Research: Unified Local Testing Platform

**Branch**: `001-unified-testing-platform` | **Date**: 2026-04-28

## R-001: Playwright Browser Context Isolation

**Decision**: Use `browser.newContext()` for each test case with fresh state.

**Rationale**: Playwright contexts are lightweight (~50ms creation), fully isolated (separate cookies, cache, storage), and natively supported. Browsers launch once per module lifecycle; contexts are created/destroyed per test.

**Alternatives Considered**:
- New browser per test: ~2-3s overhead per launch
- Shared context + cleanup: State leakage risk
- Incognito mode: Not a Playwright concept; context isolation achieves same result

**Key Implementation Details**:
- Use `browser.newContext()` with explicit options (no default state)
- Call `context.close()` after each test in finally block
- Launch browsers (`chromium.launch()`, `firefox.launch()`, `webkit.launch()`) at module init
- Capture screenshots on failure via `page.screenshot()` in error handler
- Record network via `page.on('request')` and `page.on('response')` event listeners

## R-002: Artillery Integration for Load Testing

**Decision**: Use Artillery as an embedded Node.js library via `@artillery/core`.

**Rationale**: Programmatic API avoids subprocess overhead. Supports custom engine plugins for complex flows. Full control over lifecycle, metrics, and error handling within the same process.

**Alternatives Considered**:
- k6: Requires Go runtime; deployment complexity
- Locust: Python; conflicts with TypeScript stack
- Custom generator: Significant effort to match mature metric collection

**Key Implementation Details**:
- Install `artillery` as dependency (provides `@artillery/core`)
- Converter module transforms Playwright test definitions into Artillery scenario YAML/JSON
- Artillery runs in a worker thread to avoid blocking
- Metrics collected via Artillery's built-in engine: response times, throughput, error rates, percentiles
- Custom Artillery engine plugin may be needed for complex multi-step flows

## R-003: OWASP ZAP Integration

**Decision**: Manage ZAP as a subprocess in daemon mode, controlled via ZAP REST API.

**Rationale**: ZAP's API provides complete programmatic control: session management, passive scanning, active scanning, alert retrieval, and report generation. Daemon mode runs headlessly. JSON responses are easy to parse and categorize.

**Alternatives Considered**:
- Browser proxy only: No active scanning
- Burp Suite: Commercial, not bundlable
- Custom security proxy: Cannot match ZAP's extensive vulnerability rule set

**Key Implementation Details**:
- ZAP binary must be installed locally (document as prerequisite or bundle)
- Start: `zap.sh -daemon -port 8080 -config api.key=<generated>`
- Configure Playwright proxy: `browser.newContext({ proxy: { server: 'http://localhost:8080' } })`
- Passive scan: Automatic when traffic routes through proxy; retrieve via `/JSON/ascan/view/scans/`
- Active scan: Trigger via `/JSON/ascan/action/scan/` with target URL and context
- Auth: Create ZAP context with authentication method; use session tokens from functional tests
- Results: `/JSON/core/view/alerts/` returns structured alerts with severity, category, evidence
- Cleanup: `/JSON/core/action/shutdown/`

## R-004: Session Persistence (SQLite)

**Decision**: SQLite via `better-sqlite3` for all persistent state.

**Rationale**: Serverless, file-based, ACID-compliant. Perfect for local single-user tool. Zero external dependencies. Synchronous API (`better-sqlite3`) simplifies code and avoids callback complexity.

**Alternatives Considered**:
- JSON files: No transactional safety; corruption risk
- IndexedDB: Browser-only, not applicable
- In-memory: No persistence; violates resumability

**Key Implementation Details**:
- Database file: `.ctt/sessions.db` in project root (gitignored)
- Schema managed via migration system in `src/db/migrations.ts`
- Tables: sessions, test_cases, execution_results, approval_gates, security_findings, audit_log, context_documents
- Session state stored as JSON blob in sessions table for flexible checkpoint restore
- WAL mode for better concurrent read performance

## R-005: Document Ingestion Pipeline

**Decision**: Multi-format parser (PDF, DOCX, TXT, MD) extracting structured test definitions stored as JSON data.

**Rationale**: Storing tests as data (not code) enables visual editing, selective execution, and decouples generation from execution. Template-based conversion is deterministic and offline-capable.

**Alternatives Considered**:
- Direct code generation: Users edit TypeScript; high friction
- LLM generation: External dependency; violates offline constraint
- Manual-only: Defeats the purpose of automation

**Key Implementation Details**:
- PDF: `pdf-parse` library for text extraction
- DOCX: `mammoth` library for text extraction
- TXT/MD: Direct read with Markdown parsing via `marked`
- Output format: JSON test definition schema with fields: id, name, description, steps[], assertions[], source_document, phase
- Steps contain: action (click, type, navigate, wait), selector, value, description
- Assertions contain: type (visible, text, url, status), expected, selector

## R-006: Phased Execution State Machine

**Decision**: Five-state machine with approval gates at each transition.

**Rationale**: State machine provides clear, auditable transitions. Each state is self-contained. Approval gates are natural transition points. State persistence enables resumability.

**State Diagram**:
```
INGESTION → GENERATION → [APPROVE] → FUNCTIONAL → [APPROVE] → PERFORMANCE → [APPROVE] → SECURITY → COMPLETE
                              ↑              |                    |                   |
                              └── [REJECT] ──┘                    |                   |
                                              └── [REJECT] ───────┘                   |
                                                                                      └── [REJECT]
```

**States**:
1. `INGESTION`: Document upload and parsing
2. `GENERATION`: Test case generation from documents
3. `FUNCTIONAL`: Functional test execution (Playwright)
4. `PERFORMANCE`: Load/performance testing (Artillery)
5. `SECURITY`: DAST scanning (OWASP ZAP)
6. `COMPLETE`: All phases done; reports available

**Transitions**: Each forward transition requires an approval gate with logged user action.

## R-007: CLI Framework (Commander.js + Ink)

**Decision**: Commander.js for command routing + Ink for interactive TUI elements.

**Rationale**: Commander.js is battle-tested with excellent TypeScript support. Ink enables rich terminal UIs using React paradigms — perfect for interactive review screens, progress bars, and test result displays.

**Key Implementation Details**:
- Entry point: `src/cli/index.ts` registers all commands
- Command pattern: `ctt <command> [subcommand] [options]`
- Interactive modes: Ink components for review sessions, progress displays
- Output formats: `--format json|terminal|junit` flag on relevant commands
- Config file: `ctt.config.ts` (TypeScript) or `ctt.config.json` with full type safety

## R-008: Non-Blocking Load Testing (Worker Threads)

**Decision**: Use Node.js `worker_threads` for load test execution.

**Rationale**: Worker threads run on separate event loops, preventing CPU-intensive load generation from blocking the CLI. Message passing enables real-time progress updates without polling.

**Key Implementation Details**:
- Load test runner spawns a worker thread with the Artillery scenario
- Main thread receives periodic metric updates via `parentPort.postMessage()`
- Worker reports: current VU count, requests sent, errors encountered, elapsed time
- Cancellation: Main thread can terminate worker via `worker.terminate()`
- Results: Worker posts final aggregated metrics on completion
