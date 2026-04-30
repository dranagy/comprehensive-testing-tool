# CTT Web Dashboard — Design System

This folder contains all design assets for the Comprehensive Testing Tool web dashboard.

## Folder Structure

```
designs/
  README.md               # This file
  wireframes/              # Low-fidelity wireframes (sketches, layout diagrams)
  mockups/
    desktop/               # High-fidelity Google Stitch outputs (HTML files)
    mobile/                # Responsive/mobile mockups (future)
  components/              # Individual component designs (cards, badges, charts)
  assets/                  # Shared design tokens
    colors.css             # Color palette as CSS custom properties
    typography.css         # Font scale and weights
    spacing.css            # Spacing scale
```

## Design System

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-primary` | `#2563EB` (blue-600) | Primary actions, links, active states |
| `--color-primary-light` | `#DBEAFE` (blue-100) | Primary backgrounds, hover states |
| `--color-success` | `#16A34A` (green-600) | Passed tests, approved status |
| `--color-success-light` | `#DCFCE7` (green-100) | Success backgrounds |
| `--color-warning` | `#D97706` (amber-600) | Pending status, warnings |
| `--color-warning-light` | `#FEF3C7` (amber-100) | Warning backgrounds |
| `--color-danger` | `#DC2626` (red-600) | Failed tests, rejected, critical findings |
| `--color-danger-light` | `#FEE2E2` (red-100) | Danger backgrounds |
| `--color-info` | `#7C3AED` (violet-600) | Informational findings, info badges |
| `--color-neutral-50` | `#F9FAFB` | Page backgrounds |
| `--color-neutral-100` | `#F3F4F6` | Card backgrounds, dividers |
| `--color-neutral-200` | `#E5E7EB` | Borders, disabled states |
| `--color-neutral-500` | `#6B7280` | Secondary text |
| `--color-neutral-700` | `#374151` | Primary text |
| `--color-neutral-900` | `#111827` | Headings |

### Severity Colors (Security Findings)

| Severity | Color | Hex |
|----------|-------|-----|
| CRITICAL | `--color-danger` | `#DC2626` |
| HIGH | `#EA580C` (orange-600) | `#EA580C` |
| MEDIUM | `--color-warning` | `#D97706` |
| LOW | `--color-primary` | `#2563EB` |
| INFORMATIONAL | `--color-neutral-500` | `#6B7280` |

### Phase Colors

| Phase | Color | Hex |
|-------|-------|-----|
| INGESTION | `#06B6D4` (cyan-500) | `#06B6D4` |
| GENERATION | `#8B5CF6` (violet-500) | `#8B5CF6` |
| FUNCTIONAL | `--color-primary` | `#2563EB` |
| PERFORMANCE | `#F59E0B` (amber-500) | `#F59E0B` |
| SECURITY | `--color-danger` | `#DC2626` |
| COMPLETE | `--color-success` | `#16A34A` |

### Typography

| Token | Size | Weight | Usage |
|-------|------|--------|-------|
| `--text-xs` | 12px | 400 | Badges, timestamps |
| `--text-sm` | 14px | 400 | Table cells, secondary text |
| `--text-base` | 16px | 400 | Body text, form inputs |
| `--text-lg` | 18px | 500 | Section titles |
| `--text-xl` | 20px | 600 | Page titles |
| `--text-2xl` | 24px | 700 | Dashboard headings |
| `--text-3xl` | 30px | 700 | Hero numbers (stats) |

### Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Inline gaps, icon padding |
| `--space-2` | 8px | Tight element spacing |
| `--space-3` | 12px | Standard element gap |
| `--space-4` | 16px | Card padding, section gaps |
| `--space-6` | 24px | Section padding |
| `--space-8` | 32px | Page margins |
| `--space-12` | 48px | Large section breaks |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 4px | Badges, small elements |
| `--radius-md` | 8px | Cards, buttons, inputs |
| `--radius-lg` | 12px | Modal, panels |
| `--radius-full` | 9999px | Pills, avatars |

## Page Inventory

These are the pages to be designed in Google Stitch. Each mockup should be placed in `mockups/desktop/` as an HTML file.

| # | Route | Page Name | Key Elements |
|---|-------|-----------|--------------|
| 1 | `/` | Dashboard | Session list table, new session card, quick stats |
| 2 | `/sessions/new` | New Session | Form: target URL, name, browser checkboxes, perf/security config toggles |
| 3 | `/sessions/:id` | Session Detail | Phase progress bar, test count cards, approval gates, execution summary |
| 4 | `/sessions/:id/ingest` | Document Upload | Drag-and-drop zone, file list with status, test case count per document |
| 5 | `/sessions/:id/generate` | Generate Tests | Phase tabs, generate button, test count preview per phase |
| 6 | `/sessions/:id/test-cases` | Test Case List | Filterable table (phase tabs, status filter), bulk select + approve |
| 7 | `/sessions/:id/test-cases/:tcId` | Test Case Detail | Steps list, assertions, metadata, edit history, approve/reject bar |
| 8 | `/sessions/:id/test-cases/:tcId/edit` | Test Case Editor | Structured form for steps (action, selector, value) and assertions |
| 9 | `/sessions/:id/approval` | Approval Gates | Phase cards with gate status, approve/reject/skip buttons, comments |
| 10 | `/sessions/:id/run` | Run Tests | Test selection panel, run config (browser, timeout, parallel), dry-run toggle |
| 11 | `/sessions/:id/run/:runId` | Live Progress | Real-time status list, progress bar, live counters, cancel button |
| 12 | `/sessions/:id/reports/summary` | Summary Report | Stat cards, pass rate chart, test distribution donut, findings count |
| 13 | `/sessions/:id/reports/functional` | Functional Report | Per-test results table, duration histogram, browser filter |
| 14 | `/sessions/:id/reports/performance` | Performance Report | Response time chart (p50/p90/p95/p99), throughput area chart, SLA status cards |
| 15 | `/sessions/:id/reports/security` | Security Report | Severity donut, findings table sorted by severity, detail expansion with evidence |
| 16 | `/sessions/:id/reports/audit` | Audit Trail | Chronological timeline, action type filter, detail expansion |
| 17 | `/sessions/:id/export` | Export Session | Format selector (JSON/HTML), download button, preview |
| 18 | `/settings` | Settings | Config editor form matching ctt.config.json fields |

## Layout

All pages share a common layout:

```
┌─────────────────────────────────────────────────────┐
│  Top Bar: [Session Selector ▼]  Session Name  Phase  │
├──────────┬──────────────────────────────────────────┤
│ Sidebar  │                                          │
│          │                                          │
│ Overview │          Main Content Area               │
│ Ingest   │                                          │
│ Generate │                                          │
│ Review   │                                          │
│ Approve  │                                          │
│ Run      │                                          │
│ Reports  │                                          │
│          │                                          │
│ Settings │                                          │
├──────────┴──────────────────────────────────────────┤
│  Footer: CTT v0.1.0 | Local mode                    │
└─────────────────────────────────────────────────────┘
```

- **Sidebar width**: 240px, collapsible
- **Top bar height**: 56px
- **Content max-width**: 1200px, centered
- **Sidebar items**: highlight current section, show completion badges per phase

## Google Stitch Workflow

1. Use the page inventory above as prompts for Google Stitch
2. For each page, provide the route, page name, and key elements description
3. Export each mockup as HTML with inline styles
4. Save to `mockups/desktop/<route-name>.html` (e.g., `mockups/desktop/dashboard.html`)
5. During implementation, reference mockups for exact spacing, colors, and component composition
