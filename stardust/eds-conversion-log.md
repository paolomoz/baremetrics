# baremetrics — EDS conversion log

Source prototypes: `../baremetrics/stardust/prototypes/*-proposed.html` (15 approved pages,
"The Ledger" design system per `../baremetrics/DESIGN.md`).
Section schemas: `../baremetrics/stardust/eds-schema/<slug>.json` (#93).
Fingerprints: `../baremetrics/stardust/eds-fingerprints/<slug>.json` (#90).
Runtime contract: `../baremetrics/stardust/runtime-contract.json` — **authorkit**, `blockWrapperClass: none`
(CSS scopes `.<name>`, NEVER `.<name>.block`), buttons `.btn/.btn-primary/.btn-secondary`, fragments inert.

Targets: code → github.com/paolomoz/baremetrics · content → DA `/paolomoz/baremetrics` (David's model).

## LOCKED DECISIONS (naming + reuse) — 2026-07-11

Autonomy note: locked by the agent per the session's standing hands-off directive; every decision
below is reviewable here before deploy.

### Chrome
- `fragments/header.html` + `fragments/footer.html` — static fragments lifted from canon
  (`../baremetrics/stardust/canon/`). Mobile nav = CSS checkbox hack (prototype JS is inert in fragments).
  Locale dock = CSS-only details/summary… → pure CSS hover/focus menu (no JS).

### Shared canonical blocks (David's-model library; ONE block + variants) — owner: Wave A "library" agent
| Block | Variants | Used by |
|---|---|---|
| `masthead` | default, `form` (subscribe row), `search` (kb), `counter` (+800 pull in h1), `versus` (two-beat), `art` (flanking illustrations), `tool` | pricing, blog, glossary, experts, open-startups, help, about, ltv-calc, compare, customers |
| `ledger` | `entries` (+inert pagination foot), `terms` (letter groups), `experts`, `revenue`, `publications`, `collections` | blog, glossary, experts, open-startups, stripe, help |
| `cards` | `cases` (window-chromed 2-col), `triptych` (3-col hairline), `mosaic` (dotted partitions), `roster` (team), `filmstrip` | customers, home, stripe, about |
| `quote` | `sheet` (record sheet inline), `band` (sheet on ink band), `trio` (testimony trio) | recover, stripe, customers |
| `band` | grounds `ink`/`tint`/`accent` × shapes `cta`, `form`, `stats`, `pull` (pull-figure), `author` | recover, compare, stripe, about, blog-article, founder-chats, open-startups, ltv-calc, help, home |
| `logos` | `table` (ruled cells), `strip`, `banded` (tint + heading), `counter` (accent +900 row, inverted marks) | home, customers, stripe, compare, recover |
| `accordion` | default (FAQ; h3>button; panels open no-JS) | recover, compare |
| `sheets` | `honest` (concessions+icons), `addons`, `support` (stat trio), `note` (method) | compare, pricing, ltv-calc |
| `steps` | default (single-spine 4-step), `entries` (spine ledger rows) | recover, stripe |
| `checklist` | default (red-✗ lists + window-chromed screenshots) | recover |
| `toc` | default (sticky rail + More-Articles; `<details>` ≤900px) | blog-article, founder-chats |

### Bespoke blocks (genuinely unique; mostly template-slotted #95)
| Block | Tier | Page | Owner |
|---|---|---|---|
| `hero` | template-slotted | home statement hero (dotlottie + h1 carousel; SVG fallback; reduced-motion + saveData gates) | B1 |
| `rate-card` | template-slotted | pricing connected 3-plan table (ink Growth col = fingerprint variant), inert annual switch | B2 |
| `compare-table` | reconstructive | compare grouped matrix (true <table>, ✓/✗ glyph cells, role-retaining stack ≤640) | B2 |
| `feature-hero` | template-slotted; variants `recover` ($423.77 sheet aside), `integration` (wordmark pairing + exhibit) | recover, stripe | B3 |
| `calc-row` | template-slotted | recover pricing calculator ledger row (inert slider) | B3 |
| `article-head` | template-slotted; variants `article` (topbar+byline+exhibit), `episode` (+play sheet + iTunes line) | blog-article, founder-chats | B4 |
| `transcript` | reconstructive | founder-chats speaker-turn spine (prefix `<strong>` preserved) | B4 |
| `calculator` | template-slotted | ltv-calc inert instrument (readonly inputs, switches, results pulls) | B5 |
| `templates/article` | template CSS | article prose typography (formula sheets, quote sheets, window-chromed figures as default content styling) | B4 |

### Agent ownership (no shared-file collisions)
- **Wave A "library"** (1 agent, runs first): the 11 shared blocks + content for blog, glossary,
  experts, open-startups, help (they exercise masthead/ledger/band/logos). block-roundtrip per page.
- **Wave B** (parallel, reuse library; MAY NOT edit shared block files — a missing variant goes in
  `blocks/<name>/_patches/<page>.css` + a report line; main loop merges):
  B1 home · B2 pricing+compare · B3 recover+stripe · B4 blog-article+founder-chats · B5 customers+about+ltv-calc.

### Foundation decisions
- Tokens: lifted from prototype `:root` (The Ledger — hex forms for EDS simplicity where the proto
  used oklch; the oklch values ARE the DESIGN.md tokens, keep oklch, they're supported everywhere EDS runs).
- Fonts: **Inter 400 + 700 extracted from the prototypes' own embedded woff2** (the captured brand
  font; OFL — no licensing alert needed) → `styles/fonts/inter-{400,700}.woff2`. `body.session`
  gate + metric-matched `"Arial"` override @font-face (fonttools-computed). 700 serves 600–800
  (font-weight ranges in @font-face). No head.html font lines.
- Buttons: `.btn` family per ak.js decorator; primary = action #4055E8 fill; secondary = outline
  (surface-aware overrides scoped to `.section.dark` AND on-ink block classes, #41).
- Header reservation: `header { min-height: 73px }` (measure from prototype; responsive at ≤1150px).
- `main .section:empty { display: none }` (emptySectionCollapse=true).
- Favicon: `../baremetrics/stardust/current/assets/favicon.png` → repo root + head.html link (the one edit).

### Known gaps (recorded, not blockers)
- JSON-LD from prototypes is NOT carried into EDS pages v1 (EDS metadata block covers title/desc/OG;
  structured data injection would need a head snippet or block JS — deferred, logged per page).
- dotlottie hero uses the external unpkg module in the prototype: block JS will attempt dynamic
  import behind the same motion/width/saveData gates with the SVG dashboard fallback (CSP
  strict-dynamic allows it); if it fails in preview, ship fallback-only and log.
- 156 origin links to unmigrated inventory pages remain absolute (baremetrics.com) — same
  scoped-run carve-out as migrate.
- Forms (subscribe/search) render as non-submitting chrome per the fragments-CSP rule and the
  owner decision to replace HubSpot; wire a static-form service later.

### Decode-tier notes
- All `ledger`/`cards`/`quote`/`band`/`sheets`/`accordion`/`steps`/`checklist`/`compare-table`/
  `transcript`/`toc`/`masthead` decorate via the cell-cascade collector (#62/#68/#71), classify by
  content (#48), segment repeat units on the most-frequent heading boundary with delimiter fallback
  (#52/#63), media matched `picture, img` (#72), text read by CELL not `querySelectorAll('p')` (#79).
- Template-slotted blocks hold the prototype section DOM verbatim and slot authored values by role.

## B4 — blog-article + founder-chats (2026-07-11)

Files: `blocks/article-head/*`, `blocks/transcript/*`, `templates/article/article.css`,
`blocks/band/_patches/blog-customer-retention-metrics.css`, `content/blog/customer-retention-metrics.html`,
`content/founder-chats/natalie-nagele.html` (+ `qa/{customer-retention-metrics,natalie-nagele}.html`,
`stardust/build-content-b4.mjs`, `stardust/qa-gate-b4.mjs`). Reuses `toc` + `band` untouched.

- **Template loader (VERIFIED)**: `scripts/ak.js loadTemplate()` loads ONLY
  `templates/<t>/<t>.css` — there is NO template JS loader. So `templates/article/article.js`
  does not exist; the template's one JS behaviour (win-chroming prose chart images) lives in
  `blocks/article-head` (`winChromeProse()`), which every article page carries by definition.
- **Article-body structure (decode, documented)**: ONE section, section-metadata
  `style: article-body` (blog) / `article-body, episode` (founder). The toc block + the prose
  (default content on blog; the `transcript` block on founder) share the section; the template
  makes the SECTION the rail+prose grid and `display: contents` on `.block-content`/`.toc`
  promotes the toc's disclosure/rail and the prose to grid items — so ≤900px the disclosure sits
  ABOVE the prose and the More-Articles rail BELOW it (prototype reading order) from one block.
  `.episode` hides the disclosure (F-006: single-entry TOC not duplicated).
- **Prose authoring convention (DA strips div/figure — blockquote is the carrier)**:
  formula sheet = `<blockquote>` with the formula line in `<code>` (first `<p>` = "Formula" label);
  quote sheet = `<blockquote>` without code — first `<p>` = source meta-label, last `<p>` =
  attribution with the NAME in `<em>` (never strong: strong>a would trip ak.js's button decorator);
  chart figure = `<p><img></p>` + caption `<p>` (win chrome added by article-head JS).
  Template CSS differentiates via `blockquote:has(code)`.
- **Transcript authoring**: one row per paragraph (142 rows), innerHTML byte-verbatim, extracted
  programmatically (`build-content-b4.mjs`). Decode: `<strong>Name:</strong>` prefix = turn
  boundary; unprefixed paragraphs attach to the preceding turn; speakers map in encounter order
  to `.turn-a` (ink) / `.turn-b` (periwinkle). transcript.js also patches `id="more-articles"`
  onto the toc rail's More-Articles nav (rAF wait) — MERGE SUGGESTION: toc.js should set
  `nav.id = toClassName(label)` on its `.more-articles` group.
- **_patches**: `blocks/band/_patches/blog-customer-retention-metrics.css` — the 21-char
  newsletter title "Subscribe for Updates" trips band.js's short-text→eyebrow heuristic; patch
  restyles `.band.form .band-eyebrow` as the form title (safe: no other form band authors a true
  eyebrow). Cleaner js fix noted in the patch header.
- **Heading ids**: blog h2s carry explicit ids matching the EDS pipeline's slugs
  (`1-customer-retention` …) so TOC anchors resolve in the local harness too.
- **Gates**: block-roundtrip exit 0 / 0 structural 🔴 on both pages (blog: article-head + toc
  [mapped to the whole `[data-section="article"]` incl. prose — 130/130 text nodes] + band×2;
  founder: two runs since article-head spans episode-masthead+episode-sheet; transcript vs
  `.transcript` = 270/270 body nodes = 142 paragraphs + 128 prefixes). Roundtrip used
  `--styles` concat of styles.css + article.css + band patch + a harness adapter (the harness
  renders raw authored DOM without runtime section/template classes; adapter mirrors the
  blockquote meta-label rule only). Harness gate (`qa-gate-b4.mjs`): one h1, no outline skips,
  anchors resolve, measure 67.9ch/71.3ch @1440, transcript 142/142 byte-identical + 128/128
  turns w/ exact speaker attachment, 0 overflow @360/1440, 0 pageerrors. Screenshots
  `qa/{shot,proto}-{article,episode}-{1440,390}.png` eyeballed — parity.
- **Deviations recorded**: (1) JS-off shows an empty main — foundation `main > div {display:none}`
  until ak.js decorates; site-wide, needs a head-level noscript (Wave-A head.html) if wanted.
  (2) ≤640 h1 is 38px (foundation clamp) vs prototype's 34px override; gutters 24px vs proto 16px —
  foundation-scale choices, consistent site-wide. (3) band form title renders 700 body-font
  (Wave-A band.css) vs proto's 800 heading-font `.nl-title` — locked Wave-A shape.
  (4) JSON-LD per-page not carried (known gap, logged site-wide).

## Deploy + post-deploy reconcile (2026-07-12)

**Deployed:** code branch `stardust-conversion` → github.com/paolomoz/baremetrics (Code Sync);
content → DA `/paolomoz/baremetrics` via deploy-batch (PUT→preview→live, sanitised from
`content-staged/`). All 15 pages delivered `live`, 0 failed.

**Live URLs:** `https://stardust-conversion--baremetrics--paolomoz.aem.live/<path>` (branch;
production `main` deliberately untouched — merge branch→main to promote).

**Merge step (was pending, now done):** the 23 Wave-B `_patches/*.css` were only linked in local
QA harnesses — EDS loads `blocks/<name>/<name>.css` only, so they were MISSING live. Folded all 23
into their block CSS (scoped by per-page variant classes; patch dirs removed). This is the load-bearing
fix the Wave-B `_patches` convention intends.

**Post-deploy content-diff (live, per template):** 0 structural 🔴 on all 15.
- 2 reds found + fixed: (a) customers form label rendered VISIBLE meta-label vs prototype sr-only →
  fixed by the merged masthead/customers patch (clip sr-only); (b) founder-chats newsletter title
  rendered small-eyebrow vs 28px title → fixed by the merged band `.band.form .band-eyebrow` override.
- 1 red found + fixed in block JS: stripe "our live preview" → demo.baremetrics.com link dropped.
  ROOT CAUSE (#79 variant): ak.js wraps the note cell's leading text in a `<p>` and leaves the bare
  `<a>` a SIBLING; feature-hero's `querySelector('p')` grabbed only the text. Fixed by flattening ALL
  note-cell child nodes (unwrapping inner `<p>`) into one paragraph. Committed + re-verified 56/56.
- Advisory only (accepted): founder-chats toc rail labels ("Table of Contents"/"More Articles") land
  in eyebrow/cta role buckets vs the prototype's heading bucket — chrome, not dropped content;
  glossary 1 non-structural advisory.

**Final computed-layout gate (live aem.live, all 15):** 200 · one h1 · every block decorated ·
grids/flex compute (no `.block`-scoping display:block fallback) · 0 broken images · 0 pageerrors.
open-startups' earlier `gridflex:0` was a false negative (2-level probe depth + masthead `art` uses
absolute positioning; `.rev-row` grid confirmed at depth 3).

**Known deferrals (recorded):** per-page JSON-LD not injected (Organization/WebSite JSON-LD ships
site-wide via head.html; page-type structured data deferred); subscribe/search forms are non-submitting
chrome (owner decision: replace HubSpot); 156 origin links to unmigrated inventory pages remain
absolute (scoped-run carve-out); proprietary-font licensing N/A (Inter is OFL).

## Fix: section top-padding (2026-07-12, preview)

**Reported:** section heads (home growth mosaics, "Join the movement" filmstrip, about roster)
butted the section above with no top breathing room.

**Root cause:** the prototype uses SYMMETRIC vertical padding on every section
(`--section-padding` top+bottom, 56/56 or 48/48), but `blocks/cards/cards.css` was authored
`padding-block: 0 var(--section-padding)` (zero top). The cards block carries the reabsorbed
section head, so at top:0 the head sat flush.

**Fix:** `.cards { padding-block: var(--section-padding); }` (symmetric) — matches the prototype;
universally safe since every cards instance carries a head and every prototype section is symmetric.

**Audited all 15 pages** for the same class of bug (visible-head butting). Confirmed the other
`padding-block: 0 X` blocks are INTENTIONAL prototype-faithful continuations, verified against the
prototypes' own section padding:
- `ledger` (open-startups revenue pt:0 / help collections pt:0 / blog entries pt:0): the preceding
  masthead carries the bottom spacing (open-startups masthead pb:76, help pb:32) — matches proto.
  The audit's flags there were sr-only heads (clipped elements measure at top:0) — false positives.
- `sheets.note` (ltv-calc method): proto method-note is pt:0 with a hairline top rule + METHOD label
  register following the calculator (pb:56) — verified visually correct.
- `band.guarantee`, `quote.note`: in-flow continuations of a preceding block (recover ROI, feature
  promos) — no head, correctly top:0.

Post-fix re-audit: 0 visible-head butting sections across all 15 pages (2 residual flags are the
publications kicker→heading pair and the ltv-calc hairline-separated method note — both correct).
CSS-only change; served on both .page and .live via the shared code bus (no content re-publish).
