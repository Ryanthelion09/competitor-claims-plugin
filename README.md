# competitor-claims

A Claude Code plugin that runs a fresh, comprehensive comparison of the product claims made by AI cybersecurity companies (Kai, Armadin, Astelia, Artemis, Cogent, Zafran) every time it's invoked — because marketing claims drift over time.

## What it does

Each run:

1. **Gathers live data** via a multi-agent workflow: one explore agent per company (8–15 pages each: product, use cases, integrations, customers, pricing, trust/compliance, blog), an adversarial fact-checker per company that re-fetches cited pages to catch misquotes and overstatements, and three third-party sweeps (buyer reviews, news/funding/analyst coverage, head-to-head comparisons). Sites that block crawlers fall back to the Internet Archive (snapshot date recorded).
2. **Synthesizes a report** focused on how each company markets its product: executive summary, dimension-by-company comparison table, claimed use-case matrix, per-company profiles (taglines, claimed use cases under the vendor's own names, marketing themes, verbatim-quoted claims with source URLs, verification flags), third-party perspective, cross-cutting observations, and a "changes since last run" diff against the previous report.
3. **Asks before saving** the report as a dated PDF (plus markdown source) in a `Generated Analysis/` subfolder of the current project.

## Installation

```
/plugin marketplace add <your-github-owner>/competitor-claims-plugin
/plugin install competitor-claims@kai-tools
```

## Usage

```
/competitor-claims
```

Optionally pass extra companies or a focus area as arguments. To change the standing roster, edit the table in `skills/competitor-claims/SKILL.md`.

## Requirements

- Claude Code with web access (WebFetch/WebSearch) and the Workflow tool — runs spawn ~15 subagents and take 10–20 minutes.
- `python3` (markdown→HTML rendering; stdlib only).
- An HTML→PDF converter — tries Chrome/Chromium/Edge/Brave headless, then `wkhtmltopdf`, `pandoc`, `weasyprint`. Without one, the report is saved as HTML+markdown instead.

## Files

| File | Purpose |
|---|---|
| `skills/competitor-claims/SKILL.md` | The repeatable procedure (roster, workflow invocation, report structure, save flow) |
| `skills/competitor-claims/claims-workflow.js` | Multi-agent orchestration script (explore → verify → third-party) |
| `skills/competitor-claims/md-to-html.py` | Print-styled markdown→HTML converter for the PDF |
| `skills/competitor-claims/html-to-pdf.sh` | HTML→PDF with converter fallback chain |
