---
name: competitor-claims
description: Run a fresh, comprehensive comparison of the product claims made by AI cybersecurity companies (Kai, Armadin, Astelia, Artemis, Cogent, Zafran) using their live websites and third-party sources. Produces a dated writeup with a comparison table and offers to save it as a PDF in the "Generated Analysis" subfolder. Use when the user asks to analyze, compare, or refresh competitor product claims.
---

# Competitor product-claims analysis

Compare what each company in the roster below promises customers, based on what their websites say **right now**. Product claims change over time, so every invocation re-fetches everything live — never reuse a previous run's data and never answer from model knowledge of these companies.

## Roster

| Company | Start URL |
|---|---|
| Kai | https://kai.security |
| Armadin | https://armadin.com |
| Astelia | https://astelia.io |
| Artemis | https://artemissecurity.com |
| Cogent | https://cogent.com |
| Zafran | https://zafran.io |

To add or remove companies, edit this table — the workflow takes the roster as `args`. If the user passes extra companies or a focus area as skill arguments, add them to the roster / weave the focus into the synthesis.

Heads-up: several names are ambiguous (Cogent Communications is an unrelated ISP; "Artemis" and "Kai" collide with unrelated products). The workflow agents are instructed to confirm they are looking at the AI cybersecurity company and to chase down the correct site if a listed domain doesn't match.

Crawler blocking: Armadin (and potentially others) serves Cloudflare 403 to automated fetchers. Falling back to the most recent Internet Archive / Wayback Machine snapshot (web.archive.org) is acceptable — record the snapshot date in `site_status` and flag the staleness in the report appendix.

## Step 0 — setup

1. Get the run date: `date +%Y-%m-%d`.
2. Look in `Generated Analysis/` for the most recent previous writeup (`*.md`) — it feeds the "Changes since last run" section. Folder missing or empty → first run; the section will say so.

## Step 1 — gather live data

Invoke the **Workflow** tool with `scriptPath` pointing at `claims-workflow.js` in this skill's directory and args:

```json
{
  "date": "<run date>",
  "companies": [
    {"name": "Kai", "domain": "kai.security"},
    {"name": "Armadin", "domain": "armadin.com"},
    {"name": "Astelia", "domain": "astelia.io"},
    {"name": "Artemis", "domain": "artemissecurity.com"},
    {"name": "Cogent", "domain": "cogent.com"},
    {"name": "Zafran", "domain": "zafran.io"}
  ]
}
```

The workflow runs in the background (typically 10–20 minutes) and has three phases:

- **Explore** — one agent per company; fetches 8–15 pages per site (product, how-it-works, solutions, integrations, customers, pricing, trust/compliance, blog) and extracts claims with verbatim quotes and source URLs.
- **Verify** — an adversarial fact-checker per company re-fetches the cited pages for the most consequential claims and flags misquotes and overstatements.
- **Third-party** — three concurrent sweeps: buyer reviews (G2, Gartner Peer Insights, PeerSpot, Reddit, HN), news/funding/analyst coverage, and direct head-to-head comparisons.

It returns structured JSON: `{date, companies: [{claims, verification}], thirdParty}`.

## Step 2 — synthesize the writeup

The report's subject is **how each company markets its product** — the claims and use cases they advertise to customers. Weight product claims and claimed use cases heavily; funding and corporate news are context and get at most a line or two each.

Write the full report in markdown and present it **complete** in the conversation:

1. **Title + date** — "AI Cybersecurity Competitor Claims Analysis — <date>", with a one-line method note (all sources fetched live on that date).
2. **Executive summary** — the market frame, the sharpest contrasts in what the companies claim, and (if not the first run) the biggest changes.
3. **Comparison table** — rows are dimensions, columns are companies; every column must be clearly headed by its company name. Minimum dimensions: Core product, Headline AI/autonomy claim, Human role, Flagship quantified claims, Compliance & certifications, Named customers, Third-party validation, Target customer, Pricing transparency, Funding/maturity. Keep cells terse; depth lives in the profiles.
4. **Claimed use-case matrix** — rows are use-case categories observed across the set (e.g., vulnerability triage, remediation execution, exposure/reachability analysis, AppSec, SOC detection & response, threat hunting, offensive testing, threat intel, zero-day response, asset discovery, compliance automation); the **leftmost column groups the rows into Gartner-defined market categories** (per gartner.com/reviews/markets — e.g., Exposure Assessment Platforms, Adversarial Exposure Validation, Application Security Testing, Security Information and Event Management, Security Threat Intelligence Products and Services, Cyber Asset Attack Surface Management, IT Risk Management, AI Governance Platforms), with the market name shown on the first row of each group and rows ordered by group; remaining columns are companies; cells: ● = flagship/core marketed use case, ✓ = claimed capability, — = not claimed. Include the legend.
5. **Per-company profiles** — lead with how the company markets: positioning/taglines, the claimed use cases under the vendor's own marketing names, the recurring marketing themes (fear framing, exclusivity claims, superlatives, proof-by-pedigree, ...), then headline product claims with short verbatim quotes + source URLs, proof offered, and verification flags (claims the verifier marked misquoted/overstated/page-missing must be flagged inline, never silently dropped).
6. **Third-party perspective** — what reviewers, analysts, and comparison articles say, especially where they contradict vendor claims.
7. **Cross-cutting observations** — shared marketing themes, claims unique to one vendor, whitespace nobody claims.
8. **Changes since last run** — diff against the previous writeup's markdown from `Generated Analysis/`; on the first run, state that.
9. **Appendix** — pages reviewed per company and any `site_status` anomalies (redirects, rebrands, domain mismatches, crawler blocks with snapshot dates).

Integrity rules: keep vendor claims and third-party findings clearly separated; a company whose sweep failed is reported as "could not be analyzed this run" — never backfilled from model memory.

**Permanent exclusions:** reports do not engage with endorsements from individual employees. Named testimonials may be listed as vendor proof points, but never analyze, verify, question, or otherwise comment on the individuals behind them (their identity, role, employer, or relationships) in any section of any report, including "Changes since last run". If a verification agent surfaces commentary about an individual endorser, drop it silently.

## Step 3 — present, then ask about saving

After presenting the writeup, use **AskUserQuestion** with a single question: "Save this writeup as a PDF in the Generated Analysis folder?" — options "Yes — save as PDF" (recommended) and "No — conversation only".

**On yes:**
1. `mkdir -p "Generated Analysis"`.
2. Render the markdown to HTML with the converter in this skill's directory: `python3 "<this skill's directory>/md-to-html.py" "<report.md>" /tmp/claims-report.html`. It embeds A4 print CSS and keeps table header rows readable (bolded company names render white on the dark header row) — do not hand-roll HTML with CSS that hides them.
3. Convert: `bash "<this skill's directory>/html-to-pdf.sh" /tmp/claims-report.html "Generated Analysis/Competitor Claims Analysis <date>.pdf"` — the script tries Chrome-family headless, then wkhtmltopdf, pandoc, and weasyprint. If the target filename already exists (same-day rerun), suffix " (2)", " (3)", ….
4. Save the markdown source alongside with the same basename and `.md` — the next run's change-tracking depends on it. Delete the temp HTML on success.
5. If every converter fails, save the `.html` and `.md` into `Generated Analysis/` instead and tell the user to open the HTML and use Print → Save as PDF.

**On no:** save nothing; the writeup stays in the conversation.
