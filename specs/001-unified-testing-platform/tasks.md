# Tasks: Unified Local Testing Platform

**Input**: Design documents from `/specs/001-unified-testing-platform/`
**Prerequisites**: plan.md (required), spec.md (required), data-model.md, contracts/, research.md

**Tests**: The constitution mandates TDD (NON-NEGOTIABLE). Test tasks are included per the Test-First Development principle.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create project structure with package.json, tsconfig.json, and directory layout per plan.md
- [x] T002 Install dependencies: playwright, artillery, better-sqlite3, commander, ink, pdf-parse, mammoth, marked, uuid, vitest
- [x] T003 [P] Configure ESLint with strict TypeScript rules in eslint.config.js
- [x] T004 [P] Configure Prettier in .prettierrc with project formatting standards
- [x] T005 [P] Configure Vitest test runner in vitest.config.ts with TypeScript path aliases
- [x] T006 [P] Add .gitignore entries for node_modules/, .ctt/, dist/, test-results/, *.db
- [x] T007 Create package.json scripts: build, test, lint, format, and bin entry pointing to dist/cli/index.js
- [x] T008 Create deliberately vulnerable sample app in tests/fixtures/sample-app/ for self-testing

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

### Shared Types & Errors

- [x] T009 Define all shared TypeScript types and interfaces in src/shared/types.ts (Session, TestCase, ExecutionResult, ApprovalGate, SecurityFinding, PerformanceMetric, AuditLog, Phase, Status enums)
- [x] T010 [P] Create structured error classes with actionable messages in src/shared/errors.ts (ModuleError, ConfigError, SessionError, ExecutionError, IngestionError)
- [x] T011 [P] Implement structured logger with configurable levels and output formats in src/shared/logger.ts

### Database Layer

- [x] T012 Create SQLite schema definitions for all 8 entities in src/db/schema.ts per data-model.md
- [x] T013 Implement schema migration system in src/db/migrations.ts (version tracking, up/down migrations)
- [x] T014 [P] Create SessionRepository in src/db/repositories/session-repo.ts with CRUD and state queries
- [x] T015 [P] Create TestCaseRepository in src/db/repositories/test-case-repo.ts with CRUD, filter, and tag queries
- [x] T016 [P] Create ExecutionResultRepository in src/db/repositories/execution-result-repo.ts with CRUD and failure queries
- [x] T017 [P] Create ApprovalGateRepository in src/db/repositories/approval-gate-repo.ts with CRUD and pending queries
- [x] T018 [P] Create SecurityFindingRepository in src/db/repositories/security-finding-repo.ts with CRUD and severity queries
- [x] T019 [P] Create AuditLogRepository in src/db/repositories/audit-log-repo.ts with insert-only and export queries

### Configuration

- [x] T020 Implement configuration loading and validation in src/core/config.ts (ctt.config.ts and ctt.config.json support, defineConfig helper, schema validation with typed output)

### Module Registry

- [x] T021 Implement ModuleRegistry with register, getByPhase, getAll, initializeAll, cleanupAll in src/modules/module-registry.ts per contracts/module-api.md

### CLI Entry Point

- [x] T022 Create CLI entry point with Commander.js program setup in src/cli/index.ts (register global options --format, --config, --verbose)
- [x] T023 [P] Implement output formatter supporting JSON, terminal, and JUnit formats in src/cli/output.ts

**Checkpoint**: Foundation ready — user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Human-Approved Phased Test Execution (Priority: P1) MVP

**Goal**: Implement the core human-in-the-loop phased workflow: document ingestion, test generation, approval gates, phased execution, session resumption, and audit logging

**Independent Test**: Upload a sample document, generate tests, walk through approval gates, verify execution halts at each gate, resume an interrupted session, and export the audit trail

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T024 [P] [US1] Unit test for Session state machine transitions in tests/unit/core/session.test.ts
- [x] T025 [P] [US1] Unit test for ApprovalGate approval/rejection logic in tests/unit/core/approval-gate.test.ts
- [x] T026 [P] [US1] Unit test for AuditLog insert-only immutability and export in tests/unit/core/audit-log.test.ts
- [x] T027 [P] [US1] Unit test for document ingestion parsing (PDF, DOCX, TXT, MD) in tests/unit/modules/ingestion.test.ts
- [x] T028 [P] [US1] Unit test for Runner phase orchestration with gate enforcement in tests/unit/core/runner.test.ts

### Core Engine for User Story 1

- [x] T029 [US1] Implement Session state machine with INGESTION→GENERATION→FUNCTIONAL→PERFORMANCE→SECURITY→COMPLETE transitions in src/core/session.ts (depends on T009, T014)
- [x] T030 [US1] Implement ApprovalGate with approve/reject/skip actions and comment recording in src/core/approval-gate.ts (depends on T017)
- [x] T031 [US1] Implement AuditLog with insert-only recording and export functionality in src/core/audit-log.ts (depends on T019)
- [x] T032 [US1] Implement Runner that orchestrates module execution through phase state machine in src/core/runner.ts (depends on T021, T029, T030, T031)

### Ingestion Module for User Story 1

- [x] T033 [US1] Define ingestion types (ParsedDocument, DocumentSection, TestCaseDefinition) in src/modules/ingestion/types.ts
- [x] T034 [US1] Implement document parsing for all formats (PDF via pdf-parse, DOCX via mammoth, TXT direct, MD via marked) in src/modules/ingestion/ingester.ts
- [x] T035 [US1] Implement test case extraction from parsed documents with section classification in src/modules/ingestion/generators/prompt-builder.ts
- [x] T036 [US1] Implement functional test case generator producing JSON test definitions in src/modules/ingestion/generators/functional-generator.ts

### CLI Commands for User Story 1

- [x] T037 [US1] Implement `ctt init` command creating session, config file, and database in src/cli/commands/init.ts
- [x] T038 [US1] Implement `ctt session` command with create, resume, status, list, export subcommands in src/cli/commands/session.ts
- [x] T039 [US1] Implement `ctt ingest <files...>` command uploading and parsing documents in src/cli/commands/ingest.ts
- [x] T040 [US1] Implement `ctt generate [phase]` command triggering test generation from ingested documents in src/cli/commands/generate.ts
- [x] T041 [US1] Implement `ctt review` command with list, show, edit, approve, reject subcommands in src/cli/commands/review.ts
- [x] T042 [US1] Implement `ctt report` command with summary, functional, performance, security, audit subcommands in src/cli/commands/report.ts
- [x] T043 [US1] Implement `ctt run` command with basic all-or-phase execution in src/cli/commands/run.ts (single browser only for US1)

**Checkpoint**: User Story 1 should be fully functional — can ingest documents, generate tests, review/approve, execute functional tests (single browser), and export audit trail

---

## Phase 4: User Story 2 - Selective On-Demand Test Execution (Priority: P2)

**Goal**: Enable running individual test cases, filtered subsets, and re-running failed tests without full suite execution

**Independent Test**: Create test cases, select and run individual ones, filter by tag, re-run only failures, verify no unselected tests execute

### Tests for User Story 2

- [x] T044 [P] [US2] Unit test for selective test filtering by ID, tag, and failed status in tests/unit/cli/run-command.test.ts
- [x] T045 [P] [US2] Unit test for dry-run mode showing what would execute in tests/unit/cli/run-command.test.ts

### Implementation for User Story 2

- [x] T046 [US2] Add selective execution logic to `ctt run` command supporting test-id args, --filter, --failed, --dry-run flags in src/cli/commands/run.ts (update T043)
- [x] T047 [US2] Add query methods to TestCaseRepository for filtering by tags and failed status in src/db/repositories/test-case-repo.ts (update T015)
- [x] T048 [US2] Add query methods to ExecutionResultRepository for retrieving failed test IDs in src/db/repositories/execution-result-repo.ts (update T016)

**Checkpoint**: User Stories 1 AND 2 should both work independently — can selectively run specific tests

---

## Phase 5: User Story 3 - Cross-Browser Functional Testing (Priority: P3)

**Goal**: Execute functional tests across Chromium, Firefox, and WebKit with full browser context isolation, failure screenshots, network logging, and per-browser reporting

**Independent Test**: Point at sample app, run tests across all three browsers, verify fresh context per test, screenshots on failure, unified per-browser report

### Tests for User Story 3

- [x] T049 [P] [US3] Unit test for BrowserManager context isolation (fresh state per test) in tests/unit/modules/browser-manager.test.ts
- [x] T050 [P] [US3] Integration test for cross-browser functional execution in tests/integration/functional-execution.test.ts using sample app

### Implementation for User Story 3

- [x] T051 [US3] Define functional module types (BrowserType, BrowserContext, TestStep, TestAssertion) in src/modules/functional/types.ts
- [x] T052 [US3] Implement BrowserManager with per-test context creation, screenshot capture, and network logging in src/modules/functional/browser-manager.ts
- [x] T053 [US3] Implement FunctionalModule executor interpreting JSON test definitions via Playwright in src/modules/functional/executor.ts (depends on T052)
- [x] T054 [US3] Register FunctionalModule with ModuleRegistry and update `ctt run` to support --browsers flag in src/modules/module-registry.ts and src/cli/commands/run.ts
- [x] T055 [US3] Add per-browser result aggregation to report command in src/cli/commands/report.ts (update T042)

**Checkpoint**: User Stories 1, 2, AND 3 should all work independently — full cross-browser functional testing with isolation

---

## Phase 6: User Story 4 - Local Load & Performance Metrics (Priority: P4)

**Goal**: Convert functional test scripts into load scenarios, execute via Artillery in a worker thread, capture percentile metrics, and validate against SLA thresholds

**Independent Test**: Convert functional tests to load scenario, run against sample app, verify p50/p90/p95/p99 metrics, SLA pass/fail reporting

### Tests for User Story 4

- [x] T056 [P] [US4] Unit test for functional-to-load scenario converter in tests/unit/modules/converter.test.ts
- [x] T057 [P] [US4] Unit test for SLA validator with threshold checking in tests/unit/modules/sla-validator.test.ts
- [x] T058 [P] [US4] Integration test for load test execution with metric capture in tests/integration/performance-execution.test.ts

### Implementation for User Story 4

- [x] T059 [US4] Define performance module types (LoadConfig, LoadScenario, SLAThreshold, SLAValidationResult) in src/modules/performance/types.ts
- [x] T060 [US4] Implement converter transforming JSON test definitions into Artillery scenario format in src/modules/performance/converter.ts
- [x] T061 [US4] Implement metric collector computing p50/p90/p95/p99, throughput, and error rates in src/modules/performance/metrics.ts
- [x] T062 [US4] Implement SLA validator comparing metrics against configurable thresholds in src/modules/performance/sla-validator.ts (depends on T061)
- [x] T063 [US4] Implement PerformanceModule executor running Artillery in a worker thread with progress reporting in src/modules/performance/executor.ts (depends on T060, T061)
- [x] T064 [US4] Register PerformanceModule with ModuleRegistry and wire `ctt generate performance` and `ctt run --phase performance` in src/modules/module-registry.ts and src/cli/commands/
- [x] T065 [US4] Add performance report with SLA status and percentile breakdowns to report command in src/cli/commands/report.ts

**Checkpoint**: User Stories 1-4 all work independently — full functional + performance testing pipeline

---

## Phase 7: User Story 5 - Integrated DAST Security Scanning (Priority: P5)

**Goal**: Route browser traffic through OWASP ZAP for passive scanning during functional tests, run active scans on authenticated routes, and report categorized findings

**Independent Test**: Run functional tests against deliberately vulnerable sample app with DAST enabled, verify passive and active findings detected, severity categorization

### Tests for User Story 5

- [x] T066 [P] [US5] Unit test for ZAP proxy lifecycle management in tests/unit/modules/proxy-manager.test.ts
- [x] T067 [P] [US5] Unit test for security finding processing and severity categorization in tests/unit/modules/findings.test.ts
- [x] T068 [P] [US5] Integration test for DAST scanning against deliberately vulnerable sample app in tests/integration/security-execution.test.ts

### Implementation for User Story 5

- [x] T069 [US5] Define security module types (ProxyConfig, AuthContext, ScanType, Severity) in src/modules/security/types.ts
- [x] T070 [US5] Implement ProxyManager controlling ZAP daemon lifecycle via REST API in src/modules/security/proxy-manager.ts
- [x] T071 [US5] Implement passive scanner coordinating with ProxyManager during functional test execution in src/modules/security/passive-scanner.ts (depends on T070)
- [x] T072 [US5] Implement auth handler managing session tokens and cookies for authenticated scanning in src/modules/security/auth-handler.ts
- [x] T073 [US5] Implement active scanner triggering ZAP active scan via API with auth context in src/modules/security/active-scanner.ts (depends on T070, T072)
- [x] T074 [US5] Implement findings processor mapping ZAP alerts to categorized SecurityFinding entities in src/modules/security/findings.ts
- [x] T075 [US5] Implement SecurityModule integrating passive scan, active scan, auth handler, and findings in src/modules/security/index.ts (depends on T071, T073, T074)
- [x] T076 [US5] Register SecurityModule with ModuleRegistry, wire `ctt generate security`, `ctt run --phase security`, and proxy integration in src/modules/module-registry.ts
- [x] T077 [US5] Add security report with severity-categorized findings and evidence to report command in src/cli/commands/report.ts

**Checkpoint**: All 5 user stories are independently functional — complete testing platform

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T078 [P] Add connectivity check before test execution with clear error messages in src/modules/functional/executor.ts
- [x] T079 [P] Add browser crash detection and recovery with errored (not failed) status in src/modules/functional/browser-manager.ts
- [x] T080 [P] Add ZAP proxy startup validation with abort/proceed-without option in src/modules/security/proxy-manager.ts
- [x] T081 [P] Add unsupported document format rejection with clear error listing supported formats in src/modules/ingestion/ingester.ts
- [x] T082 [P] Add session export to JSON and HTML formats for compliance review in src/cli/commands/session.ts
- [x] T083 [P] Add README.md with installation, usage, and architecture overview
- [x] T084 [P] Validate quickstart.md scenarios work end-to-end against sample app
- [x] T085 Build and validate the complete CLI binary distribution

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US1 (P1) must complete first — provides core session/runner/gate infrastructure
  - US2 (P2) depends on US1 — extends the run command
  - US3 (P3) depends on US1 — adds browser automation to the functional module
  - US4 (P4) depends on US3 — converts functional tests into load scenarios
  - US5 (P5) depends on US3 — routes functional test traffic through security proxy
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational (Phase 2) — no dependencies on other stories
- **US2 (P2)**: Depends on US1 — extends run command and repositories
- **US3 (P3)**: Depends on US1 — adds functional module that runner orchestrates
- **US4 (P4)**: Depends on US3 — converts functional test definitions into load scenarios
- **US5 (P5)**: Depends on US3 — integrates security proxy with functional test execution

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Types before implementation
- Core engine before CLI commands
- Module implementation before registration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T003-T006)
- All repository tasks in Foundational marked [P] can run in parallel (T014-T019)
- All test tasks within a user story marked [P] can run in parallel
- US4 and US5 can be developed in parallel after US3 completes (different modules)

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together:
Task T024: "Unit test for Session state machine in tests/unit/core/session.test.ts"
Task T025: "Unit test for ApprovalGate in tests/unit/core/approval-gate.test.ts"
Task T026: "Unit test for AuditLog in tests/unit/core/audit-log.test.ts"
Task T027: "Unit test for document ingestion in tests/unit/modules/ingestion.test.ts"
Task T028: "Unit test for Runner phase orchestration in tests/unit/core/runner.test.ts"

# After tests fail, implement core engine (sequential):
Task T029 → T030 → T031 → T032

# Then implement ingestion module and CLI commands:
Task T033 → T034 → T035 → T036 (ingestion chain)
Task T037-T043 (CLI commands, can overlap with ingestion)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T008)
2. Complete Phase 2: Foundational (T009-T023)
3. Complete Phase 3: User Story 1 (T024-T043)
4. **STOP and VALIDATE**: Test full workflow — ingest → generate → review → approve → run → report
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Test independently → **MVP!** (phased workflow with single-browser functional tests)
3. Add US2 → Test independently → Selective execution available
4. Add US3 → Test independently → Cross-browser testing
5. Add US4 → Test independently → Load/performance testing
6. Add US5 → Test independently → DAST security scanning
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

After US1 is complete and US3 is complete:

- Developer A: User Story 4 (Performance)
- Developer B: User Story 5 (Security)
- These can proceed in parallel as they use different modules

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (TDD per constitution)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- The constitution requires TDD — test tasks are NOT optional for this project
