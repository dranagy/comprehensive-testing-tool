# Implementation Plan: Unified Local Testing Platform

**Branch**: `001-unified-testing-platform` | **Date**: 2026-04-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-unified-testing-platform/spec.md`

## Summary

Build a unified, locally-hosted testing platform that combines functional UI testing, load/performance testing, and Dynamic Application Security Testing (DAST) into a single human-in-the-loop workflow. The platform uses Playwright as the core browser automation engine, reuses functional test scripts for load generation via Artillery, and integrates OWASP ZAP as a local security proxy. Every testing phase requires explicit human approval before proceeding, with full audit traceability and resumable sessions.

## Technical Context

**Language/Version**: TypeScript 5.x with strict mode on Node.js 20 LTS
**Primary Dependencies**: Playwright (browser automation), Artillery (load testing), OWASP ZAP (DAST proxy), Ink or equivalent TUI library (CLI interface)
**Storage**: SQLite via better-sqlite3 (local test results, session state, audit log, document metadata)
**Testing**: Vitest (unit), Playwright Test (integration/E2E self-testing)
**Target Platform**: Windows/macOS/Linux desktop (local execution)
**Project Type**: CLI application with optional TUI dashboard
**Performance Goals**: Individual test results within 5 seconds of completion; selective test run startup < 10 seconds; session resume < 30 seconds
**Constraints**: Fully local/offline-capable; no cloud dependencies; single-user sessions; browser contexts must be fully isolated
**Scale/Scope**: ~5 test modules (core, functional, performance, security, document-ingestion); ~15-20 source files initially; supports test suites of 100-500+ cases

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Question-Driven AI Agent Execution | PASS | Agent asks at each approval gate; spec clarifies workflow |
| II. Explicit Patterns & Structured Development | PASS | Modular architecture with clear boundaries between modules |
| III. Modularity-First Architecture | PASS | Core runner + pluggable modules (functional, perf, security, ingestion) |
| IV. Developer Experience (DX) Priority | PASS | CLI with `ctt <module> <action>` pattern; typed config; actionable errors |
| V. Test-First Development | PASS | TDD enforced; tool dogfoods its own testing capabilities |
| VI. Comprehensive Coverage | PASS | Covers unit, integration, API, UI/E2E, load/perf, security testing |
| VII. Performance & SLA Enforcement | PASS | SLA validation built into performance module; non-blocking architecture |
| VIII. Security & DevSecOps | PASS | DAST integrated; continuous security; secure coding patterns required |

**Gate Result**: ALL PASS — proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/001-unified-testing-platform/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── cli-commands.md  # CLI command contracts
│   └── module-api.md    # Module interface contracts
├── checklists/          # Quality checklists
│   └── requirements.md
└── tasks.md             # Phase 2 output (via /speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── core/                        # Core runner and session management
│   ├── runner.ts                # Test orchestrator / phase engine
│   ├── session.ts               # Session state management
│   ├── approval-gate.ts         # Approval gate logic
│   ├── audit-log.ts             # Audit trail recording
│   └── config.ts                # Configuration loading/validation
├── modules/
│   ├── ingestion/               # Document ingestion module
│   │   ├── ingester.ts          # Document parsing and context extraction
│   │   ├── generators/          # Test case generation from documents
│   │   │   ├── functional-generator.ts
│   │   │   └── prompt-builder.ts
│   │   └── types.ts
│   ├── functional/              # Functional testing module (Playwright)
│   │   ├── executor.ts          # Test execution engine
│   │   ├── browser-manager.ts   # Browser context lifecycle (isolation)
│   │   ├── selectors/           # Page object / component structures
│   │   └── types.ts
│   ├── performance/             # Performance/load testing module
│   │   ├── converter.ts         # Functional tests → load scenarios
│   │   ├── executor.ts          # Load test execution via Artillery
│   │   ├── metrics.ts           # Metric collection (p50/p90/p95/p99)
│   │   ├── sla-validator.ts     # SLA threshold checking
│   │   └── types.ts
│   ├── security/                # DAST security testing module
│   │   ├── proxy-manager.ts     # OWASP ZAP proxy lifecycle
│   │   ├── passive-scanner.ts   # Passive scan coordination
│   │   ├── active-scanner.ts    # Active scan execution
│   │   ├── auth-handler.ts      # Session/credential management
│   │   ├── findings.ts          # Vulnerability result processing
│   │   └── types.ts
│   └── module-registry.ts       # Module discovery and registration
├── cli/
│   ├── index.ts                 # CLI entry point (ctt command)
│   ├── commands/                # Individual CLI commands
│   │   ├── init.ts              # ctt init
│   │   ├── session.ts           # ctt session create/resume/status
│   │   ├── ingest.ts            # ctt ingest <files...>
│   │   ├── generate.ts          # ctt generate [functional|perf|security]
│   │   ├── review.ts            # ctt review [approve|reject|edit]
│   │   ├── run.ts               # ctt run [all|<test-id>...|--filter]
│   │   └── report.ts            # ctt report [export]
│   └── output.ts                # Output formatting (JSON, terminal, JUnit)
├── db/
│   ├── schema.ts                # SQLite schema definitions
│   ├── migrations.ts            # Schema migration management
│   └── repositories/            # Data access layer
│       ├── session-repo.ts
│       ├── test-case-repo.ts
│       ├── execution-result-repo.ts
│       ├── approval-gate-repo.ts
│       ├── security-finding-repo.ts
│       └── audit-log-repo.ts
├── shared/
│   ├── types.ts                 # Shared type definitions
│   ├── errors.ts                # Error classes with actionable messages
│   └── logger.ts                # Structured logging
└── index.ts                     # Package entry point

tests/
├── unit/
│   ├── core/
│   ├── modules/
│   └── cli/
├── integration/
│   ├── functional-execution.test.ts
│   ├── performance-execution.test.ts
│   └── security-execution.test.ts
└── fixtures/
    ├── sample-app/              # Deliberately vulnerable test app
    ├── sample-docs/             # Sample ingestion documents
    └── sample-configs/          # Sample configuration files
```

**Structure Decision**: Single project layout. The platform is a unified CLI tool with all modules under `src/modules/`. Shared infrastructure (session management, audit, config) lives in `src/core/`. Data access is isolated in `src/db/`. Tests mirror the source structure with unit, integration, and fixture directories.

## Complexity Tracking

No constitution violations to justify.

## Phase 0: Research

### R-001: Playwright Browser Context Isolation Best Practices

**Decision**: Use Playwright's `browser.newContext()` for each test case, creating a completely fresh browser context with no cookies, cache, or storage from prior tests. Launch browsers at module initialization and create/destroy contexts per test.

**Rationale**: Playwright natively supports this pattern. Context creation is fast (<50ms). This satisfies the strict isolation requirement without the overhead of launching a new browser process per test.

**Alternatives Considered**:
- Launch new browser per test: Too slow (~2-3s per launch), wasteful of resources
- Shared context with cleanup: Risk of state leakage between tests; violates idempotency principle
- Incognito/private mode: Not directly supported; context isolation achieves the same result

### R-002: Artillery Integration for Local Load Testing

**Decision**: Use Artillery as a Node.js library (not CLI) to programmatically create load scenarios from functional test definitions. Convert Playwright test steps into Artillery flow definitions using a converter module.

**Rationale**: Artillery provides a programmatic API (`@artillery/core`) that can be embedded directly without subprocess management. It supports custom engine plugins for complex flows. Running as a library gives full control over lifecycle and metrics collection.

**Alternatives Considered**:
- k6 (Grafana): Requires separate runtime (Go); adds deployment complexity
- Locust: Python-based; conflicts with TypeScript stack
- Custom load generator: Significant effort to match Artillery's metric collection and reporting

### R-003: OWASP ZAP Integration Pattern

**Decision**: Bundle ZAP as a managed subprocess with the platform controlling its lifecycle via the ZAP API (REST). Start ZAP in daemon mode, configure the proxy, route Playwright traffic through it, then trigger scans via API calls.

**Rationale**: ZAP's REST API provides full programmatic control including passive scanning, active scanning, and report generation. Daemon mode runs headlessly without GUI overhead. The API returns structured JSON results that can be processed and categorized by severity.

**Alternatives Considered**:
- Browser proxy configuration only: No active scanning capability
- Burp Suite: Commercial; not suitable for bundling
- Custom proxy with manual rules: Would not match ZAP's extensive vulnerability detection rules

### R-004: Session Persistence and Resumability

**Decision**: Use SQLite with a session state table that captures the complete workflow state at each approval gate. On resume, the platform queries the latest checkpoint, restores session configuration, and presents pending approvals.

**Rationale**: SQLite is serverless, file-based, and supports ACID transactions — ideal for local single-user scenarios. Session state is naturally relational (sessions → test cases → execution results → approvals). No external database service needed.

**Alternatives Considered**:
- JSON file-based state: No transactional safety; risk of corruption on crash
- IndexedDB (browser): Not applicable — this is a Node.js CLI application
- In-memory only: Cannot survive process restarts; violates resumability requirement

### R-005: Document Ingestion and Test Generation

**Decision**: Accept documents in PDF, DOCX, TXT, and Markdown formats. Parse each format to extract text, then use a structured template-based approach to convert manual test cases and behavioral descriptions into executable Playwright test definitions. Generated tests are stored as JSON test definitions (not raw code) that the functional executor interprets.

**Rationale**: Storing tests as data (JSON definitions) rather than generated source code enables editing via the review interface and selective execution. It also decouples test generation from test execution, supporting the human-in-the-loop review requirement.

**Alternatives Considered**:
- Direct code generation: Users would need to review/edit TypeScript code; higher friction
- LLM-based generation: Adds external dependency; violates offline-capable constraint
- Template-only approach: Less flexible; cannot handle varied document formats

### R-006: Phased Execution Engine Architecture

**Decision**: Implement a state machine with five states: `INGESTION` → `GENERATION` → `FUNCTIONAL` → `PERFORMANCE` → `SECURITY`. Each state transition requires passing through an approval gate. The state machine persists its current state to SQLite, enabling resumability.

**Rationale**: A state machine provides clear, auditable phase transitions. Each state encapsulates its own logic and data. The approval gates are natural transition points. State persistence makes resumability trivial — just reload the current state.

**Alternatives Considered**:
- Pipeline pattern: Less explicit about approval gates; harder to represent pausing
- Event-driven: Over-engineered for sequential phased execution
- Simple linear script: No resumability or audit trail

### R-007: CLI Framework Selection

**Decision**: Use Commander.js for CLI argument parsing and command routing, combined with a custom TUI layer using Ink (React-based terminal UI) for interactive review sessions and dashboards.

**Rationale**: Commander.js is the most widely used CLI framework for Node.js with excellent TypeScript support. Ink provides React-style component composition for rich terminal interfaces, enabling interactive review screens (test case listing, approval prompts, progress displays).

**Alternatives Considered**:
- yargs: Comparable to Commander.js; less intuitive chaining API
- Inquirer.js: Good for prompts but limited for full-screen TUI
- chalk + blessed: Lower-level; more control but significantly more effort

### R-008: Non-Blocking Architecture for Load Testing

**Decision**: Run load test execution in a separate worker thread using Node.js `worker_threads`. The main thread remains responsive for progress reporting and cancellation. Metrics are communicated via message passing.

**Rationale**: Worker threads share the same process but run on separate event loops. This prevents the CPU-intensive load generation from blocking the CLI's responsiveness. Message passing enables real-time progress updates.

**Alternatives Considered**:
- Child processes: Higher overhead; more complex IPC
- Async iterators: Insufficient for CPU-bound load generation
- Cluster module: Designed for HTTP servers, not general task parallelism

## Phase 1: Design & Contracts

### Data Model

See [data-model.md](./data-model.md) for entity definitions, fields, relationships, validation rules, and state transitions.

### Contracts

See [contracts/](./contracts/) for interface definitions:
- [contracts/cli-commands.md](./contracts/cli-commands.md) — CLI command schemas
- [contracts/module-api.md](./contracts/module-api.md) — Module registration and interaction API

### Quickstart

See [quickstart.md](./quickstart.md) for getting started guide.

## Post-Design Constitution Re-Check

| Principle | Status | Post-Design Notes |
|-----------|--------|-------------------|
| I. Question-Driven AI Agent | PASS | Approval gates serve as question/confirm points |
| II. Explicit Patterns | PASS | Module interfaces are explicit and typed |
| III. Modularity-First | PASS | Each testing capability is an independent module |
| IV. DX Priority | PASS | CLI pattern `ctt <module> <action>`; typed config; structured errors |
| V. Test-First | PASS | Test fixtures include deliberately vulnerable sample app for self-testing |
| VI. Comprehensive Coverage | PASS | All six testing categories supported |
| VII. Performance & SLA | PASS | Worker threads for non-blocking; SLA validator built-in |
| VIII. Security & DevSecOps | PASS | ZAP integration covers DAST; continuous scanning in pipeline |

**Gate Result**: ALL PASS — plan is ready for task generation.
