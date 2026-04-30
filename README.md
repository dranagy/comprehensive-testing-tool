# @ctt/cli — Comprehensive Testing Tool

A unified local testing platform combining functional, performance, and DAST security testing with a human-in-the-loop approval workflow.

## Features

- **Document-driven test generation** — ingest PDF, DOCX, Markdown, or plain text and auto-generate test cases
- **Phased workflow with approval gates** — INGESTION → GENERATION → FUNCTIONAL → PERFORMANCE → SECURITY → COMPLETE
- **Cross-browser functional testing** — Chromium, Firefox, WebKit via Playwright with per-test context isolation
- **Load & performance testing** — functional tests converted to Artillery scenarios with SLA validation (p50/p90/p95/p99)
- **DAST security scanning** — OWASP ZAP integration for passive and active scanning with severity-categorized findings
- **Selective execution** — run specific tests, filter by tag, re-run failures, dry-run mode
- **Full audit trail** — insert-only audit log for compliance review, export to JSON or HTML
- **Session resumption** — interrupt and resume sessions at any approval gate

## Installation

```bash
# From source
git clone <repo-url>
cd comprehensive-testing-tool
npm install
npm run build

# Use globally
npm link
ctt --help
```

## Quick Start

```bash
# 1. Initialize a project
ctt init --target http://localhost:3000

# 2. Ingest test documents
ctt ingest ./test-cases.md

# 3. Generate functional tests
ctt generate functional

# 4. Review and approve
ctt review approve functional

# 5. Run tests
ctt run --phase functional

# 6. View reports
ctt report summary
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `ctt init` | Create project config and database |
| `ctt session create/list/resume/status/export` | Manage testing sessions |
| `ctt ingest <files...>` | Parse documents and extract test definitions |
| `ctt generate [phase]` | Generate test cases (functional, performance, security) |
| `ctt review list/show/edit/approve/reject` | Review and approve generated tests |
| `ctt run [ids...]` | Execute tests with filtering and selection options |
| `ctt report [type]` | Generate reports (summary, functional, performance, security, audit) |

### Run Options

```bash
ctt run --phase functional          # Run all approved tests in a phase
ctt run <test-id>                   # Run specific test(s)
ctt run --filter smoke,integration  # Run tests matching tags
ctt run --failed                    # Re-run previously failed tests
ctt run --dry-run                   # Show what would execute
ctt run --browser firefox           # Override browser
ctt run --session <session-id>      # Target a specific session
```

## Configuration

Create `ctt.config.ts` in your project root:

```typescript
import { defineConfig } from "@ctt/cli";

export default defineConfig({
  target: "http://localhost:3000",
  browsers: ["chromium", "firefox"],
  performance: {
    virtualUsers: 50,
    rampUpSeconds: 30,
    durationSeconds: 120,
    sla: {
      responseTimeP95Ms: 2000,
      errorRateMax: 0.01,
      throughputMinRps: 100,
    },
  },
  security: {
    zapPath: "/usr/share/zap/zap.sh",
    passiveScan: true,
    activeScan: true,
    severityThreshold: "MEDIUM",
  },
  output: {
    format: "terminal",
    screenshots: true,
    networkLogs: true,
  },
});
```

## Architecture

```
src/
├── cli/                    # Commander.js CLI entry point and commands
│   ├── commands/           # init, session, ingest, generate, review, run, report
│   └── output.ts           # JSON, terminal, JUnit output formatters
├── core/                   # Core engine
│   ├── session.ts          # Session state machine (phase transitions)
│   ├── approval-gate.ts    # Human-in-the-loop approval gates
│   ├── audit-log.ts        # Insert-only audit logging
│   ├── runner.ts           # Module orchestration through phase pipeline
│   └── config.ts           # Configuration loading and validation
├── db/                     # SQLite persistence layer
│   ├── schema.ts           # Table definitions (8 entities)
│   ├── migrations.ts       # Schema version tracking
│   └── repositories/       # CRUD repositories for each entity
├── modules/
│   ├── functional/         # Playwright-based cross-browser testing
│   │   ├── browser-manager.ts   # Browser lifecycle and context isolation
│   │   └── executor.ts          # FunctionalModule (TestingModule)
│   ├── performance/        # Artillery-based load testing
│   │   ├── converter.ts         # Functional → Artillery scenario conversion
│   │   ├── metrics.ts           # Percentile aggregation (p50/p90/p95/p99)
│   │   ├── sla-validator.ts     # SLA threshold validation
│   │   └── executor.ts          # PerformanceModule (TestingModule)
│   ├── security/           # OWASP ZAP DAST scanning
│   │   ├── proxy-manager.ts     # ZAP daemon lifecycle via REST API
│   │   ├── passive-scanner.ts   # Passive scan coordination
│   │   ├── active-scanner.ts    # Active scan with auth context
│   │   ├── findings.ts          # ZAP alert → SecurityFinding processing
│   │   └── index.ts             # SecurityModule (TestingModule)
│   ├── ingestion/          # Document parsing and test extraction
│   │   ├── ingester.ts          # PDF, DOCX, TXT, MD parsing
│   │   └── generators/          # Functional test generation
│   └── module-registry.ts  # Module registration and discovery
└── shared/
    ├── types.ts            # All TypeScript type definitions
    ├── errors.ts           # Structured error classes
    └── logger.ts           # Structured logging
```

## Development

```bash
npm run build          # Compile TypeScript
npm test               # Run all tests
npm run test:watch     # Watch mode
npm run lint           # ESLint
npm run format         # Prettier
```

## License

MIT
