# Go-Live Readiness — baremetrics.com EDS migration

_Status as of 2026-07-14. Current state: **1,024 pages live on the staging/preview
delivery (`main--baremetrics--paolomoz.aem.live`)**, rendering correctly across all
15 templates. **NOT yet cut over to production `baremetrics.com`.** This is the
punch list to close before the go-live switch._

---

## A. Content items to finish (known, deferred — come back before go-live)

| # | Item | State | Notes |
|---|------|-------|-------|
| A1 | **`/build-vs-buy` calculator** | parked (task #26) | Interactive cost calculator. Site convention renders calculators inert (launch-wired); exact formula not reliably reproducible. Awaiting user/product discussion on representation. |
| A2 | **`/ja/pricing`** | parked (task #30) | Live source is an interactive MRR-slider flow (tool-selector + logo strip + prices that SCALE with MRR + comparison sections). Current static rate-card WIP (unwired) misrepresents scaling. Needs a dedicated pass. On generic fallback for now. |
| A3 | **JA flagship integrations richness** | decision (task #32) | `ja/stripe`, `ja/braintree`, `ja/chargebee`, `ja/recurly`, `ja/apple-itunes-app-store-connect`, `ja/google-play` (+ flagship features `recover`, `cancellation-insights`) render simpler than EN because EN versions are bespoke hand-crafted (B3) while JA uses the generic builder. Coherent, not broken — but under-represents the rich JA captures. Investment decision: accept / enrich generic builder / hand-craft JA flagships. |
| A4 | **2 `jp/blog` pages with native-Japanese URL slugs** | skipped at migration | DA rejects non-ASCII paths. Need romaji slugs + redirects from the original Japanese URLs (product decision). |

## B. SEO & discoverability

| # | Item | State | Notes |
|---|------|-------|-------|
| B1 | **Redirect map (old → new, 301)** | ✓ done | URL parity checked across the full inventory: **1,019/1,030 paths match 1:1**. Authored + published 11 redirects (`/redirects.json` in DA, applied at the edge — all verified 301→200, single hop, no loops) for slug sanitizations (`.`→`-`, `/`→`-`), the `/en/jp/` prefix drop, `help/kb-*`→`help/help-kb-*`, `/ja`→`/ja/about`, and 3 HubSpot test-page artifacts→`/`. Record copy: `stardust/redirects.json`. Re-verify on production host at cutover (B7). |
| B2 | **`llms.txt`** | ✗ missing (404 live) | A direction goal. Generate from the page inventory. |
| B3 | **Per-template JSON-LD** (Article / Product / FAQ / BreadcrumbList) | ✗ missing | Only site-wide Organization/WebSite JSON-LD exists (head.html). Direction goal = "server-rendered JSON-LD per template." No per-page JSON-LD in content today. |
| B4 | **OpenGraph per template** (og:image + og:type) | ⚠ verify / likely gap | Direction T-6. Sampled content pages carry no `Image` metadata row → og:image likely absent on most pages. Audit + backfill. |
| B5 | **sitemap.xml** | ⚠ auto-served (200) | EDS serves one; verify it covers all live pages and emits production URLs at cutover. |
| B6 | **robots.txt** | ⚠ auto-served (200) | Preview infra typically disallows crawl — MUST flip to production-allow at cutover. |
| B7 | **Canonical URLs** | ⚠ verify | Confirm canonical points to production `baremetrics.com`, not the aem.page/live host, per template. |

## C. Cutover mechanics

| # | Item | State | Notes |
|---|------|-------|-------|
| C1 | **Domain cutover** | ✗ not done | Site is on `*.aem.page` / `*.aem.live` under `paolomoz`. Production DNS/CDN (Fastly/Cloudflare) → `baremetrics.com` is the actual go-live switch. |
| C2 | **404 wiring** | ⚠ verify | `404.html` exists; confirm it's the served 404 on the production config. |
| C3 | **Analytics** | ⚠ verify | RUM present (deps/rum.js). Confirm any product/GA/marketing analytics from the old site are re-added. |

## D. Interactive / forms (currently inert — decide launch behavior)

| # | Item | State | Notes |
|---|------|-------|-------|
| D1 | **Subscribe forms** | inert chrome | Email capture is inert; wire real submission (or confirm launch script) before go-live. |
| D2 | **book-a-demo** | inert band | HubSpot scheduler not reproduced (owner decision). Decide launch behavior. |
| D3 | **Help search** (`help-kb-search-results`) | inert | "Search active at launch" — confirm the launch wiring. |
| D4 | **Calculators** (build-vs-buy, ltv-calc, ja/pricing MRR) | inert / launch-wired | Confirm the launch-time computation scripts exist and fire. Ties to A1/A2. |

## E. Final validation (before flipping DNS)

| # | Item | State | Notes |
|---|------|-------|-------|
| E1 | **Comparative re-audit vs 63/100 baseline** | not run | Direction's core success metric — prove every layer (conversion, a11y, hierarchy, perf, brand, seo, llm) improved. Run per-template on the migrated site. |
| E2 | **Full-inventory internal link check** | not run | Crawl all 1,024 pages for broken internal links / bad redirect targets. |
| E3 | **a11y (AA + 44px) + perf (LCP/CLS) sweep** | partial | Per-template audit ran at migration; do a final full sweep on the live delivery. |
| E4 | **Cross-browser / device QA** | not run | Spot-check key templates on Safari/Firefox/mobile. |

---

## Cleared (no longer blocking)
- All EN pages: clean (1 h1 each; no flattening after the accelerator/affiliate fixes).
- Localized flattening: fixed (ja/about, open-startups, benchmarks, jp/blog, affiliate, wall-of-love, customers, legal templates).
- Localized feature triptych (Tier 3 small-gap): fixed — 11 ja/features pages now render the explore grid.
- Proactive quality sweep: complete; no remaining clear defects (only the A/B/C/D/E items above).
