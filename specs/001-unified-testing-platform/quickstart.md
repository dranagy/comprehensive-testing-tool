# Quickstart: Unified Local Testing Platform

**Branch**: `001-unified-testing-platform` | **Date**: 2026-04-28

## Prerequisites

- Node.js 20+ (LTS)
- npm 9+
- OWASP ZAP installed (for security testing)
- A target web application accessible locally

## Setup

```bash
# Install the platform globally
npm install -g @ctt/cli

# Or use locally in a project
npm install --save-dev @ctt/cli
```

## 5-Minute Walkthrough

### 1. Initialize a Testing Session

```bash
ctt init --target http://localhost:3000 --name "My App Tests" --browsers chromium,firefox
```

This creates a `ctt.config.ts` configuration file and a `.ctt/` data directory.

### 2. Upload Context Documents

```bash
# Provide user guides, test cases, or behavioral docs
ctt ingest ./docs/user-guide.pdf ./tests/manual-test-cases.md ./docs/requirements.docx
```

The platform parses each document and extracts testable scenarios.

### 3. Generate Test Cases

```bash
ctt generate functional
```

This generates automated functional test cases from the ingested documents. Tests are displayed for review.

### 4. Review and Approve

```bash
# List generated tests
ctt review list

# View a specific test
ctt review show <test-id>

# Edit a test (opens interactive editor)
ctt review edit <test-id>

# Approve all functional tests
ctt review approve functional
```

### 5. Execute Tests

```bash
# Run all approved functional tests
ctt run --phase functional

# Run a specific test
ctt run <test-id>

# Re-run only failed tests
ctt run --failed
```

### 6. Continue Through Phases

```bash
# Generate and approve performance tests
ctt generate performance
ctt review approve performance
ctt run --phase performance

# Generate and approve security scans
ctt generate security
ctt review approve security
ctt run --phase security
```

### 7. View Reports

```bash
# Overall summary
ctt report summary

# Specific reports
ctt report functional --format json
ctt report performance --format html --output ./reports/perf.html
ctt report security --format terminal

# Export full audit trail
ctt session export <session-id> --format json --output ./audit.json
```

## Configuration (ctt.config.ts)

```typescript
import { defineConfig } from "@ctt/cli";

export default defineConfig({
  target: "http://localhost:3000",

  browsers: ["chromium", "firefox", "webkit"],

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
    zapPath: "/usr/share/zap/zap.sh",  // or Windows path
    passiveScan: true,
    activeScan: true,
    severityThreshold: "MEDIUM",  // Fail on MEDIUM and above
  },

  output: {
    format: "terminal",
    screenshots: true,
    networkLogs: true,
  },
});
```

## Session Resumption

If a session is interrupted at any approval gate:

```bash
# List sessions
ctt session list

# Resume a specific session
ctt session resume <session-id>

# Check current status
ctt session status
```

The platform restores the exact state including all prior results and pending approvals.

## Selective Test Execution

```bash
# Run specific tests by ID
ctt run <test-id-1> <test-id-2>

# Run tests matching a tag
ctt run --filter "smoke"

# Dry run (show what would execute)
ctt run --phase functional --dry-run
```

## CI/CD Integration

```yaml
# GitHub Actions example
- name: Run Tests
  run: |
    ctt init --target ${{ vars.APP_URL }} --browsers chromium
    ctt ingest ./docs/test-cases.md
    ctt generate functional
    ctt review approve --all
    ctt run --phase functional --format junit --output results.xml
  env:
    CTT_CONFIG: ./ci-ctt.config.json
```

Exit codes: 0 = all pass, 1 = failures found, 2 = execution error.
