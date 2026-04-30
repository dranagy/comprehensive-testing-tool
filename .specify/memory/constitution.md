<!--
Sync Impact Report:
- Version change: 1.0.0 → 1.1.0
- Modified principles:
  - III. Test-First Development → expanded with isolation, idempotency, single-assertion rules
  - IV. Comprehensive Coverage → expanded with CI/CD readiness, modularity standards
  - V. Performance and Reliability → expanded with SLA enforcement, throughput floors, non-blocking ops
  - New: Security & DevSecOps promoted to a full core principle (was a sub-item of IV)
- Added sections:
  - I. Question-Driven AI Agent Execution (new principle)
  - II. Explicit Patterns & Structured Development (new principle)
  - VIII. Security & DevSecOps Standards (NON-NEGOTIABLE) (new core principle)
  - Performance & SLA Requirements (new dedicated section)
- Removed sections: None
- Templates requiring updates:
  ✅ constitution-template.md (source — no changes needed)
  ✅ spec-template.md (reviewed — compatible, no changes required)
  ✅ plan-template.md (reviewed — Constitution Check section compatible)
  ✅ tasks-template.md (reviewed — task categorization compatible)
  ✅ command templates (reviewed — no agent-specific name issues)
- Follow-up TODOs: None
-->

# Comprehensive Testing Tool Constitution

## Core Principles

### I. Question-Driven AI Agent Execution

The AI coding agent MUST ask clarifying questions at each step before
finalizing any specification, technical plan, or code block. No artifact
MAY be treated as complete until the agent has confirmed that no context
is missing. Ambiguity MUST be resolved through targeted questions rather
than assumptions.

**Rationale**: Unvalidated assumptions accumulate into architectural
mistakes. A single clarifying question early prevents costly rework later.

### II. Explicit Patterns & Structured Development

All generated code MUST follow explicit, demonstrative patterns. The
agent MUST NOT rely on assumed context — every instruction MUST be clear
and unambiguous. Every development task MUST be isolated into its own
commit following a standardized template (type(scope): description) to
maintain a clean, traceable history.

**Rationale**: Implicit knowledge does not scale across team members or
sessions. Explicit patterns ensure reproducibility and reduce onboarding
friction. Structured commits enable precise bisecting and rollback.

### III. Modularity-First Architecture

Every testing capability (unit, integration, API, UI/E2E, load/performance,
security) MUST be implemented as an independent, pluggable module.
Modules MUST be self-contained, independently testable, and documented.
No module MAY depend on another module's internal implementation — only
through public APIs. The core runner orchestrates modules but does not
embed them.

**Rationale**: A comprehensive tool serving many testing needs risks
becoming a monolith. Modularity ensures each capability can evolve, be
replaced, or be omitted without affecting others.

### IV. Developer Experience (DX) Priority

The CLI and configuration MUST be intuitive, consistent, and discoverable.
All commands follow a uniform pattern: `ctt <module> <action> [target]`.
Configuration files use TypeScript (with JSON fallback) and MUST provide
full type safety and autocompletion. Error messages MUST be actionable —
never just a stack trace. Output MUST support structured JSON,
human-readable terminal, and JUnit/XML report formats.

**Rationale**: Testing tools are only effective when developers actually
use them. Friction in setup, configuration, or interpreting results
directly reduces test coverage.

### V. Test-First Development (NON-NEGOTIABLE)

All features MUST be developed using strict TDD: write tests first, get
user approval, verify tests fail (red), then implement (green), then
refactor. Every module MUST ship with its own test suite. The
comprehensive testing tool itself MUST be its own first customer — it
MUST be tested using its own testing capabilities wherever feasible.

Additionally:
- **Test Isolation & Idempotency**: All automated tests MUST be
  completely independent, idempotent (no unintended side effects such as
  persisting data to a database), and deterministic (same input always
  yields the same result).
- **Single Assertion Focus**: Tests MUST strive to maintain one primary
  assertion per test case to simplify debugging and error isolation.
- **Test Modularity**: The testing architecture MUST heavily modularize
  tests (e.g., using page objects or component-based structures) and
  enforce strict separation between production code and test code.

**Rationale**: A testing tool that is not itself rigorously tested
undermines trust. Isolation and determinism prevent false positives.
Single-assertion tests provide pinpoint failure diagnostics.

### VI. Comprehensive Coverage

The tool MUST support these testing categories, each as a first-class
module:
- **Unit Testing**: Fast, isolated, deterministic tests with mocking
  support
- **Integration Testing**: Service-to-service communication, database,
  and shared schema validation
- **API Testing**: REST/GraphQL endpoint validation, contract testing,
  schema conformance
- **UI / E2E Testing**: Browser automation, visual regression,
  accessibility checks, cross-browser support
- **Load / Performance Testing**: Throughput, latency percentiles,
  stress testing, configurable ramp-up scenarios
- **Security Testing**: OWASP top-10 scanning, dependency vulnerability
  auditing, input fuzzing, auth/authorization validation

Each module MUST produce standardized results that the core runner can
aggregate into unified reports.

**Rationale**: "Comprehensive" is the project's namesake. No category is
a second-class citizen — each must meet production-quality standards.

### VII. Performance, Reliability & SLA Enforcement

Tests MUST run fast. Unit tests MUST complete in under 10ms each. The
runner MUST support parallel execution by default with deterministic
ordering when requested. Flaky tests MUST be identified, isolated, and
reported — never silently retried past the configured threshold. Memory
and CPU usage during test runs MUST be monitored and reported.

Additionally:
- **Strict SLA Enforcement**: The architecture MUST validate and report
  against Service Level Agreements, including Availability/Uptime,
  Maximum Response Time (e.g., p95 ≤ 2s under load), and maximum Error
  Rates.
- **Throughput Floors**: The tool MUST sustain minimum transaction rates
  and gracefully handle peak concurrency without severe degradation.
- **Non-Blocking Operations**: Core services MUST be optimized for speed
  — heavy load generation or reporting tasks MUST NOT block the main
  application threads.

**Rationale**: Slow or unreliable test suites get disabled or skipped.
SLA enforcement transforms testing from a development tool into a
business reliability instrument.

### VIII. Security & DevSecOps Standards (NON-NEGOTIABLE)

Security MUST be baked into every layer of development and CI/CD — never
treated as a final gatekeeper before deployment.

- **Continuous Security (Defense in Depth)**: Security validation MUST
  execute continuously within the CI/CD pipeline, not as a one-time
  pre-deployment gate.
- **Dynamic Security Testing (DAST)**: The tool MUST support or
  facilitate Dynamic Application Security Testing to simulate real-world
  attacks (XSS, SQL injection, etc.) on running applications,
  complementing traditional static analysis.
- **Authenticated Flow Coverage**: Security and functional testing
  modules MUST accurately handle and maintain complex authenticated
  sessions to test protected routes effectively.
- **Secure AI Code Generation**: The AI agent MUST proactively prevent
  vulnerabilities during code generation. All generated code MUST adhere
  to secure coding patterns to prevent injection flaws, unauthorized
  access, and credential leakage from the start.

**Rationale**: Security is not a feature — it is a constraint on every
feature. Integrating security continuously catches vulnerabilities
earlier and cheaper than post-deployment remediation.

## Technology Standards

- **Runtime**: Node.js (current LTS)
- **Language**: TypeScript with strict mode enabled (`"strict": true`)
- **Package Manager**: npm (with lockfile committed)
- **Module System**: ESM (`"type": "module"`) with CJS compatibility for
  module entry points
- **Code Quality**: ESLint + Prettier enforced via pre-commit hooks
- **Minimum Node.js**: v20.x
- **Browser Automation**: Playwright (for UI/E2E module)
- **CI/CD Compatibility**: MUST work in GitHub Actions, GitLab CI,
  Jenkins, and local development without modification
- **CI/CD Readiness**: The framework MUST natively support continuous
  integration pipelines, accept configurations via environment variables,
  and return strict exit codes based on success or failure

## Development Workflow

- **Branching**: Feature branches with conventional commit messages
  (`feat:`, `fix:`, `test:`, `docs:`, `refactor:`)
- **Structured Commits**: Every task MUST be isolated into its own commit
  following the standardized template
- **Code Review**: All changes require review; constitution compliance is
  a mandatory review item
- **Quality Gates**: No PR may merge with failing tests, linting errors,
  or type errors
- **Documentation**: Every public API and CLI command MUST have
  documentation before merge
- **Changelog**: CHANGELOG.md updated with every feature-level change
- **Breaking Changes**: MUST be flagged in commit messages and PR
  descriptions; migration guide required

## Governance

This constitution is the supreme authority for all development decisions
within the comprehensive-testing-tool project. When practices conflict
with principles, principles win.

- **Amendments**: Require documentation of the change, rationale,
  approval by project lead, and a migration plan for affected code
- **Compliance**: All PRs and reviews MUST verify compliance with these
  principles
- **Complexity**: Any deviation from simplicity (YAGNI) MUST be justified
  in writing
- **Guidance**: Runtime development guidance is maintained in `CLAUDE.md`
  and `.specify/memory/` artifacts

**Version**: 1.1.0 | **Ratified**: 2026-04-28 | **Last Amended**: 2026-04-28
