# Comprehensive Testing Tool — User Guide

## Table of Contents

- [Introduction](#introduction)
- [Architecture Overview](#architecture-overview)
- [Installation](#installation)
- [Getting Started](#getting-started)
- [Web UI Guide](#web-ui-guide)
  - [Starting the Web UI](#starting-the-web-ui)
  - [Dashboard](#dashboard)
  - [Creating a Session](#creating-a-session)
  - [Session Detail](#session-detail)
  - [Uploading Documents](#uploading-documents)
  - [Reviewing Test Cases](#reviewing-test-cases)
  - [Approving Tests](#approving-tests)
  - [Running Tests](#running-tests)
  - [Viewing Reports](#viewing-reports)
  - [Settings](#settings)
- [CLI Reference](#cli-reference)
  - [Global Options](#global-options)
  - [ctt init](#ctt-init)
  - [ctt session](#ctt-session)
  - [ctt ingest](#ctt-ingest)
  - [ctt generate](#ctt-generate)
  - [ctt review](#ctt-review)
  - [ctt run](#ctt-run)
  - [ctt report](#ctt-report)
  - [ctt serve](#ctt-serve)
- [REST API Reference](#rest-api-reference)
  - [Authentication](#authentication)
  - [Sessions](#sessions-api)
  - [Ingest](#ingest-api)
  - [Generate](#generate-api)
  - [Review](#review-api)
  - [Run](#run-api)
  - [Reports](#reports-api)
  - [Configuration](#configuration-api)
  - [Health Check](#health-check-api)
  - [WebSocket Progress](#websocket-progress-api)
- [Configuration Reference](#configuration-reference)
- [Workflows](#workflows)
  - [Phased Workflow](#phased-workflow)
  - [Session Resumption](#session-resumption)
  - [Selective Execution](#selective-execution)
  - [CI/CD Integration](#cicd-integration)
- [Understanding Results](#understanding-results)
  - [Execution Statuses](#execution-statuses)
  - [SLA Validation](#sla-validation)
  - [Security Findings](#security-findings)
  - [Report Formats](#report-formats)
- [Troubleshooting](#troubleshooting)

---

## Introduction

The Comprehensive Testing Tool (`ctt`) is a unified local testing platform that combines functional, performance, and DAST security testing into a single human-in-the-loop workflow. It provides both a **command-line interface (CLI)** and a **web-based dashboard** for managing the entire testing lifecycle.

**Key capabilities:**

- **Document-driven test generation** — ingest PDF, DOCX, Markdown, or plain text files and automatically generate executable test cases
- **Phased workflow with approval gates** — each testing phase requires explicit human approval before proceeding, giving you full control over what runs
- **Cross-browser functional testing** — execute tests across Chromium, Firefox, and WebKit via Playwright with complete browser isolation
- **Load and performance testing** — convert functional test scripts into load scenarios with percentile metrics and SLA validation
- **DAST security scanning** — route traffic through OWASP ZAP for passive and active vulnerability scanning with severity-categorized findings
- **Full audit trail** — every action is logged with timestamps in an insert-only audit log, suitable for compliance review
- **Real-time progress** — WebSocket-based live progress updates during test execution
- **Interactive reports** — charts, tables, and severity breakdowns in the web UI

The tool runs entirely locally. No data is sent to external services.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    User Interfaces                   │
│  ┌──────────────┐              ┌──────────────────┐ │
│  │  CLI (ctt)   │              │  Web UI (Next.js) │ │
│  │  Commander.js│              │  React + Tailwind │ │
│  └──────┬───────┘              └────────┬─────────┘ │
│         │                               │            │
├─────────┼───────────────────────────────┼────────────┤
│         │      REST API (Express 5)     │            │
│         │   ┌───────────────────────┐   │            │
│         └──►│  /api/sessions        │◄──┘            │
│             │  /api/ingest          │                │
│             │  /api/generate        │                │
│             │  /api/review          │                │
│             │  /api/run             │◄── WebSocket   │
│             │  /api/reports         │    (ws://)     │
│             │  /api/config          │                │
│             │  /api/health          │                │
│             └───────────┬───────────┘                │
│                         │                            │
├─────────────────────────┼────────────────────────────┤
│                  Core Business Logic                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│  │   Session     │ │   Approval   │ │  Audit Log   │ │
│  │   Manager     │ │    Gates     │ │  (insert)    │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│  │  Functional   │ │ Performance  │ │  Security    │ │
│  │  (Playwright) │ │ (Artillery)  │ │  (OWASP ZAP) │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ │
│                         │                            │
├─────────────────────────┼────────────────────────────┤
│              SQLite Database (.ctt/sessions.db)       │
│  sessions │ test_cases │ execution_results │ findings│
│  gates    │ audit_log  │ config            │         │
└─────────────────────────────────────────────────────┘
```

**Technology Stack:**

| Layer | Technology | Version |
|-------|-----------|---------|
| CLI | Commander.js | 13.x |
| Web Frontend | Next.js + React + Tailwind CSS v4 | 16.x / 19.x |
| API Server | Express | 5.x |
| WebSocket | ws | 8.x |
| Database | BetterSQLite3 | 11.x |
| Functional Testing | Playwright | 1.52+ |
| Performance Testing | Artillery | 2.x |
| Security Testing | OWASP ZAP | 2.14+ |
| Charts | Recharts | 3.x |

---

## Installation

### Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Node.js | 20+ (LTS recommended) | Runtime environment |
| npm | 9+ | Package manager |
| Playwright browsers | Latest | Functional testing (installed separately) |
| OWASP ZAP | 2.14+ | Security scanning (optional) |

### Install from Source

```bash
git clone <repo-url>
cd comprehensive-testing-tool
npm install
npm run build
```

### Make Available Globally

```bash
npm link
ctt --help
```

### Install Frontend Dependencies

```bash
cd frontend
npm install
```

### Install Playwright Browsers

Required for functional and cross-browser testing:

```bash
npx playwright install
```

For Chromium only (faster, sufficient for most uses):

```bash
npx playwright install chromium
```

### Install OWASP ZAP (Optional)

Only needed for DAST security scanning:

- **Windows**: Download from [zaproxy.org](https://www.zaproxy.org/)
- **macOS**: `brew install --cask owasp-zap`
- **Linux**: Download or use package manager

---

## Getting Started

This walkthrough covers the complete workflow from project creation to report generation using both the CLI and the Web UI.

### Quick Start (CLI)

```bash
# 1. Initialize a project
ctt init --target http://localhost:3000 --name "My App Tests" --browsers chromium,firefox

# 2. Ingest documents
ctt ingest ./docs/user-guide.pdf ./tests/manual-cases.md

# 3. Generate and approve functional tests
ctt generate functional
ctt review approve functional

# 4. Run functional tests
ctt run --phase functional

# 5. Continue through phases
ctt generate performance
ctt review approve performance
ctt run --phase performance

# 6. View reports
ctt report summary
```

### Quick Start (Web UI)

```bash
# 1. Start the API server
ctt serve --port 3456

# 2. In a new terminal, start the frontend
cd frontend
npm run dev
```

Then open http://localhost:3000 in your browser and use the web interface to create sessions, upload documents, review tests, run them, and view interactive reports.

---

## Web UI Guide

### Starting the Web UI

The web UI requires two servers running simultaneously:

**Terminal 1 — API Server:**
```bash
ctt serve --port 3456
```

Options:
| Option | Default | Description |
|--------|---------|-------------|
| `-p, --port` | 3456 | API server port |
| `-H, --host` | localhost | Host to bind to |

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

The frontend runs on http://localhost:3000 by default and connects to the API at http://localhost:3456.

To use a different API URL, set the environment variable:
```bash
NEXT_PUBLIC_API_URL=http://my-server:3456/api npm run dev
```

### Dashboard

**Route:** `/`

The dashboard provides an at-a-glance overview of all testing sessions:

- **Total Sessions** — count of all sessions
- **Active Sessions** — sessions not yet in COMPLETE phase
- **Last Run Pass Rate** — pass percentage from the most recent session
- **Sessions Table** — lists all sessions with name, target URL, status, and creation date. Click a session name to navigate to its detail page.

### Creating a Session

**Route:** `/sessions/new`

Create a new testing session with:

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| Session Name | No | Auto-generated | A human-readable name |
| Target URL | Yes | — | URL of the application under test |
| Browsers | No | chromium | Select from Chromium, Firefox, WebKit |
| Performance Config | No | 10 users / 30s ramp / 60s duration | Load testing parameters |
| SLA Thresholds | No | Disabled | Response time, error rate, throughput limits |
| Security Config | No | Passive scan enabled | ZAP path, scan types, severity threshold |
| Output Config | No | JSON format, screenshots on | Export format and artifact settings |

After creation, you're redirected to the session detail page.

### Session Detail

**Route:** `/sessions/[sessionId]`

Displays the complete state of a testing session:

- **Phase Progress Bar** — visual indicator of the current phase (INGESTION through COMPLETE)
- **Test Count Cards** — number of functional, performance, and security test cases
- **Pending Approval Gates** — phase gates awaiting review with links to the approval page
- **Execution Summary** — passed/failed/error/skipped counts with stat cards
- **Quick Action Button** — contextual action based on current phase (e.g., "Upload Documents" when in INGESTION, "View Reports" when COMPLETE)
- **Advance Phase** — manually skip to the next phase

### Uploading Documents

**Route:** `/sessions/[sessionId]/ingest`

Upload test documentation for automatic test case generation:

1. **Drag and drop** files onto the drop zone, or **click to browse**
2. Supported formats: PDF (`.pdf`), Word (`.docx`), Plain text (`.txt`), Markdown (`.md`)
3. Files are uploaded to the API and parsed automatically
4. Uploaded documents appear in a list showing file name, format, and number of tests generated
5. If the session has already passed the INGESTION phase, a status indicator shows the current phase

### Reviewing Test Cases

**Route:** `/sessions/[sessionId]/test-cases`

Browse and manage all generated test cases:

- **Phase Tabs** — filter by Functional, Performance, or Security tests (or view All)
- **Status Filter** — filter by approval status (GENERATED, MODIFIED, APPROVED, REJECTED, SKIPPED)
- **Bulk Selection** — checkbox column with select-all; bulk approve selected tests
- **Click a test** to view its full details (steps, assertions, edit history)

**Test Case Detail** (`/sessions/[sessionId]/test-cases/[testId]`):
- Steps displayed with action icons (click, type, navigate, wait, select, submit)
- Assertions shown with type badge and expected value
- Edit history timeline
- Approve / Reject buttons with confirmation dialog

**Edit Test Case** (`/sessions/[sessionId]/test-cases/[testId]/edit`):
- Reorder steps with up/down arrows
- Add/remove steps and assertions
- Select action type and assertion type from dropdowns
- Save changes (tracked in edit history, status becomes MODIFIED)

### Approving Tests

**Route:** `/sessions/[sessionId]/approval`

Manage approval gates for each testing phase:

- Each phase (FUNCTIONAL, PERFORMANCE, SECURITY) has a gate card with color-coded left border
- Gates show current status (PENDING, APPROVED, REJECTED, SKIPPED)
- Pending gates offer:
  - **Optional comment** — textarea for review notes
  - **Approve** — allow tests in this phase to execute
  - **Reject** — block execution with reason
  - **Skip** — skip this phase entirely

### Running Tests

**Route:** `/sessions/[sessionId]/run`

Configure and start test execution:

**Test Selection:**

| Mode | Description |
|------|-------------|
| All approved tests | Runs every test with APPROVED status |
| By phase | Run only FUNCTIONAL, PERFORMANCE, or SECURITY tests |
| Specific tests | Select individual tests from a list |
| Failed only | Re-run tests that previously failed |
| By tag | Run tests matching comma-separated tags |

**Configuration:**

| Option | Default | Description |
|--------|---------|-------------|
| Browser | From config | Override browser for this run |
| Parallel Workers | 1 | Number of concurrent test workers |
| Timeout (ms) | 30000 | Maximum time per test |
| Dry Run | Off | Show what would run without executing |

After clicking **Run Tests**, you're redirected to the progress page.

**Run Progress** (`/sessions/[sessionId]/run/[runId]`):
- Real-time WebSocket updates showing each test starting, passing, or failing
- Overall progress percentage
- Live summary counters (passed/failed/errored/skipped)
- Automatic redirect to reports when complete

### Viewing Reports

All reports are accessed under `/sessions/[sessionId]/reports/`:

#### Summary Report (`/reports/summary`)
- Stat cards: Total Tests, Pass Rate, Security Findings, SLA Status
- SVG donut chart showing test distribution by phase
- Execution breakdown with progress bars for passed/failed/error/skipped
- Links to individual report pages

#### Functional Report (`/reports/functional`)
- Bar chart showing test result distribution (Passed/Failed/Error/Skipped)
- Duration distribution histogram
- Status and browser filters
- Expandable table rows showing error messages on click

#### Performance Report (`/reports/performance`)
- SLA Pass/Fail card with breach count
- Average duration and total results cards
- Line chart showing response time percentiles (p50, p90, p95, p99)
- Area chart showing throughput (requests/second)
- Error rate trend line chart
- Metrics table with status, duration, and SLA per test

#### Security Report (`/reports/security`)
- Severity distribution donut chart (Recharts PieChart)
- Summary cards for each severity level (CRITICAL, HIGH, MEDIUM, LOW, INFORMATIONAL)
- Severity filter dropdown
- Findings table with severity badge, title, URL, scan type, and category
- "No findings" success state with green checkmark

#### Audit Trail (`/reports/audit`)
- Vertical timeline with color-coded dots and action badges
- Filter by action type
- Expandable entries showing full JSON details
- Color coding: create (green), update (blue), delete (red), approve (green), reject (red), run (blue), upload (purple), generate (cyan)

### Settings

**Route:** `/settings`

Global configuration with save/reset functionality:

- **General**: Default target URL, browser selection
- **Performance Defaults**: Virtual users, ramp-up time, test duration
- **Security Defaults**: ZAP path, passive/active scan toggles
- **Output Defaults**: Export format (JSON/HTML), screenshots, network logs

---

## CLI Reference

### Global Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--format <format>` | string | `terminal` | Output format: `json`, `terminal`, `junit` |
| `--config <path>` | string | auto-detect | Path to configuration file |
| `--verbose` | flag | off | Enable verbose logging |
| `-V, --version` | flag | — | Print version number |
| `-h, --help` | flag | — | Display help for command |

---

### ctt init

Initialize a new testing project in the current directory.

```bash
ctt init --target <url> [options]
```

**Options:**

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `--target <url>` | Yes | — | Target application URL |
| `--name <name>` | No | Current directory name | Project and session name |
| `--browsers <list>` | No | `chromium` | Comma-separated list of browsers |

**What it creates:**
- `ctt.config.json` with the provided settings
- `.ctt/` directory with `sessions.db` SQLite database
- A new session in INGESTION phase

**Example:**

```bash
ctt init --target http://localhost:3000 --name "E-commerce App" --browsers chromium,firefox,webkit
```

---

### ctt session

Manage testing sessions. Sessions track the complete lifecycle of a testing engagement.

#### session create

```bash
ctt session create [--target <url>]
```

Uses the target URL from `ctt.config.json` unless overridden with `--target`.

#### session list

```bash
ctt session list
```

Displays session ID, name, current phase, target URL, and creation date.

#### session status

```bash
ctt session status
```

Shows test counts by phase, pending approval gates, and execution summary for the latest session.

#### session resume

```bash
ctt session resume <session-id>
```

Restores the session to its last known phase, including all prior test results and pending approvals.

#### session export

```bash
ctt session export <session-id> [--format json|html] [--output <path>]
```

| Option | Default | Description |
|--------|---------|-------------|
| `--format` | `json` | Export format (`json` or `html`) |
| `--output <path>` | stdout | Write to file instead of console |

The export includes session metadata, all test cases, execution results, and the full audit trail.

---

### ctt ingest

Upload and parse documents for test generation.

```bash
ctt ingest <files...> [--session <id>]
```

| Argument/Option | Required | Default | Description |
|-----------------|----------|---------|-------------|
| `<files...>` | Yes | — | One or more document file paths |
| `--session <id>` | No | Latest session | Target session ID |

**Supported formats:**

| Format | Extension | Parser |
|--------|-----------|--------|
| PDF | `.pdf` | pdf-parse |
| Word | `.docx` | mammoth |
| Plain text | `.txt` | Direct read |
| Markdown | `.md`, `.markdown` | marked |

**Example:**

```bash
ctt ingest ./docs/user-guide.pdf ./tests/smoke-tests.md ./docs/api-spec.txt
```

---

### ctt generate

Generate test cases from ingested documents.

```bash
ctt generate [phase] [--session <id>]
```

| Argument/Option | Default | Description |
|-----------------|---------|-------------|
| `[phase]` | `functional` | Phase to generate: `functional`, `performance`, or `security` |
| `--session <id>` | Latest session | Target session ID |

**Behavior by phase:**

| Phase | Behavior |
|-------|----------|
| `functional` | Reports count of test cases already created during ingestion |
| `performance` | Derives performance test scenarios from existing functional tests |
| `security` | Creates passive and active scan configuration test cases |

Generated tests have status `GENERATED` and must be approved before execution.

---

### ctt review

Review, edit, and approve generated test cases.

#### review list

```bash
ctt review list [--phase <phase>]
```

#### review show

```bash
ctt review show <test-id>
```

Shows steps, assertions, approval status, tags, and edit history.

#### review edit

```bash
ctt review edit <test-id>
```

Opens the test case in your system's default editor. Changes are tracked in the edit history and the status is updated to `MODIFIED`.

#### review approve

```bash
ctt review approve [phase] [--all]
```

| Option | Description |
|--------|-------------|
| `[phase]` | Approve all tests in a specific phase |
| `--all` | Approve all pending tests across all phases |

#### review reject

```bash
ctt review reject <test-id> [--reason <text>]
```

---

### ctt run

Execute approved test cases.

```bash
ctt run [testIds...] [options]
```

**Options:**

| Option | Default | Description |
|--------|---------|-------------|
| `--phase <phase>` | — | Run all approved tests in the given phase |
| `--browser <name>` | From config | Override browser for this run |
| `--filter <tags>` | — | Run tests matching comma-separated tags |
| `--failed` | off | Re-run only previously failed tests |
| `--dry-run` | off | Show what would execute without running |
| `--parallel <n>` | 1 | Number of parallel workers |
| `--timeout <ms>` | 30000 | Test timeout in milliseconds |
| `--session <id>` | Latest session | Target session ID |

**Execution priority:**

1. Test IDs provided → runs only those specific tests
2. `--failed` → re-runs tests with FAILED or ERROR status
3. `--filter` → runs approved tests matching any of the specified tags
4. `--phase` → runs all approved tests in the given phase
5. No flags → runs all approved tests in the session

**Examples:**

```bash
# Run all approved tests
ctt run

# Run only functional tests
ctt run --phase functional

# Run specific tests by ID
ctt run abc-123 def-456

# Re-run failures
ctt run --failed

# Preview without executing
ctt run --phase functional --dry-run
```

**Engine by phase:**

| Phase | Engine | Description |
|-------|--------|-------------|
| Functional | Playwright | Browser automation with context isolation |
| Performance | Artillery | Load scenarios derived from functional tests |
| Security | OWASP ZAP | Passive and active DAST scanning |

---

### ctt report

Generate and export test reports.

```bash
ctt report [type] [--format <format>] [--output <path>]
```

| Argument | Default | Description |
|----------|---------|-------------|
| `[type]` | `summary` | Report type: `summary`, `functional`, `performance`, `security`, `audit` |

| Option | Default | Description |
|--------|---------|-------------|
| `--format <format>` | `terminal` | Output format: `terminal`, `json`, `junit` |
| `--output <path>` | stdout | Write to file |

**Examples:**

```bash
ctt report summary
ctt report functional --format json --output ./reports/functional.json
ctt report functional --format junit --output ./results.xml
ctt report security --format json
```

---

### ctt serve

Start the REST API server for the Web UI.

```bash
ctt serve [-p <port>] [-H <host>]
```

| Option | Default | Description |
|--------|---------|-------------|
| `-p, --port <number>` | 3456 | Port to listen on |
| `-H, --host <string>` | localhost | Host to bind to |

The server exposes:
- REST API at `http://<host>:<port>/api/*`
- WebSocket at `ws://<host>:<port>/ws?runId=<runId>`
- Health check at `http://<host>:<port>/api/health`

---

## REST API Reference

### Authentication

The API currently has no authentication. It is designed for local use only. Do not expose the API server to the public internet.

**Base URL:** `http://localhost:3456/api`

**Common Headers:**
```
Content-Type: application/json
```

**Error Response Format:**
```json
{
  "error": "Error message describing what went wrong",
  "details": {}
}
```

**HTTP Status Codes:**

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request (invalid input) |
| 404 | Resource not found |
| 500 | Internal server error |

---

### Sessions API

**Base path:** `/api/sessions`

#### List Sessions

```
GET /api/sessions
```

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "My Session",
    "status": "FUNCTIONAL",
    "targetUrl": "http://localhost:3000",
    "config": { ... },
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z",
    "resumedFrom": null,
    "testCounts": { "functional": 10, "performance": 10, "security": 2 },
    "pendingGates": [ ... ],
    "executionSummary": { "total": 22, "passed": 20, "failed": 1, "errored": 0, "skipped": 1 }
  }
]
```

#### Create Session

```
POST /api/sessions
```

**Body:**
```json
{
  "name": "Optional name",
  "targetUrl": "http://localhost:3000",
  "config": {
    "browsers": ["chromium"],
    "performance": { "virtualUsers": 10, "rampUpSeconds": 30, "durationSeconds": 60 }
  }
}
```

**Response:** Full session object with `201` status.

#### Get Session

```
GET /api/sessions/:sessionId
```

**Response:** Full session object including testCounts, pendingGates, and executionSummary.

#### Resume Session

```
POST /api/sessions/:sessionId/resume
```

Restores the session to its last known phase.

#### Advance Session Phase

```
POST /api/sessions/:sessionId/advance
```

Moves the session to the next phase in the workflow.

#### Export Session

```
GET /api/sessions/:sessionId/export
```

**Response:** Complete session export including all test cases, results, and audit trail.

---

### Ingest API

**Base path:** `/api/ingest`

#### Upload Documents

```
POST /api/ingest/:sessionId/upload
Content-Type: multipart/form-data
```

**Body:** Form data with `files` field containing one or more documents (max 20 files).

**Supported formats:** PDF, DOCX, TXT, Markdown.

**Response:**
```json
{
  "documents": [
    { "name": "user-guide.pdf", "format": "PDF", "testsGenerated": 5 },
    { "name": "test-cases.md", "format": "MD", "testsGenerated": 3 }
  ]
}
```

---

### Generate API

**Base path:** `/api/generate`

#### Generate All Phases

```
POST /api/generate/:sessionId
```

Generates functional, performance, and security test cases in one request.

**Response:**
```json
{
  "phases": [
    { "phase": "FUNCTIONAL", "generatedCount": 8 },
    { "phase": "PERFORMANCE", "generatedCount": 8 },
    { "phase": "SECURITY", "generatedCount": 2 }
  ]
}
```

#### Generate by Phase

```
POST /api/generate/:sessionId/:phase
```

**Path params:** `phase` = `FUNCTIONAL` | `PERFORMANCE` | `SECURITY`

**Response:**
```json
{
  "phase": "FUNCTIONAL",
  "generatedCount": 8
}
```

---

### Review API

**Base path:** `/api/review`

#### List Test Cases

```
GET /api/review/:sessionId/test-cases?phase=FUNCTIONAL&status=GENERATED&tags=smoke
```

**Query params (all optional):** `phase`, `status`, `tags`

**Response:** Array of test case objects.

#### Get Test Case

```
GET /api/review/:sessionId/test-cases/:testId
```

**Response:** Full test case with steps, assertions, tags, and edit history.

#### Update Test Case

```
PUT /api/review/:sessionId/test-cases/:testId
```

**Body:**
```json
{
  "definition": {
    "steps": [ ... ],
    "assertions": [ ... ]
  }
}
```

#### Approve Test Cases

```
POST /api/review/:sessionId/approve
```

**Body (one of):**
```json
{ "phase": "FUNCTIONAL" }
{ "testIds": ["id1", "id2"] }
```

**Response:**
```json
{ "approved": 8 }
```

#### Reject Test Case

```
POST /api/review/:sessionId/test-cases/:testId/reject
```

**Body:**
```json
{ "reason": "Optional reason text" }
```

#### Get Approval Gates

```
GET /api/review/:sessionId/gates
```

**Response:** Array of approval gate objects for each testing phase.

#### Resolve Approval Gate

```
POST /api/review/:sessionId/gates/:phase
```

**Body:**
```json
{
  "action": "approve",
  "comments": "Looks good"
}
```

`action` can be `approve`, `reject`, or `skip`.

---

### Run API

**Base path:** `/api/run`

#### Start Test Run

```
POST /api/run/:sessionId/run
```

**Body:**
```json
{
  "testIds": ["id1"],
  "phase": "FUNCTIONAL",
  "failed": false,
  "tags": ["smoke"],
  "browser": "chromium",
  "parallel": 1,
  "timeout": 30000,
  "dryRun": false
}
```

All fields are optional. If no selection criteria are provided, runs all approved tests.

**Response:**
```json
{
  "runId": "uuid",
  "testCount": 10,
  "status": "running"
}
```

For dry runs:
```json
{
  "runId": "uuid",
  "testCount": 10,
  "status": "dry-run",
  "dryRun": true,
  "tests": [ ... ]
}
```

#### Cancel Test Run

```
POST /api/run/:sessionId/run/:runId/cancel
```

**Response:**
```json
{ "cancelled": true }
```

---

### Reports API

**Base path:** `/api/reports`

#### Summary Report

```
GET /api/reports/:sessionId/summary
```

**Response:**
```json
{
  "session": { "id": "...", "name": "..." },
  "testCases": { "functional": 8, "performance": 8, "security": 2, "total": 18 },
  "execution": { "total": 18, "passed": 16, "failed": 1, "errored": 0, "skipped": 1 },
  "passRate": "88.9%",
  "security": { "findings": 3, "bySeverity": { "HIGH": 1, "MEDIUM": 2 } }
}
```

#### Functional Report

```
GET /api/reports/:sessionId/functional?status=PASSED
```

**Query params:** `status` (optional filter)

#### Performance Report

```
GET /api/reports/:sessionId/performance
```

Returns percentile metrics (p50/p90/p95/p99), throughput, error rates, and SLA status.

#### Security Report

```
GET /api/reports/:sessionId/security?severity=HIGH
```

**Query params:** `severity` (optional filter)

#### Audit Trail

```
GET /api/reports/:sessionId/audit?action=TESTS_GENERATED
```

**Query params:** `action` (optional filter)

---

### Configuration API

**Base path:** `/api/config`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/config` | Get current configuration |
| PUT | `/api/config` | Update configuration |
| POST | `/api/config/reset` | Reset to defaults (body: `{ target: "all" }`) |

---

### Health Check API

```
GET /api/health
```

**Response:**
```json
{ "status": "ok", "timestamp": "2025-01-01T00:00:00.000Z" }
```

---

### WebSocket Progress API

**Endpoint:** `ws://localhost:3456/ws?runId=<runId>`

Connect to receive real-time test execution progress events.

**Connection:**
```javascript
const ws = new WebSocket('ws://localhost:3456/ws?runId=my-run-id');
ws.onmessage = (e) => {
  const event = JSON.parse(e.data);
  console.log(event);
};
```

**Event Types:**

| status | Description |
|--------|-------------|
| `running` | A test started executing |
| `passed` | A test passed |
| `failed` | A test failed |
| `errored` | A test errored |
| `skipped` | A test was skipped |
| `completed` | All tests finished |
| `error` | Run-level error occurred |

**Event Shape:**
```json
{
  "runId": "uuid",
  "testCaseId": "uuid",
  "status": "passed",
  "message": "Test passed in 234ms",
  "percentage": 75,
  "summary": { "total": 10, "passed": 7, "failed": 1, "errored": 0, "skipped": 0 }
}
```

---

## Configuration Reference

The tool looks for `ctt.config.json` in the current directory.

### Full Configuration Example

```json
{
  "target": "http://localhost:3000",
  "browsers": ["chromium", "firefox", "webkit"],

  "performance": {
    "virtualUsers": 50,
    "rampUpSeconds": 30,
    "durationSeconds": 120,
    "sla": {
      "responseTimeP95Ms": 2000,
      "errorRateMax": 0.01,
      "throughputMinRps": 100
    }
  },

  "security": {
    "zapPath": "/usr/share/zap/zap.sh",
    "passiveScan": true,
    "activeScan": true,
    "severityThreshold": "MEDIUM"
  },

  "output": {
    "format": "terminal",
    "screenshots": true,
    "networkLogs": true
  }
}
```

### Options Reference

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `target` | string (URL) | Yes | — | URL of the application under test |
| `browsers` | `("chromium"\|"firefox"\|"webkit")[]` | No | `["chromium"]` | Browsers for functional tests |
| `performance` | object | No | — | Load testing configuration |
| `performance.virtualUsers` | number | No | 50 | Simulated concurrent users |
| `performance.rampUpSeconds` | number | No | 30 | Gradual ramp-up period |
| `performance.durationSeconds` | number | No | 60 | Total load test duration |
| `performance.sla` | object | No | — | SLA thresholds |
| `performance.sla.responseTimeP95Ms` | number | No | — | Max acceptable p95 response time |
| `performance.sla.errorRateMax` | number | No | — | Max acceptable error rate (0.0–1.0) |
| `performance.sla.throughputMinRps` | number | No | — | Min acceptable requests/sec |
| `security` | object | No | — | DAST scanning configuration |
| `security.zapPath` | string | No | `""` | Path to ZAP executable |
| `security.passiveScan` | boolean | No | `true` | Enable passive scanning |
| `security.activeScan` | boolean | No | `true` | Enable active scanning |
| `security.severityThreshold` | string | No | `"MEDIUM"` | Minimum severity to report |
| `output` | object | No | — | Output and artifact settings |
| `output.format` | string | No | `"terminal"` | Default format: `terminal`, `json`, `junit` |
| `output.screenshots` | boolean | No | `true` | Capture screenshots on failure |
| `output.networkLogs` | boolean | No | `true` | Record network requests |

---

## Workflows

### Phased Workflow

The tool implements a strict phased workflow with human approval gates:

```
INGESTION → GENERATION → FUNCTIONAL → PERFORMANCE → SECURITY → COMPLETE
                          ↑              ↑              ↑
                       approval gate  approval gate  approval gate
```

| Phase | What happens | Requires |
|-------|-------------|----------|
| INGESTION | Documents are uploaded and parsed | Initialized project |
| GENERATION | Test cases are created from documents | Ingested documents |
| FUNCTIONAL | Browser-based test execution | Approved functional tests |
| PERFORMANCE | Load testing | Approved performance tests |
| SECURITY | DAST scanning | Approved security tests |
| COMPLETE | All phases finished | All phases passed |

Each phase transition requires an explicit approval via `ctt review approve` or the web UI approval page.

### Session Resumption

```bash
ctt session list
ctt session resume <session-id>
```

When resumed:
- The session restores to its last known phase
- All prior test results are preserved
- Pending approval gates remain in place
- The audit trail records the resumption event

### Selective Execution

```bash
ctt run <test-id-1> <test-id-2>           # Specific tests
ctt run --filter smoke,integration         # By tag
ctt run --failed                           # Re-run failures
ctt run --phase functional --dry-run       # Preview
```

### CI/CD Integration

```yaml
# GitHub Actions example
- name: Run Functional Tests
  run: |
    ctt init --target ${{ vars.APP_URL }} --browsers chromium
    ctt ingest ./docs/test-cases.md
    ctt generate functional
    ctt review approve functional
    ctt run --phase functional
  env:
    CTT_CONFIG: ./ci-ctt.config.json

- name: Publish Results
  if: always()
  run: |
    ctt report functional --format junit --output results.xml
    ctt report summary --format json --output summary.json
```

**Exit codes:** 0 = all tests passed, 1 = one or more failed/errored.

---

## Understanding Results

### Execution Statuses

| Status | Meaning |
|--------|---------|
| `PASSED` | All steps executed and all assertions passed |
| `FAILED` | A step threw an error or an assertion did not match |
| `ERROR` | Infrastructure error (browser crash, connectivity issue) |
| `SKIPPED` | Test was not executed |
| `TIMEOUT` | Test exceeded the configured time limit |

### SLA Validation

When SLA thresholds are configured, performance tests validate three metrics:

| Metric | Direction | Description |
|--------|-----------|-------------|
| p95 response time | Must be **below** threshold | 95th percentile response time |
| Error rate | Must be **below** threshold | Ratio of failed requests to total |
| Throughput | Must be **above** threshold | Requests per second sustained |

Result is `PASS` (all within thresholds) or `FAIL` (any exceeded).

### Security Findings

| Severity | Meaning | Action |
|----------|---------|--------|
| CRITICAL | Confirmed high-risk vulnerability | Fix immediately |
| HIGH | Likely exploitable vulnerability | Fix before release |
| MEDIUM | Moderate risk, may require context | Evaluate and address |
| LOW | Minor issue or best practice gap | Plan to address |
| INFORMATIONAL | Not a vulnerability, but notable | Review for awareness |

### Report Formats

| Format | Use case |
|--------|----------|
| `terminal` | Interactive use — formatted tables in the console |
| `json` | Machine-readable — integration with other tools |
| `junit` | CI/CD — parsed by Jenkins, GitHub Actions, GitLab CI |
| `html` | Session export — styled standalone page for compliance |

---

## Troubleshooting

### Target application unreachable

```
Error: Cannot connect to target http://localhost:3000: fetch failed
```

**Solution:** Ensure your application is running and accessible at the configured URL.

### Playwright browsers not installed

```
Error: Executable doesn't exist at ...\chrome-headless-shell.exe
```

**Solution:**
```bash
npx playwright install
# or for just Chromium:
npx playwright install chromium
```

### ZAP proxy not running

```
Error: ZAP proxy is not running at http://localhost:8080
```

**Solution:** Start ZAP in daemon mode:
```bash
# Linux/macOS
zap.sh -daemon -port 8080 -config api.key=your-api-key

# Windows
zap.bat -daemon -port 8080 -config api.key=your-api-key
```

### Unsupported document format

```
Error: Unsupported file format: ".xlsx"
  Supported formats: .pdf, .docx, .txt, .md
```

**Solution:** Convert your document to PDF, DOCX, TXT, or Markdown before ingesting.

### No approved tests to run

```
No approved tests to run. Use 'ctt review approve' to approve test cases first.
```

**Solution:**
```bash
ctt review approve functional
```

### Session not found

```
No sessions found. Run 'ctt init' to create a project first.
```

**Solution:**
```bash
ctt init --target http://localhost:3000
```

### API server not responding (Web UI)

If the web UI shows errors or toasts about failed requests:

1. Verify the API server is running: `curl http://localhost:3456/api/health`
2. Check the port matches: `NEXT_PUBLIC_API_URL=http://localhost:3456/api`
3. Restart the API server: `ctt serve`

### Frontend build errors

```bash
cd frontend
rm -rf node_modules/.cache
npm run build
```

### Browser crash during execution

If a browser crashes mid-test, the tool attempts to restart it automatically. The affected test is marked as `ERROR` and execution continues with remaining tests.

### Database locked errors

If you see `SQLITE_BUSY` errors, ensure only one process is accessing the `.ctt/sessions.db` file at a time. The CLI and API server share the same database.

---

## Getting Help

- `ctt --help` — List all commands
- `ctt <command> --help` — Show help for a specific command
- `ctt <command> <subcommand> --help` — Show help for a subcommand
- Check the Web UI Settings page for current configuration
