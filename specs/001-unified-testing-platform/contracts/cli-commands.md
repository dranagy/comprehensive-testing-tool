# CLI Command Contracts

**Branch**: `001-unified-testing-platform` | **Date**: 2026-04-28

## Global Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--format` | `json \| terminal \| junit` | `terminal` | Output format |
| `--config` | string | `ctt.config.ts` | Configuration file path |
| `--verbose` | boolean | false | Enable verbose logging |
| `--help` | boolean | false | Show help |

## Command: `ctt init`

Initialize a new testing project in the current directory.

**Usage**: `ctt init [options]`

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `--target` | string | yes | - | Target application URL |
| `--name` | string | no | directory name | Project/session name |
| `--browsers` | string | no | `chromium` | Comma-separated browser list |

**Output**:
```json
{
  "session_id": "uuid",
  "config_path": "ctt.config.ts",
  "database_path": ".ctt/sessions.db"
}
```

**Exit Codes**: 0 = success, 1 = already initialized, 2 = invalid target URL

## Command: `ctt ingest`

Upload and process context documents for test generation.

**Usage**: `ctt ingest <files...> [options]`

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `files` | string[] | yes | - | Paths to documents |
| `--session` | string | no | current | Session ID |

**Output**:
```json
{
  "documents_processed": 3,
  "tests_extracted": 42,
  "errors": []
}
```

**Exit Codes**: 0 = success, 1 = processing error, 2 = unsupported format

## Command: `ctt generate`

Generate automated test cases from ingested documents.

**Usage**: `ctt generate [phase] [options]`

| Phase | Description |
|-------|-------------|
| `functional` | Generate functional test cases |
| `performance` | Convert functional tests to load scenarios |
| `security` | Generate security scan configurations |
| (omitted) | Generate all applicable phases |

**Output**:
```json
{
  "phase": "functional",
  "test_cases_generated": 42,
  "test_case_ids": ["uuid1", "uuid2", "..."]
}
```

**Exit Codes**: 0 = success, 1 = no documents ingested, 2 = generation error

## Command: `ctt review`

Review, edit, and approve generated test cases.

**Usage**: `ctt review [action] [options]`

| Action | Description |
|--------|-------------|
| `list` | List test cases awaiting review |
| `show <test-id>` | Display full test case details |
| `edit <test-id>` | Open test case for editing (interactive) |
| `approve [phase]` | Approve all tests in a phase |
| `reject <test-id>` | Reject a specific test case |
| `approve --all` | Approve all pending tests |

**Output** (approve):
```json
{
  "phase": "functional",
  "approved_count": 40,
  "rejected_count": 2,
  "pending_count": 0
}
```

**Exit Codes**: 0 = success, 1 = no tests to review, 2 = invalid test ID

## Command: `ctt run`

Execute approved test cases.

**Usage**: `ctt run [target] [options]`

| Target | Description |
|--------|-------------|
| `all` | Run all approved tests across phases |
| `<test-id>` | Run specific test case(s) by ID |
| `--filter <tag>` | Run tests matching tag |
| `--failed` | Re-run previously failed tests |
| `--phase <phase>` | Run all tests in a specific phase |

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--parallel` | number | 1 | Number of parallel workers |
| `--timeout` | number | 30000 | Test timeout in ms |
| `--dry-run` | boolean | false | Show what would run without executing |

**Output**:
```json
{
  "total": 42,
  "passed": 38,
  "failed": 3,
  "errored": 1,
  "skipped": 0,
  "duration_ms": 12543,
  "results": [
    { "test_id": "uuid", "status": "passed", "duration_ms": 312 }
  ]
}
```

**Exit Codes**: 0 = all pass, 1 = failures found, 2 = execution error

## Command: `ctt session`

Manage testing sessions.

**Usage**: `ctt session <action> [options]`

| Action | Description |
|--------|-------------|
| `create` | Start a new testing session |
| `resume <session-id>` | Resume an interrupted session |
| `status` | Show current session state |
| `list` | List all sessions |
| `export <session-id>` | Export session audit trail |

**Output** (status):
```json
{
  "session_id": "uuid",
  "name": "My Test Run",
  "current_phase": "FUNCTIONAL",
  "pending_gate": "PERFORMANCE",
  "tests_total": 42,
  "tests_passed": 38,
  "tests_failed": 3,
  "started_at": "2026-04-28T10:00:00Z",
  "duration_minutes": 15
}
```

**Exit Codes**: 0 = success, 1 = session not found, 2 = state error

## Command: `ctt report`

Generate and export reports.

**Usage**: `ctt report [type] [options]`

| Type | Description |
|------|-------------|
| `summary` | Overall session summary |
| `functional` | Functional test results |
| `performance` | Performance metrics and SLA status |
| `security` | Security findings by severity |
| `audit` | Full audit trail |

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--output` | string | stdout | Output file path |
| `--format` | string | terminal | Report format (terminal, json, junit, html, pdf) |

**Exit Codes**: 0 = success, 1 = no data, 2 = export error
