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
