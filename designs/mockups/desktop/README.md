# Google Stitch Mockup Prompts

Place Google Stitch HTML outputs in this directory. Each file should be named after its route.

## Recommended Prompts for Google Stitch

### 1. Dashboard (`dashboard.html`)
> Design a testing tool dashboard with a clean, modern layout. Show a session list table with columns: name, target URL, status phase, created date. Include a "New Session" card button at the top. Show quick stats cards: total sessions, active sessions, last run pass rate. Use a left sidebar navigation with items: Overview, Ingest, Generate, Review, Approve, Run, Reports, Settings. Top bar has a session selector dropdown. Colors: primary blue (#2563EB), success green (#16A34A), danger red (#DC2626).

### 2. New Session (`new-session.html`)
> Design a session creation form with fields: target URL (required), session name, browser selection (checkboxes for chromium, firefox, webkit), expandable performance config section (virtual users, ramp-up seconds, duration, SLA thresholds), expandable security config section (ZAP path, passive/active scan toggles, severity threshold). Include Create and Cancel buttons.

### 3. Session Detail (`session-detail.html`)
> Design a session detail page showing: a horizontal phase progress bar (INGESTION → GENERATION → FUNCTIONAL → PERFORMANCE → SECURITY → COMPLETE) with the current phase highlighted. Below: test count cards by phase (Functional, Performance, Security), pending approval gates list, execution summary (Passed/Failed/Errored/Skipped counts), and quick action buttons for the next workflow step.

### 4. Document Upload (`ingest.html`)
> Design a file upload page with a large drag-and-drop zone accepting PDF, DOCX, TXT, Markdown files. Below: a list of already-uploaded documents showing filename, format badge, ingestion status (PENDING/PROCESSING/COMPLETED/FAILED), and test cases generated count.

### 5. Test Case List (`test-cases.html`)
> Design a test case review page with: phase filter tabs (All/Functional/Performance/Security), approval status filter dropdown, a data table with columns: checkbox (for bulk select), name, phase badge, approval status badge, tags, created date. A bulk approve button appears when rows are selected. Clicking a row navigates to detail view.

### 6. Test Case Detail (`test-case-detail.html`)
> Design a test case detail page showing: metadata section (name, description, phase, status badge, tags), a numbered steps list where each step shows an action icon, selector, value, and description. Below: assertions list with type, expected value. Edit history timeline at the bottom. Action bar at top: Edit, Approve, Reject buttons.

### 7. Test Case Editor (`test-case-edit.html`)
> Design a test case editor form. Steps section: add/remove/reorder steps, each step has action dropdown (navigate/click/type/wait/select/submit), selector input, value input, description input. Assertions section: add/remove assertions with type dropdown (visible/text/url/status/attribute), expected value, optional selector. Save and Cancel buttons at the bottom.

### 8. Approval Gates (`approval.html`)
> Design an approval gates page with one card per testing phase (Functional, Performance, Security). Each card shows: phase name with color, gate status badge (PENDING/APPROVED/REJECTED/SKIPPED), resolved info if applicable, test count awaiting approval. For PENDING gates: Approve/Reject/Skip buttons with an optional comment textarea.

### 9. Run Tests (`run.html`)
> Design a test execution configuration page. Test selection panel: radio buttons for "All approved tests", "By phase" (with phase dropdown), "Specific tests" (with multi-select), "Failed tests only", "By tag" (with tag input). Configuration: browser dropdown, parallel workers number input, timeout number input, dry-run toggle switch. Large "Run Tests" primary button at the bottom.

### 10. Live Progress (`run-progress.html`)
> Design a real-time test execution progress page. Top: overall progress bar and live counters (Passed: N, Failed: N, Running: N, Remaining: N). Below: a scrollable list of test cases each showing name, status icon (running spinner/passed checkmark/failed X/errored), duration. A cancel button in the top right. Auto-scrolls to the currently running test.

### 11. Summary Report (`report-summary.html`)
> Design a summary report page with: large stat cards (Total Tests, Pass Rate %, Security Findings, SLA Status), a test distribution donut chart by phase, pass/fail stacked bar chart, and a recent executions timeline.

### 12. Functional Report (`report-functional.html`)
> Design a functional test report with: filter bar (by status, by browser), results table (test name, status icon, duration, browser, error message), expandable rows showing step-by-step execution details. Duration histogram chart at the top.

### 13. Performance Report (`report-performance.html`)
> Design a performance report with: SLA status cards (Response Time, Error Rate, Throughput) showing PASS/FAIL, a response time percentile line chart with four lines (p50/p90/p95/p99), throughput area chart, error rate line chart, and a concurrent users step chart.

### 14. Security Report (`report-security.html`)
> Design a security findings report with: severity distribution donut chart, summary cards by severity count, findings table sorted by severity (critical first) with columns: severity badge, title, URL, scan type, category. Expandable rows showing description, evidence, and remediation.

### 15. Audit Trail (`report-audit.html`)
> Design an audit trail page with: action type filter dropdown, a chronological timeline showing each audit entry with timestamp, action label, actor, and expandable details JSON.

### 16. Export Session (`export.html`)
> Design a session export page with: format selector (JSON/HTML radio cards with previews), export content checklist (session info, test cases, execution results, audit trail), download button.

### 17. Settings (`settings.html`)
> Design a settings page with form fields matching ctt.config.json: target URL, browser checkboxes, performance config section, security config section, output config section. Save and Reset buttons.
