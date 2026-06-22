export const meta = {
  name: 'competitor-claims-analysis',
  description: 'Live sweep of AI cybersecurity competitor websites plus third-party sources, extracting and verifying product claims',
  whenToUse: 'Invoked by the competitor-claims skill; always re-fetches live data because product claims change over time',
  phases: [
    { title: 'Explore', detail: 'one agent per company, 8-15 pages each' },
    { title: 'Verify', detail: 'adversarial spot-check of extracted claims' },
    { title: 'Third-party', detail: 'reviews, news/funding/analysts, head-to-head comparisons' },
  ],
}

// args may arrive as a JSON object or a JSON-encoded string depending on the caller — handle both,
// and fall back to the canonical roster from SKILL.md if none is provided.
const input = typeof args === 'string' ? JSON.parse(args) : (args || {})
const COMPANIES = (input.companies && input.companies.length) ? input.companies : [
  { name: 'Kai', domain: 'kai.security' },
  { name: 'Armadin', domain: 'armadin.com' },
  { name: 'Astelia', domain: 'astelia.io' },
  { name: 'Artemis', domain: 'artemissecurity.com' },
  { name: 'Cogent', domain: 'cogent.com' },
  { name: 'Zafran', domain: 'zafran.io' },
]
const TODAY = input.date || 'the run date (caller did not pass one)'
const names = COMPANIES.map(c => `${c.name} (${c.domain})`).join(', ')

const AMBIGUITY_NOTE = 'Several of these names are ambiguous — e.g. Cogent Communications is an unrelated ISP, and "Artemis"/"Kai" collide with unrelated products. Before recording anything, confirm it refers to the AI cybersecurity company at the listed domain.'

const CLAIMS_SCHEMA = {
  type: 'object',
  required: ['company', 'site_status', 'positioning', 'product_summary', 'use_cases', 'claims', 'proof_points', 'target_market', 'pricing', 'pages_reviewed'],
  properties: {
    company: { type: 'string' },
    site_status: { type: 'string', description: "'ok', or note redirects, rebrands, 'domain mismatch - product actually at <url>', or 'unreachable'" },
    positioning: { type: 'string', description: 'one-sentence positioning, in their own words where possible (hero/headline copy)' },
    product_summary: { type: 'string', description: '3-5 sentence neutral summary of what the product does' },
    use_cases: {
      type: 'array',
      description: "every advertised use case / product module, under the vendor's own marketing name",
      items: {
        type: 'object',
        required: ['name', 'description', 'source_url'],
        properties: {
          name: { type: 'string', description: "the vendor's marketing name for the use case or module" },
          description: { type: 'string', description: 'one-line description of what is promised' },
          source_url: { type: 'string' },
        },
      },
    },
    claims: {
      type: 'array',
      items: {
        type: 'object',
        required: ['category', 'claim', 'source_url'],
        properties: {
          category: { type: 'string', description: 'one of: ai-autonomy, detection-response, coverage-integrations, metrics, compliance-certs, deployment, pricing, target-customer, other' },
          claim: { type: 'string', description: 'the claim, paraphrased tightly' },
          quote: { type: 'string', description: 'short verbatim quote from the page' },
          source_url: { type: 'string' },
        },
      },
    },
    proof_points: { type: 'array', items: { type: 'string' }, description: 'named customers, case studies, certifications, benchmarks, analyst badges' },
    target_market: { type: 'string' },
    pricing: { type: 'string', description: "published pricing/packaging, else 'not published'" },
    pages_reviewed: { type: 'array', items: { type: 'string' } },
  },
}

const VERIFY_SCHEMA = {
  type: 'object',
  required: ['company', 'checked', 'issues', 'overall_assessment'],
  properties: {
    company: { type: 'string' },
    checked: {
      type: 'array',
      items: {
        type: 'object',
        required: ['claim', 'verdict'],
        properties: {
          claim: { type: 'string' },
          verdict: { type: 'string', description: 'confirmed | misquoted | overstated | page-missing | could-not-check' },
          note: { type: 'string' },
        },
      },
    },
    issues: { type: 'array', items: { type: 'string' }, description: 'anything that smells wrong in the extraction overall' },
    overall_assessment: { type: 'string' },
  },
}

const TP_SCHEMA = {
  type: 'object',
  required: ['sweep', 'findings'],
  properties: {
    sweep: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['companies', 'source', 'finding'],
        properties: {
          companies: { type: 'array', items: { type: 'string' } },
          source: { type: 'string' },
          url: { type: 'string' },
          finding: { type: 'string' },
          date: { type: 'string' },
        },
      },
    },
  },
}

function explorePrompt(c) {
  return `You are doing competitive analysis of PUBLIC marketing material. Today is ${TODAY}.

Target company: ${c.name} — start at https://${c.domain}

If WebFetch/WebSearch are deferred, load them via ToolSearch (query "select:WebFetch,WebSearch"). Then:
1. Fetch the homepage; note the hero/headline copy and enumerate the navigation links.
2. Fetch every substantive page, prioritizing: product/platform, how-it-works, solutions/use-cases, integrations, customers/case studies, pricing, security/trust/compliance, about, and 2-3 recent blog or announcement posts. Review at least 8 distinct pages — 12-15 if the site is large. If a fetch fails, retry once, then move on.
3. Sanity check: if ${c.domain} is unreachable, parked, redirects elsewhere, or clearly hosts something that is NOT an AI cybersecurity product, use WebSearch ("${c.name} AI cybersecurity") to find the company's actual current website, record what happened in site_status, and analyze the correct site instead. If the site blocks automated fetching (e.g. Cloudflare 403), fall back to the most recent Internet Archive / Wayback Machine snapshot (https://web.archive.org/web/https://${c.domain}) and record the snapshot date in site_status. When fetching a Wayback Machine / Internet Archive snapshot, use curl via the Bash tool instead of WebFetch (load Bash via ToolSearch if it is deferred) — WebFetch is unreliable against archive.org's snapshot wrapper. ${AMBIGUITY_NOTE}

Extract the company's PRODUCT CLAIMS — what they promise customers, as stated on the site TODAY (ignore any prior knowledge you have of this company). FIRST, enumerate EVERY advertised use case / product module under the vendor's own marketing name (fill use_cases) — this inventory of how the company markets itself is a primary deliverable. Then prioritize:
- Marketing framing: taglines, category labels, exclusivity superlatives ("first", "only", "leading") — capture how they sell, not just what they sell
- AI/autonomy claims ("autonomous", "agentic", "AI analyst", human-in-the-loop framing)
- Quantified claims (percentages, time-to-X, coverage counts, false-positive rates, ROI numbers)
- Detection / response / remediation capability claims
- Coverage and integration claims (environments, ecosystems, tool integrations)
- Compliance and certifications (SOC 2, ISO 27001, FedRAMP, ...)
- Named customers, partners, case-study outcomes, analyst recognition
- Pricing/packaging and target customer segment

For every claim record a short verbatim quote and the exact source URL.`
}

function verifyPrompt(c, claims) {
  return `Adversarial fact-check. Today is ${TODAY}. The JSON below contains product claims another analyst extracted from ${c.name}'s website (start domain ${c.domain}; see site_status for where they actually landed).

Pick the 6 most consequential claims — prefer quantified claims and AI/autonomy claims. For each, load WebFetch via ToolSearch (query "select:WebFetch") if it is deferred, then re-fetch the cited source_url and check that the claim and quote are accurately represented. Verdicts: confirmed, misquoted, overstated (paraphrase stronger than the page), page-missing, could-not-check. Also flag anything that smells wrong in the extraction overall (impossible numbers, copy attributed to the wrong company, claims with no source).

${JSON.stringify(claims)}`
}

const SWEEPS = [
  {
    key: 'reviews',
    prompt: `Today is ${TODAY}. Gather third-party buyer and practitioner perspective on these AI cybersecurity companies: ${names}.

If WebSearch/WebFetch are deferred, load them via ToolSearch (query "select:WebFetch,WebSearch"). Search G2, Gartner Peer Insights, PeerSpot, TrustRadius, Reddit (r/cybersecurity, r/netsec, r/blueteamsec), and Hacker News — at least 2 searches per company. Several are early-stage startups; if a company has no review footprint, record that as a finding rather than skipping it. Capture what users say the product does well or poorly, deployment experience, pricing complaints, and any stated preference between these vendors. Cite source and URL for each finding. ${AMBIGUITY_NOTE}`,
  },
  {
    key: 'news',
    prompt: `Today is ${TODAY}. Gather recent news on these AI cybersecurity companies: ${names}.

If WebSearch/WebFetch are deferred, load them via ToolSearch (query "select:WebFetch,WebSearch"). Find funding rounds, product launches, partnerships, analyst coverage (Gartner / Forrester / IDC mentions, market guides, hype cycles), and notable customer wins — prioritize the last 18 months, at least 2 searches per company. Cite source, URL, and date for each finding. ${AMBIGUITY_NOTE}`,
  },
  {
    key: 'comparisons',
    prompt: `Today is ${TODAY}. Find DIRECT comparisons among these AI cybersecurity companies: ${names}.

If WebSearch/WebFetch are deferred, load them via ToolSearch (query "select:WebFetch,WebSearch"). Search for "X vs Y" pages, "alternatives to X" listicles, market-landscape posts (AI SOC analyst landscape, autonomous SOC market maps, exposure-management comparisons), and competitive/alternatives pages the vendors publish about each other. For each, record which companies are compared, what criteria are used, and who the source favors. Cite URLs. ${AMBIGUITY_NOTE}`,
  },
]

log(`Live sweep of ${COMPANIES.length} company sites + ${SWEEPS.length} third-party angles (data as of ${TODAY})`)

const thirdPartyPromise = parallel(
  SWEEPS.map(s => () => agent(s.prompt, { label: `3p:${s.key}`, phase: 'Third-party', schema: TP_SCHEMA }))
)

const companies = await pipeline(
  COMPANIES,
  c => agent(explorePrompt(c), { label: `explore:${c.name}`, phase: 'Explore', schema: CLAIMS_SCHEMA }),
  (claims, c) =>
    claims
      ? agent(verifyPrompt(c, claims), { label: `verify:${c.name}`, phase: 'Verify', schema: VERIFY_SCHEMA })
          .then(v => ({ claims, verification: v }))
      : null
)

const thirdParty = (await thirdPartyPromise).filter(Boolean)
const ok = companies.filter(Boolean)
if (ok.length < COMPANIES.length) {
  const failed = COMPANIES.filter((c, i) => !companies[i]).map(c => c.name)
  log(`WARNING: sweep failed for: ${failed.join(', ')}`)
}
return { date: TODAY, companies: ok, thirdParty }
