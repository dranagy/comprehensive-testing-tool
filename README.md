# Comprehensive Testing Tool (CTT)

A unified local testing platform combining functional, performance, and DAST security testing with a human-in-the-loop approval workflow. Includes both a **CLI** and a **web-based dashboard** for managing the entire testing lifecycle.

**Repository:** [github.com/dranagy/comprehensive-testing-tool](https://github.com/dranagy/comprehensive-testing-tool)

## Features

- **Document-driven test generation** — ingest PDF, DOCX, Markdown, or plain text and auto-generate test cases
- **Phased workflow with approval gates** — INGESTION → GENERATION → FUNCTIONAL → PERFORMANCE → SECURITY → COMPLETE
- **Cross-browser functional testing** — Chromium, Firefox, WebKit via Playwright with per-test context isolation
- **Load & performance testing** — functional tests converted to Artillery scenarios with SLA validation (p50/p90/p95/p99)
- **DAST security scanning** — OWASP ZAP integration for passive and active scanning with severity-categorized findings
- **Selective execution** — run specific tests, filter by tag, re-run failures, dry-run mode
- **Full audit trail** — insert-only audit log for compliance review, export to JSON or HTML
- **Session resumption** — interrupt and resume sessions at any approval gate
- **Web dashboard** — Next.js 16 + React 19 + Tailwind CSS v4 frontend with interactive charts, real-time WebSocket progress, toast notifications, and session-scoped navigation
- **REST API** — Express 5 server with 23 endpoints + WebSocket for live test progress

## Installation

```bash
# From source
git clone https://github.com/dranagy/comprehensive-testing-tool.git
cd comprehensive-testing-tool
npm install
npm run build

# Install frontend dependencies
cd frontend
npm install

# Use CLI globally
cd ..
npm link
ctt --help
```

## Quick Start

### CLI

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

### Web UI

```bash
# Terminal 1 — Start the API server
ctt serve --port 3456

# Terminal 2 — Start the frontend
cd frontend
npm run dev
```

Open http://localhost:3000 to use the web dashboard for creating sessions, uploading documents, reviewing tests, running tests, and viewing interactive reports.

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
| `ctt serve` | Start the REST API server for the web UI |

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
├── api/                    # Express 5 REST API + WebSocket
│   ├── server.ts           # App setup, route mounting, error handler
│   ├── routes/             # sessions, ingest, generate, review, run, reports, config
│   ├── middleware/          # Session resolver, error handler
│   └── db.ts               # Database connection shared across API routes
├── core/                   # Core engine
│   ├── session.ts          # Session state machine (phase transitions)
│   ├── approval-gate.ts    # Human-in-the-loop approval gates
│   ├── audit-log.ts        # Insert-only audit logging
│   ├── runner.ts           # Module orchestration through phase pipeline
│   └── config.ts           # Configuration loading and validation
├── db/                     # SQLite persistence layer (BetterSQLite3)
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

frontend/                    # Next.js 16 web dashboard
├── src/
│   ├── app/                # 18 page routes (App Router)
│   │   ├── page.tsx                         # Dashboard
│   │   ├── settings/                        # Settings
│   │   ├── sessions/new/                    # Create session
│   │   └── sessions/[sessionId]/            # Session pages
│   │       ├── page.tsx                     # Session detail
│   │       ├── ingest/                      # Document upload
│   │       ├── test-cases/                  # Test case list/detail/edit
│   │       ├── approval/                    # Approval gates
│   │       ├── run/                         # Test execution + progress
│   │       ├── reports/                     # 5 report views
│   │       └── export/                      # Session export
│   ├── components/
│   │   ├── layout/         # AppShell, Sidebar, TopBar
│   │   └── ui/             # Button, StatusBadge, Toast, ErrorBoundary, etc.
│   └── lib/
│       ├── api-client.ts   # Typed API client (all endpoints)
│       ├── session-context.tsx  # Session state management
│       └── types.ts        # Frontend type definitions
└── package.json

tests/                       # 247 tests across 26 files
├── unit/                    # Core, modules, CLI, API routes, WebSocket
├── integration/             # Full workflow, error paths, execution tests
├── fixtures/                # Sample docs, configs, test app
└── helpers/                 # Test database utilities
```

## Development

```bash
# Backend
npm run build          # Compile TypeScript
npm test               # Run all tests (247 tests, 26 files)
npm run test:watch     # Watch mode

# Frontend
cd frontend
npm run dev            # Development server (http://localhost:3000)
npm run build          # Production build

# Both servers together
ctt serve              # Terminal 1: API on port 3456
cd frontend && npm run dev  # Terminal 2: Frontend on port 3000
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sessions` | List all sessions |
| POST | `/api/sessions` | Create a session |
| GET | `/api/sessions/:id` | Get session details |
| POST | `/api/sessions/:id/resume` | Resume a session |
| POST | `/api/sessions/:id/advance` | Advance to next phase |
| GET | `/api/sessions/:id/export` | Export session data |
| POST | `/api/ingest/:id/upload` | Upload documents (multipart) |
| POST | `/api/generate/:id` | Generate all test phases |
| POST | `/api/generate/:id/:phase` | Generate tests by phase |
| GET | `/api/review/:id/test-cases` | List test cases |
| GET | `/api/review/:id/test-cases/:tid` | Get test case detail |
| PUT | `/api/review/:id/test-cases/:tid` | Update test case |
| POST | `/api/review/:id/approve` | Approve test cases |
| POST | `/api/review/:id/test-cases/:tid/reject` | Reject a test case |
| GET | `/api/review/:id/gates` | List approval gates |
| POST | `/api/review/:id/gates/:phase` | Resolve approval gate |
| POST | `/api/run/:id/run` | Start test execution |
| POST | `/api/run/:id/run/:rid/cancel` | Cancel a running test |
| GET | `/api/reports/:id/summary` | Summary report |
| GET | `/api/reports/:id/functional` | Functional report |
| GET | `/api/reports/:id/performance` | Performance report |
| GET | `/api/reports/:id/security` | Security report |
| GET | `/api/reports/:id/audit` | Audit trail |
| GET | `/api/config` | Get configuration |
| PUT | `/api/config` | Update configuration |
| POST | `/api/config/reset` | Reset to defaults |
| GET | `/api/health` | Health check |
| WS | `/ws?runId=:rid` | WebSocket progress stream |

## License

MIT
