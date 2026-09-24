# ScamShield redesign plan

Status: **plan only, no application code has changed.** Baseline commit: `86fd98a`, branch `claude/bold-dirac-rk5uw8`.
Companion file: [`REDESIGN_CHECKLIST.md`](REDESIGN_CHECKLIST.md), the definition of done. Every item there can be checked with a command.

### Decisions log (answers to the open questions, 2026-09-24)

| # | Topic | Decision | Where it lands |
|---|---|---|---|
| D1 | Absolute site URL | Read `SITE_URL`, fall back to `RENDER_EXTERNAL_URL`; **production startup fails with a clear error if neither is set**. `og:image` and `og:url` are always absolute | §4.1.1, `SITE-*` |
| D2 | CSV export | Keep. OWASP CSV-injection escaping (prefix `'` for leading `=`, `+`, `-`, `@`, tab, CR), quote and escape every field, UTF-8 BOM, unit tests for each dangerous prefix plus commas, quotes and newlines | §4.3.1, `CSV-*` |
| D3 | E2E tooling | Playwright + axe. CI installs **Chromium only** (`npx playwright install --with-deps chromium`) and caches the browser directory | §5.4, §7.1, `CI-*` |
| D4 | Home counters | Caption row; **never render a stat whose value is 0; hide the row if all are 0**. Persistence finding in §4.2.1; resolved by D9 (ephemeral, so a "since last restart" qualifier is added) | §4.2, `HOME-*` |
| D5 | Score visual | Linear bar with `role="meter"`, `aria-valuemin/max/now` (+ `aria-valuetext`); numeric score and text label always shown next to the bar | §4.3, `RES-01` |
| D6 | Fonts | Self-hosted latin-subset variable woff2, `font-display: swap`, preload **only** the primary Inter file, OFL licence files shipped, system font stacks as fallback | §3.2.1, `FONT-*` |
| D7 | Theme toggle | Not needed. `prefers-color-scheme` only | A2 |
| D8 | GitHub Pages redirect page | Leave as is. Out of scope | n/a |
| D9 | Storage persistence (Q9) | The live service is a **Render Free instance with no persistent disk**. Build the counters as specified with a **"since last restart"** qualifier; show a **temporary-storage notice** wherever reports are submitted or listed, and never imply permanence. Persistence is follow-up FU-1 (§9) | §4.2.1, §4.8, §9, `HOME-05`, `STORE-*` |

Workstreams, in priority order:

1. UI/UX redesign
2. Codebase cleanup
3. README rewrite
4. Logo redesign

The logo work is scheduled *before* the README (see §7) because the README shows the logo.

---

## 0. Method, principles and assumptions

### 0.1 Rubric

The requested `apple-design` skill is not installed in this environment. It isn't in `~/.claude/skills`, not in the repo's `.claude/`, and a filesystem-wide search found nothing. As agreed, the plan applies Apple's Human Interface Guidelines directly. Every design decision below traces back to one of these rules:

| HIG principle | What it means for ScamShield | Concrete rule used in this plan |
|---|---|---|
| **Clarity** | The indicator and the verdict are the most important pixels on the screen | One accent colour. Type scale limited to 8 steps. Status is always written as a word, never shown only as a colour. Copy is literal. |
| **Deference** | Chrome (header, cards, buttons) steps back from content | Neutral surfaces, hairline borders, the logo in `currentColor`. No decorative glows, grids or gradients. The accent is reserved for interactive elements and focus. |
| **Depth** | Hierarchy comes from layering, not decoration | Three surface levels (`bg`, `surface`, `surface-2`) and one overlay shadow. The only material (blur) is on the sticky header. |
| **Consistency** | The same thing looks and is named the same everywhere | Token-only styling enforced by `scripts/lint-design.mjs`. One `Button`, one `ExternalLink`, one `SignalList`. A single verb, "Look up". |
| **Feedback** | Every action gets an immediate, honest response | Designed loading, empty, error and rate-limited states. Motion ≤200 ms. Determinate progress ("12 of 22 sources"). |
| **Accessibility** | Treated as a hard requirement, not polish | WCAG 2.2 AA: contrast verified by script, axe checks at zero violations, full keyboard paths, visible focus, `prefers-reduced-motion`. |

### 0.2 Assumptions

| # | Assumption | Why | If it's wrong |
|---|---|---|---|
| A1 | The HTTP API and `shared/types.ts` stay unchanged | The redesign is client-side; third-party API consumers must not break | If the API has to change (e.g. a CSV export endpoint), it gets its own PR with versioned types |
| A2 | Theme follows the OS (`prefers-color-scheme`), with no manual toggle | Needs zero JS, so the CSP `script-src 'self'` stays intact and there's no flash of the wrong theme | A toggle needs an external `theme.js` loaded before first paint plus `localStorage`. That's about half a day of work |
| A3 | Tailwind stays at 3.4 | The audit found no problem that v4 fixes and CSS variables don't | A move to v4 would change the token mechanism (§3.8) from `tailwind.config.ts` to `@theme` in CSS |
| A4 | Fonts are self-hosted (confirmed, D6) | Helmet's default CSP allows `font-src 'self'`; no third-party requests (privacy) | n/a (decided) |
| A6 | The public origin is known at **runtime**, not build time (D1) | `docker build` and GitHub CI have no `SITE_URL`/`RENDER_EXTERNAL_URL`, and one image must be deployable to any host. So the check is a fail-fast at **startup** rather than a build failure | If you require a build-time failure, `vite.config.ts` must read the variable and every CI/Docker build must pass it. See §4.1.1 |
| A5 | Tests use Playwright with `page.route()` mocks | Live OSINT sources are slow and non-deterministic. Mocks make UI states reproducible | Without e2e tests, about 40% of the checklist becomes manual |

---

## 1. Feature inventory (zero-regression contract)

Every row must still work after the redesign. `FEAT-*` in the checklist maps one e2e test to each row.

| # | Feature | Route / component | Must-keep behaviour |
|---|---|---|---|
| F1 | Universal search input | `/`, `/search` · `components/SearchBox.tsx` | One field for email/domain/URL/IP/phone/message; `detectType()` live type badge; **Enter submits, Shift+Enter inserts newline**; autosizes up to 240 px; accepts defanged input (`hxxp://evil[.]com`); navigates to `/search?q=<encoded>`; `busy` disables submit |
| F2 | Example queries | `/` · `SearchBox.tsx:7` `EXAMPLES` | The 6 examples (phishing domain, email, short link, phone, IP, SMS) each open a lookup in one click |
| F3 | Public counters | `/` · `pages/Home.tsx:84-89` → `GET /api/stats` | Lookups run, community reports, reports (24 h), known scam indicators; refetch every 60 s |
| F4 | Capability overview | `/` · `Home.tsx:7-38` | Per-target-type list of what gets checked |
| F5 | Streaming lookup | `/search?q=&type=` · `lib/api.ts` `useLookupStream` → `GET /api/lookup/stream` (SSE) | `start` lists planned sources and shows them as pending; each `check` event fills its source in place; `done` delivers the report; `error` shows a message; the connection is closed on unmount |
| F6 | Forced type | `/search?type=` · `Search.tsx:18-19` | A valid `type` param overrides auto-detection; an invalid one is ignored |
| F7 | Grouped results | `Search.tsx:13,27-37` | Category order: community → reputation → content → identity → exposure → infrastructure → pivots; skipped sources hidden from groups |
| F8 | "Not run" list | `Search.tsx:122-126` | Skipped sources listed with their reason |
| F9 | Target header | `Search.tsx:71-89` | Type label; normalized indicator; message targets truncated at 140 chars; `cached · <relative time>` or duration in seconds |
| F10 | Copy link | `Search.tsx:51-55` | Copies the current URL (the shareable lookup) |
| F11 | JSON export | `Search.tsx:41-49` | Downloads the full `LookupReport` as `scamshield-<type>-<epoch>.json`; disabled until done |
| F12 | Re-scan | `Search.tsx:97-99` → `fresh=1` | Bypasses the cache and re-queries every source; disabled while running |
| F13 | Community report | `components/ReportDialog.tsx` → `POST /api/reports` | Modal `<dialog>`; 7 categories (default `scam`); optional public description (max 1000); duplicate response shows a message and does not re-run; success triggers a re-run so the community card updates; Esc/Cancel closes |
| F14 | Verdict | `components/VerdictPanel.tsx`, `RiskGauge.tsx` | Score 0–100 with level label; pending state while streaming; confidence %; source count; progress (done/total) |
| F15 | Assessment | `VerdictPanel.tsx:57-63` | Summary text; marks when AI-written (`generatedBy === "ai"`) |
| F16 | Red flags / trust signals / what to do | `VerdictPanel.tsx:64-87` | Top risk signals, trust signals, ordered recommendations |
| F17 | Sticky verdict | `Search.tsx:107` | Verdict stays visible while scrolling on ≥1024 px |
| F18 | Source result card | `components/CheckCard.tsx` | Status (7 states) with label; summary; error text; signals (risk/trust + severity); facts (label/value, mono, links); items (image, subtitle, tags, date, link); "Show all N" when >6 items; source attribution (link unless internal); duration ms |
| F19 | Internal pivots | `CheckCard.tsx:18,43` | Items with an `href` starting with `/` navigate in-app (e.g. extracted links → new lookup) |
| F20 | Pending card | `CheckCard.tsx:136-151` | Placeholder shown for each planned source until it answers |
| F21 | Sources page | `/sources` · `pages/Sources.tsx` → `GET /api/sources` | Every module; enabled/disabled plus reason (e.g. "Requires HIBP_API_KEY"); category; upstream link; applies-to types; AI summaries on/off |
| F22 | API docs page | `/api` · `pages/ApiDocs.tsx` | Six endpoints with method, path, description, curl example |
| F23 | 404 page | `App.tsx:8-19` | Unknown routes show "Page not found" plus a link home |
| F24 | App shell | `components/Layout.tsx` | Sticky header; nav Lookup/Sources/API with active state (**Lookup is active on `/search` too**); GitHub link; footer disclaimers ("public sources only", "indicators, not proof") |
| F25 | Document metadata | `client/index.html` | Title, description, OG title/description/image, theme-color, favicon. **New (D1):** `og:url`, `og:image` and `twitter:image` are always absolute URLs built from the resolved site URL |
| F26 | Reduced motion | `index.css:49-56` | Animations/transitions neutralised under `prefers-reduced-motion: reduce` |
| F27 | Server contract | `server/routes/api.ts`, `server/app.ts` | `/api/lookup`, `/api/lookup/stream`, `/api/reports`, `/api/sources`, `/api/stats`, `/api/health` unchanged; rate limits send draft-7 `RateLimit` headers; CSP `script-src 'self'`, `img-src https:`; no query strings in logs |

---

## 2. Current-state audit (ranked by severity)

Contrast ratios were computed with the WCAG 2.x relative-luminance formula against the real token hex values in `tailwind.config.ts` and Tailwind's default palette.

### S1: Critical (accessibility failures or wrong meaning)

| # | Problem | Evidence | Impact |
|---|---|---|---|
| 1 | **Secondary text fails AA contrast.** `slate-500` (#64748b) is 4.19:1 on `ink-950` and 3.85:1 on `ink-850`, below the 4.5:1 minimum. It's used for metadata, labels, and at 10–11 px, which makes it worse | `Search.tsx:115,123`, `CheckCard.tsx:25,89,118`, `Home.tsx:44,73`, `RiskGauge.tsx:29`, `lib/ui.ts:28`, `SearchBox.tsx:73` (placeholder) | Timestamps, source attribution and field labels (the provenance an analyst relies on) are the least legible text on the page |
| 2 | **Placeholder and button contrast.** `slate-600` placeholder is 2.63:1 (`ReportDialog.tsx:82`). White on `rose-500` "Submit report" is 3.67:1 (`ReportDialog.tsx:92`) | lines cited | Fails 1.4.3 |
| 3 | **Control boundaries invisible.** Input and card borders of `white/10` are about 1.24:1 against the page | `SearchBox.tsx:57`, `ReportDialog.tsx:82`, `index.css:23` | Fails 1.4.11 (non-text contrast 3:1). The search field can't be located without the glow |
| 4 | **Controls with no accessible name on mobile.** The submit button's only text is `hidden sm:inline` (display:none removes it from the accessibility tree). The home link is an `alt=""` image whose wordmark is `hidden sm:inline` | `SearchBox.tsx:82-85`, `Layout.tsx:18-21` | Below 640 px, screen readers announce "button" and "link" with no name (fails 4.1.2) |
| 5 | **Brand accent = "safe" colour.** The primary CTA, links and focus ring are emerald (`brand-*`), the same hue family as the `safe` verdict and `clean` status | `tailwind.config.ts:19-24` vs `lib/ui.ts:6,22` | In a risk tool, "interactive" and "safe" share a colour. Green links inside a "Dangerous" report send mixed signals |
| 6 | **Declared fonts never load.** `Inter` and `JetBrains Mono` are named in the config but there is no `@font-face`, package or `<link>`. Each OS falls back to its default font (the screenshots show DejaVu) | `tailwind.config.ts:7-8`; `grep -rn "font-face\|fontsource" client` = 0 | Inconsistent rendering. Worse, the fallback monospace fonts may not separate `0/O` and `l/1/I`, which matters when reading `amaz0n-verify.top` |
| 7 | **Rate limiting has no designed state.** The server's 429 ("Too many lookups…") ends up in the generic red "Lookup failed" panel with no retry timing | `Search.tsx:61-69`, `lib/api.ts:96-104`, `server/routes/api.ts:42-48` | Users retry immediately and hit the limit again. There is no way to know when to come back |
| 8 | **Screen-reader noise.** `aria-live="polite"` wraps the whole verdict panel, so every streamed update re-announces it. The progress bar is a plain `div` with no `role="progressbar"` | `VerdictPanel.tsx:29,48-53` | Up to 22 repeated announcements per lookup; progress not exposed |
| 9 | **Report categories aren't a form control.** Seven `<button>`s with no `aria-pressed`/radio semantics. The "Category" `<label>` isn't associated with anything | `ReportDialog.tsx:56-70` | The selected state is invisible to assistive tech (fails 1.3.1 and 4.1.2) |
| 10 | **Navigation semantics.** No `aria-current` on the active nav item; no skip link | `Layout.tsx:24-35` | Fails 2.4.1; the active page is conveyed by colour only |

### S2: High (correctness, scannability, identity)

| # | Problem | Evidence | Impact |
|---|---|---|---|
| 11 | **Fallback fetch re-runs the lookup.** After an `EventSource` error the client `fetch`es the *same stream URL* to read the error body. If the failure wasn't an HTTP error, this starts a second full lookup, uses up rate-limit budget, never reads the SSE body, and `r.json()` then fails, giving a misleading message | `lib/api.ts:95-104` | Wasted upstream quota; wrong error text; users get pushed into 429s |
| 12 | **Colour sprawl with colour-only severity.** 8 hue families (emerald, sky, amber, orange, rose, cyan, brand, slate). Severity in signal lists is conveyed by a 2 px dot colour alone | `lib/ui.ts:5-31`, `CheckCard.tsx:78`, `VerdictPanel.tsx:11` | Fails 1.4.1 (use of colour); orange vs amber vs rose are hard to tell apart for colour-blind users |
| 13 | **Results aren't scannable.** 20+ tall cards (20 px padding each) with no overview, no filter, no per-value copy. The only export is JSON. No absolute timestamp; relative time only shows for cached results | `Search.tsx:106-127,77`; `CheckCard.tsx:60` | The analyst has to scroll everything to answer "what fired?"; can't paste an IP/registrar into notes; reports can't be timestamped |
| 14 | **Red flags repeated three times.** The summary sentence, the "Red flags" list and the card signals list the same findings | `VerdictPanel.tsx:62-70`; see `docs/lookup-message.png` | Visual noise; more reading for no new information |
| 15 | **Home page uses a marketing layout.** Radial glow blob and grid background, an accent-coloured headline word, a "Free · open source · no sign-up" pill with a fingerprint icon, counters showing **0**, six icon-tile feature cards, a "1-2-3" section | `Home.tsx:55-56,58-64,84-89,100-117,120-133`; `index.css:38-44` | Reads like a generic SaaS landing page, not a tool. Zeros on a fresh deploy look broken |
| 16 | **Motion over budget, with a hacker-style cue.** Card entrance 350 ms; gauge 800 ms; progress 500 ms `transition-all`; an **infinite gradient "scan" line** on every pending card; up to 22 spinners at once | `tailwind.config.ts:28-34`, `RiskGauge.tsx:22`, `VerdictPanel.tsx:50`, `CheckCard.tsx:140-148` | Breaks the ≤200 ms rule; the scanning line is the "movie hacker" look; many spinners add visual noise and cost repaints |
| 17 | **Glass effect everywhere.** `.panel` applies `backdrop-blur-sm` to every card even though nothing sits behind them; the dialog backdrop blurs as well | `index.css:23`, `ReportDialog.tsx:41` | Paint cost on long result lists for no visual gain; an anti-slop violation |

### S3: Medium (consistency and polish)

| # | Problem | Evidence |
|---|---|---|
| 18 | **Ad-hoc typography:** 12 distinct sizes, including `text-[10px]`, `text-[11px]` ×5 and `text-[13px]`; 7 uppercase `tracking-wider` micro-headings | `CheckCard.tsx:32,69,89,90,118`, `RiskGauge.tsx:29`, `index.css:29` |
| 19 | **Off-grid spacing:** 26 half-step utilities (`0.5/1.5/2.5/3.5` = 2/6/10/14 px); magic numbers `top-[-200px] h-[500px] w-[900px]` | `grep` in checklist `SLOP-12`; `Home.tsx:56` |
| 20 | **Six radius values** (`rounded`, `-md`, `-lg`, `-xl`, `-2xl`, `-full`) with no rule for which to use when | `grep -o "rounded[-a-z0-9]*"` |
| 21 | **Inconsistent verbs:** nav "Lookup", button "Investigate", progress "Investigating…", action "Re-scan", 404 "Back to lookup" | `Layout.tsx:7`, `SearchBox.tsx:84`, `VerdictPanel.tsx:41`, `Search.tsx:98`, `App.tsx:14` |
| 22 | **Wrong affordances:** "Report" styled as a danger button though it is not destructive; "Share" actually copies the link and **shows "copied" even when the clipboard write fails** | `Search.tsx:100`, `Search.tsx:51-55,91-93` |
| 23 | **AI cliché:** a `Sparkles` icon marks AI summaries | `VerdictPanel.tsx:59` |
| 24 | **Weak loading/error states:** Sources shows plain "Loading…" and a bare error string; home counters show "—" forever on error | `Sources.tsx:21-22`, `Home.tsx:43` |
| 25 | **Logo asset problems:** `logo.png` is a **318 KB, 1024×1024 JPEG** with a `.png` name, served as `type="image/png"` favicon; light-grey square background; stock half-filled shield + check + magnifier; its blue doesn't match the emerald brand; unreadable at 28 px; `og:image` is relative (crawlers need an absolute URL); no SVG favicon or apple-touch icon | `file client/public/logo.png`; `index.html:6,15`; `Layout.tsx:19` |
| 26 | **Inconsistent `rel` on outbound links.** `noreferrer` only at `Layout.tsx:40` and `Sources.tsx:34`, and `noopener noreferrer` at `CheckCard.tsx:123`, while ARCHITECTURE.md promises `noopener noreferrer nofollow` | lines cited |
| 27 | **Brittle styling code:** icon colour derived by `style.cls.split(" ")[0]` | `CheckCard.tsx:63` |
| 28 | **Theme hard-coded to dark:** `class="bg-ink-950"`, `theme-color #07090d`, `color-scheme: dark` | `index.html:2,7`, `index.css:7` |
| 29 | **Stale screenshots:** they show `0.0 s` and a mid-word monospace break that the current code no longer produces | `docs/home.png`, `docs/lookup-message.png` |
| 30 | **Object URL revoked synchronously after `click()`**, which can cancel downloads in some browsers | `Search.tsx:47-48` |
| 31 | **Refresh blanks the results.** "Re-scan", and the re-run after a successful report, reset `target` to `undefined`, so the header, verdict and all cards unmount until the new stream starts. After a successful report this also **remounts the report dialog, so the "Report received" confirmation is never shown** (§4.7; pinned by the `test.fail` e2e test `@bug-31`) | `lib/api.ts:48-49`, `Search.tsx:71` |
| 32 | **`/api` can't be loaded directly.** The Express API router is mounted at `/api` and its catch-all answers `GET /api` with the JSON `{"error":"Not found"}`, so the API docs page only works when reached through the in-app nav link; reload, bookmark or shared link all fail | `server/app.ts` (`app.use("/api", …)`), `server/routes/api.ts:157`, `App.tsx` route `/api` |
| 33 | **Code examples aren't keyboard-scrollable.** The horizontally scrolling `<pre>` blocks on the API page can't receive focus (axe `scrollable-region-focusable`, found by the P0 baseline) | `ApiDocs.tsx:44` |

---

## 3. Design direction and tokens

### 3.1 Colour, light and dark (one accent plus three semantic colours)

All pairs below were checked with the WCAG formula. `scripts/check-contrast.mjs` (P1) re-verifies them from `tokens.css` in CI.

| Token | Light | Dark | Use | Verified contrast |
|---|---|---|---|---|
| `--color-bg` | `#F5F5F7` | `#0E0F11` | Page background | n/a |
| `--color-surface` | `#FFFFFF` | `#17181B` | Cards, dialog, table | n/a |
| `--color-surface-2` | `#F5F5F7` | `#202125` | Inset rows, code blocks, hover | n/a |
| `--color-text` | `#1D1D1F` | `#F2F2F4` | Primary text | 15.5 / 14.4 (worst surface) |
| `--color-text-secondary` | `#4A4A4F` | `#B4B4BB` | Body secondary, summaries | 8.1 / 7.8 |
| `--color-text-tertiary` | `#6B6B70` | `#8E8E96` | Metadata, timestamps, captions (**lowest allowed text colour**) | 4.87 / 4.95 |
| `--color-border` | `#E3E3E8` | `#2A2B30` | Decorative separators only | n/a (decorative) |
| `--color-border-strong` | `#8A8A8F` | `#6C6D75` | Input, checkbox and radio boundaries | 3.16 / 3.13 (≥3:1, 1.4.11) |
| `--color-accent` | `#0A66C2` | `#4C9AFF` | **The only accent:** primary button, links, selected state | 5.22 / 5.65 |
| `--color-accent-hover` | `#0858A8` | `#6AADFF` | Hover/pressed | re-verify in P1 |
| `--color-on-accent` | `#FFFFFF` | `#0E0F11` | Text on accent fill | 5.69 / 6.73 |
| `--color-accent-tint` | `#E8F1FB` | `#122338` | Selected row, type badge | accent text on tint 4.98 / 5.57 |
| `--color-success` / `-tint` | `#1A7F37` / `#E9F6EC` | `#3FB950` / `#13251A` | Safe verdict, "Clean" | 4.56 / 6.32 on tint |
| `--color-warning` / `-tint` | `#8A5C00` / `#FFF6E0` | `#D29922` / `#2A2112` | Suspicious, medium severity | 5.40 / 6.28 on tint |
| `--color-danger` / `-tint` | `#C9252D` / `#FDECEC` | `#F26B6B` / `#2A1618` | High/critical, alert | 4.86 / 5.78 on tint |
| `--color-on-danger` | `#FFFFFF` | `#0E0F11` | Text on the solid "Dangerous" fill | 5.55 / 6.48 |
| `--color-focus` | = accent | = accent | 2 px focus ring, 2 px offset | 5.69 / 6.73 vs bg |

**Why blue:** it separates "interactive" from "safe" (fixes #5), carries over the blue of the existing logo, and matches the HIG system tint. Green stays reserved for success.
**Why not a gradient or second accent:** each extra hue competes with the risk colours, which carry the meaning on this page.

**Mapping risk levels and statuses onto the palette** (this replaces the 8-hue maps in `lib/ui.ts`):

| Domain value | Colour | Label (always rendered as text) | Icon shape | Emphasis |
|---|---|---|---|---|
| level `safe` | success | "No red flags" | circle-check | tint |
| level `low` | neutral (text-secondary) | "Low risk" | circle | tint (surface-2) |
| level `medium` | warning | "Suspicious" | triangle | tint |
| level `high` | danger | "High risk" | octagon | tint |
| level `critical` | danger | "Dangerous" | octagon | **solid fill** + on-danger text |
| severity `info`/`low` | neutral | "Info"/"Low" | circle | text only |
| severity `medium` | warning | "Medium" | triangle | text + icon |
| severity `high`/`critical` | danger | "High"/"Critical" | octagon | text + icon |
| status `clean` | success | "Clean" | circle-check | badge |
| status `found`/`info` | neutral | "Found"/"Info" | circle | badge |
| status `warning` | warning | "Warning" | triangle | badge |
| status `danger` | danger | "Alert" | octagon | badge |
| status `error` | neutral | "Unavailable" (or "Rate limited by source") | circle-slash | badge |
| status `skipped` | neutral tertiary | "Not run" | circle-dashed | listed, not carded |

High and critical share a hue on purpose. They're told apart by the **fill weight and the word**, which satisfies 1.4.1 and keeps within the "three semantic colours" rule.

### 3.2 Typography (one sans, one mono)

| Token | Size / line-height | Weight | Tracking | Use |
|---|---|---|---|---|
| `--font-sans` | Inter Variable → `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif` | | | All UI |
| `--font-mono` | JetBrains Mono Variable → `ui-monospace, "SF Mono", Menlo, Consolas, monospace` | | | Indicators, hashes, IPs, code; chosen for its **dotted zero and distinct l/1/I**, which matters for lookalike domains |
| `text-caption` | 12 / 16 | 500 | +0.01em | Timestamps, durations, attribution, badges (**minimum size**) |
| `text-footnote` | 13 / 20 | 400 | 0 | Secondary lines, fact labels, table cells |
| `text-body` | 15 / 24 | 400 | 0 | Default body |
| `text-headline` | 17 / 24 | 600 | −0.01em | Card titles, verdict label |
| `text-title-3` | 20 / 28 | 600 | −0.01em | Section titles |
| `text-title-2` | 24 / 32 | 600 | −0.015em | Page titles, indicator heading |
| `text-title-1` | 32 / 40 | 700 | −0.02em | Home headline only |
| `text-display` | 48 / 56 | 700 | −0.02em | Risk score number only |

Rules: numbers in data use `font-variant-numeric: tabular-nums`. No uppercase micro-labels; section labels use `footnote` at weight 600 in sentence case.

#### 3.2.1 Font delivery (decision D6)

| Aspect | Spec | Why |
|---|---|---|
| Source | `@fontsource-variable/inter` and `@fontsource-variable/jetbrains-mono` **5.3.0** as **devDependencies** | Reproducible, OFL-1.1, maintained upstream |
| Files shipped | Only `files/inter-latin-wght-normal.woff2` (48,256 B) and `files/jetbrains-mono-latin-wght-normal.woff2` (40,404 B), which is **88.7 KB total**; no italics, no other subsets | Latin subset only; weight axis covers 100–900 in one file |
| Location | `npm run fonts:vendor` (`scripts/vendor-fonts.mjs`) copies them to `client/public/fonts/inter-latin-wght-5.3.0.woff2` and `jetbrains-mono-latin-wght-5.3.0.woff2`, plus the packages' `LICENSE` as `OFL-Inter.txt` and `OFL-JetBrainsMono.txt`. The files are committed | Preload needs a **stable URL** written in `index.html`. Vite hashes imported fonts, and a hand-written `<link rel="preload">` wouldn't follow the hash. The version in the filename replaces the hash for cache-busting |
| `@font-face` | In `client/src/styles/fonts.css`: `font-family: "Inter Variable"`, `src: url("/fonts/inter-latin-wght-5.3.0.woff2") format("woff2")`, `font-weight: 100 900`, `font-style: normal`, **`font-display: swap`**, `unicode-range` = the fontsource latin range (`U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD`). Same for JetBrains Mono | Characters outside latin (e.g. an IDN or homograph domain in Cyrillic) fall through to the system font, so they still render and are still visibly different |
| Preload | Exactly one: `<link rel="preload" href="/fonts/inter-latin-wght-5.3.0.woff2" as="font" type="font/woff2" crossorigin>` | Inter is used above the fold on every page. Mono appears later, on results. `crossorigin` is required for font preloads even on the same origin, or the font is fetched twice |
| Fallback | `--font-sans: "Inter Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif;` `--font-mono: "JetBrains Mono Variable", ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;` | Usable text before the font arrives, or if it's blocked |
| Layout shift | Optional `@font-face { font-family: "Inter Fallback"; src: local("Arial"); size-adjust: 107%; ascent-override: 90%; }` inserted after Inter in the stack; values tuned in P1 | Reduces reflow when `swap` happens |
| Caching | `server/index.ts` static `setHeaders` extends `immutable, max-age=31536000` from `/assets/` to `/fonts/` | Versioned names make long caching safe |
| Licences | `OFL-*.txt` next to the fonts (served and in the repo); README "License" section names both fonts and the OFL | OFL requires the licence to accompany the font files |
| CSP | No change: `font-src 'self'` comes from helmet's defaults | Self-hosted |

### 3.3 Spacing (4 px base, 8 px rhythm)

| Token | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| px | 0 | 4 | 8 | 12 | 16 | 20 | 24 | 32 | 40 | 48 | 64 | 80 |

`px` (1 px) is kept for hairlines only. Card padding is 16 (mobile) / 20 (≥640 px); section gap 32; page gutter 16 / 24. `tailwind.config.ts` **overrides** `theme.spacing` (it doesn't extend it), so `mt-0.5`, `p-2.5` and similar are simply not generated.

### 3.4 Radius

| Token | Value | Use |
|---|---|---|
| `rounded-sm` | 6 px | Badges, chips, inline code |
| `rounded-md` | 8 px | Buttons, inputs, table rows, list items |
| `rounded-lg` | 12 px | Cards, dialog, search field |
| `rounded-full` | 9999 px | Status dots, avatar images only |

### 3.5 Elevation and materials

| Token | Light | Dark | Use |
|---|---|---|---|
| `--shadow-overlay` | `0 8px 24px rgb(0 0 0 / .12), 0 0 0 1px var(--color-border)` | `0 8px 24px rgb(0 0 0 / .5), 0 0 0 1px var(--color-border)` | Dialog, menus only |
| `--material-header` | `rgb(245 245 247 / .8)` + `backdrop-filter: saturate(180%) blur(12px)` | `rgb(14 15 17 / .8)` + same | Sticky header only (the one permitted blur) |

Cards have no shadow; depth comes from `surface` sitting on `bg` plus a `--color-border` hairline.

### 3.6 Motion

| Token | Value | Use |
|---|---|---|
| `--duration-fast` | 100 ms | Hover, press, colour changes |
| `--duration-base` | 150 ms | Disclosure (Show all), badge/state swap, card content arrival (opacity only) |
| `--duration-slow` | 200 ms | Dialog enter, meter fill (**the maximum**) |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Entering/moving |
| `--ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | Leaving |

Every animation needs a stated purpose:

- the meter fill shows the score arriving
- the disclosure rotation shows an expanded/collapsed state
- the opacity-in marks a source result that just arrived

These are banned: infinite decorative loops, the scan line, translate-in on list items, and `transition-all`. The only permitted continuous animation is the single header progress indicator. Under `prefers-reduced-motion: reduce`, all durations become 0, transforms are dropped, and spinners are replaced by static text ("Looking up… 12 of 22").

### 3.7 Layout

- Containers: results use a 1200 px max width; home, docs and sources use 720 px (home) or 960 px (tables).
- Header is 56 px.
- The results grid is `320px 1fr` at ≥1024 px (the verdict column shrinks from 360 to 320). Below 1024 px it becomes a single column with the verdict on top.
- Touch and click targets are ≥24×24 px (WCAG 2.2 2.5.8). Primary buttons are 36 px tall, and 44 px on the home search.

### 3.8 How the tokens are implemented (no new UI framework)

```
client/src/styles/
  tokens.css      ← CSS custom properties; :root = light; @media (prefers-color-scheme: dark) { :root { … } }
  base.css        ← element defaults, :focus-visible ring, reduced-motion, font-feature-settings
  index.css       ← @tailwind layers + imports (replaces current client/src/index.css)
tailwind.config.ts
  theme.colors / fontSize / spacing / borderRadius / transitionDuration / boxShadow
  → OVERRIDE (not extend), each value = var(--token)
scripts/
  lint-design.mjs     ← fails on raw palette classes, hex outside tokens.css, text-[..], half-steps,
                        gradients, blur, emoji, banned copy, durations > 200ms
  check-contrast.mjs  ← parses tokens.css, asserts every text pair ≥4.5, UI boundaries ≥3
```

`index.html` gets `<meta name="color-scheme" content="light dark">` and two `theme-color` metas with `media` queries. This is pure HTML, so the CSP is unaffected.

**Primitives** (in `client/src/components/ui/`, each under about 60 lines, no library):

| Primitive | Replaces |
|---|---|
| `Button` (`primary` / `secondary` / `plain`; `sm`/`md`/`lg`) | `.btn`, `.btn-primary`, `.btn-ghost`, ad-hoc rose buttons |
| `Badge` | `.chip` |
| `StatusBadge` | `STATUS_STYLES` |
| `Card` | `.panel` |
| `ExternalLink` | Every outbound `<a>`, with one `rel="noopener noreferrer nofollow"` |
| `SourceLink` | Duplicated source-attribution logic |
| `CopyButton` | Honest success/failure feedback, `aria-live` confined to itself |
| `Skeleton` | Static placeholder, no shimmer |
| `InlineAlert` | `info`/`warning`/`danger`, with an optional action |
| `EmptyState` | Title + one sentence + optional action |
| `SignalList` | The two duplicated lists |

---

## 4. Page-by-page changes

### 4.1 App shell (`Layout.tsx`, `App.tsx`, `index.html`)

| Before | After | Rationale |
|---|---|---|
| 28 px JPEG logo; wordmark hidden on mobile; link has no name on mobile | SVG `Logo` mark (20 px, `currentColor`) + "ScamShield" wordmark always visible; link `aria-label="ScamShield home"` | Fixes #4 and #25; deference (the mark takes the text colour) |
| No skip link | First focusable element: "Skip to content" → `#main` | 2.4.1 |
| Active nav shown only by background colour | `aria-current="page"` + weight 600 + text colour; `/search` still marks "Lookup" | 1.3.1 / 1.4.1; keeps F24 |
| GitHub link `rel="noreferrer"` | `ExternalLink` | #26 |
| Two-part footer with shield icon | One line, `caption`: "Public sources only. The target is never contacted. Results are indicators, not proof." + version + GitHub | Literal, shorter, keeps both disclaimers |
| Dark-only, hard-coded theme-color | Follows OS; `color-scheme: light dark`; per-scheme `theme-color` | Decision A2 |
| 404: mono "404" in brand green | `title-2` "Page not found", `body` "Check the address or start a new lookup.", secondary button "Go to lookup" | Literal copy |
| Relative `og:image`, no `og:url` | Absolute `og:url`, `og:image`, `twitter:image`, `<link rel="canonical">` from the resolved site URL (§4.1.1) | Crawlers ignore relative OG URLs; decision D1 |

#### 4.1.1 Absolute site URL (decision D1)

**Resolution order:** `SITE_URL` → `RENDER_EXTERNAL_URL` → (development/test only) `http://localhost:${PORT}`.
- `RENDER_EXTERNAL_URL` is set automatically by Render on web services, so the Render blueprint needs no change.
- Docker/VPS deployments must set `SITE_URL`.

**Validation** (in `server/config.ts`, the same zod fail-fast pattern the file already uses):
- Parse with `new URL()`.
- Protocol must be `https:`, or `http:` only when `NODE_ENV !== "production"`.
- Path, query and hash must be empty.
- Store it without a trailing slash, as `config.SITE_URL`.
- If `NODE_ENV=production` and neither variable is set, or the value is invalid, `loadConfig()` throws:

  > `Invalid configuration: SITE_URL is required in production (the public origin, e.g. https://scamshield.example). On Render, RENDER_EXTERNAL_URL is used automatically when SITE_URL is unset.`

  The process exits non-zero before listening, so Render marks the deploy as failed instead of serving broken previews. This is the "clear error at startup" option. A build-time failure was rejected because `docker build` and CI have no public origin (A6).

**Injection** (the page stays one static SPA; only the `<head>` values change):

| Where | How |
|---|---|
| `client/index.html` | Placeholders: `<link rel="canonical" href="%SITE_URL%%PATH%">`, `<meta property="og:url" content="%SITE_URL%%PATH%">`, `<meta property="og:image" content="%SITE_URL%/og.png">`, `og:image:width` 1200, `og:image:height` 630, `twitter:card` `summary_large_image`, `twitter:image` |
| Production (`server/index.ts`) | Read `dist/public/index.html` once at startup. For every HTML response, replace `%SITE_URL%` with the HTML-attribute-escaped origin and `%PATH%` with `req.path` (**query string never included**: lookups can contain emails and phone numbers). Serve this for the SPA fallback **and** for a direct `GET /index.html`, which `express.static` would otherwise serve raw with the placeholders |
| Development (Vite middleware) | A 10-line `transformIndexHtml` plugin in `vite.config.ts` does the same substitution using the same resolver (`server/lib/siteUrl.ts`, a pure function shared by config and plugin) |
| Unit tests | `tests/siteUrl.test.ts`: precedence, fallback, trailing-slash normalisation, rejection of relative/`ftp:`/path-bearing values, production-missing error text, dev fallback, escaping of `"<>&` |

**Operational impact (breaking for self-hosters):**
- An existing Docker/VPS deployment without `SITE_URL` will refuse to start after upgrading.
- Mitigations:
  - add `SITE_URL=` to `.env.example`
  - add `-e SITE_URL=https://…` to the Docker example in DEPLOYMENT.md
  - add a line to the production checklist
  - note the change in the release notes

### 4.2 Home (`/`)

| Before | After | Rationale |
|---|---|---|
| Radial glow, grid background, accent-coloured headline word "trust", pill "Free · open source · no sign-up" | Plain `bg`. `title-1`: **"Check an email, link, domain, IP, phone number or message."** `body` secondary: "Results come from public sources and are streamed as each one answers." | Tool-first. Removes the anti-slop elements (#15). The headline says what the page does |
| Search box with glow shadow and nested focus treatment | 44 px `rounded-lg` field, `border-strong` boundary, a single focus ring on the field container, type badge (accent-tint) on the right, primary button **"Look up"** (visible label at all widths; icon-only below 400 px keeps an `aria-label`) | #3, #4, #21 |
| (no helper text) | Helper text below the field (`footnote`, tertiary): "Paste a whole message to extract links and numbers. Defanged input like hxxp://evil[.]com works." | Moves the useful parts of the "1-2-3" section to where they're needed |
| "Try:" chips | "Examples" label + 6 `plain` buttons in `footnote` ("Phishing domain", "Email", …) | Keeps F2; quieter |
| 4 big counters band (shows zeros) | Single `caption` row under the examples, e.g. "1,204 lookups run · 38 community reports · 6 known scam indicators". **Any stat equal to 0 is not rendered; if all four are 0 the row isn't rendered at all** (no empty container, no separators). Skeleton while loading; row hidden on error (non-critical data). Separators come from CSS so none are left dangling | Keeps F3 (decision D4). With the D9 "since last restart" qualifier when storage is ephemeral (§4.8) |
| 6 icon-tile capability cards | One `Card` holding a two-column definition table, "What each lookup checks": type (Email, Link, Domain, IP, Phone, Message) → a comma-separated list of checks, then a "See all sources" link to `/sources` | Keeps F4. Scannable, no decorative icon tiles, about 60% less height |
| "1. Paste anything / 2. … / 3. …" | Removed (content moved to helper text and the Sources page) | Redundant |

#### 4.2.1 Where the counters are stored (finding, reported before building on it)

None of the four counters are held in memory. All come from the **SQLite file at `DATABASE_URL`** (`server/lib/community.ts:141-168`):

| Counter | Source | Notes |
|---|---|---|
| Lookups run | `statistics` row `total_lookups`, incremented by `onLookup` (`server/index.ts:39` → `server/engine/lookup.ts:52`) | **Cache hits aren't counted:** the cached branch returns at `lookup.ts:45-50`, before the increment |
| Community reports | `SUM(scam_reports.report_count)` | |
| Reports (24 h) | `COUNT(report_events)` where `created_at` is in the last 24 h | Goes to 0 by design after a quiet day, so D4 hides it |
| Known scam indicators | `COUNT(common_scams)` | Re-seeded idempotently on every boot (`server/seed.ts`), so it's always ≥6 and **never resets** |

**Whether they survive a redeploy depends entirely on the disk behind `DATABASE_URL`:**

| Hosting | `DATABASE_URL` | Survives redeploy / restart / spin-down? |
|---|---|---|
| Render via `render.yaml` as committed (`plan: starter`, 1 GB disk at `/var/data`, `DATABASE_URL=/var/data/scamshield.db`) | on persistent disk | **Yes** |
| Render **Free** (no persistent disks; the instance spins down after inactivity), or a service created without the blueprint's disk | container filesystem (default `sqlite.db` in the working dir) | **No**: lookups, community reports and the 24 h count reset to 0 on **every deploy, restart and spin-down**. So do the **community reports themselves**, not just the counters |
| Docker with `-v scamshield-data:/data` | `/data/scamshield.db` on a named volume | Yes |
| Docker without a volume | container layer | No |

I can't tell from the repo which Render plan `scamshield-dkmg.onrender.com` uses. To check in the Render dashboard, open the service and look at **Disks** (a disk mounted at `/var/data` should be listed) and at **Environment** (`DATABASE_URL` should point under that mount).

**Consequence for D4 if it's ephemeral:** after every spin-down the row shows only "6 known scam indicators". It's still honest, but "lookups run" becomes meaningless. The options were:
- (a) persistent disk is in place, so build as specified;
- (b) it's ephemeral and resets are accepted, so build as specified and add a qualifier;
- (c) move storage to a hosted database.

**Resolved (D9): option (b).** The live service runs on Render Free with no disk. The counters are built as specified with the qualifier "since last restart". Reports get the notices in §4.8. Option (c) is recorded as follow-up FU-1 (§9).

The client has no boot timestamp (`/api/stats` and `shared/types.ts` stay unchanged, GATE-08), so the qualifier is the literal phrase, not a time.

### 4.3 Lookup results (`/search`), the core screen

**Layout (≥1024 px):**

```
┌ Search field (md) ─────────────────────────────────────────────────────────┐
├ Target header ─────────────────────────────────────────────────────────────┤
│ [Domain]  amaz0n-verify.top  [Copy]                                        │
│ Checked 24 Sep 2026, 14:02 UTC · 3.2 s · 18 of 22 sources answered         │
│                         [Copy link] [Export ▾ JSON | CSV] [Refresh] [Report…]│
├──────────────┬─────────────────────────────────────────────────────────────┤
│ Verdict 320px│ Findings  [All 22] [Flags 4] [Clean 12] [Unavailable 2]      │
│  98 /100     │ ┌ status ─ source ───────── finding ─────────────── time ┐   │
│  Dangerous   │ │ ▲ Alert  Scam language     7 tactics, 1 link     6 ms │   │
│  ▬▬▬▬▬▬▬▬▬▬  │ │ ✓ Clean  Community         No reports yet        9 ms │   │
│  Confidence  │ └───────────────────────────────────────────────────────┘   │
│  Summary     │ Community intelligence                                       │
│  Red flags(5)│  [detail card] …  (category order unchanged)                 │
│  What to do  │ Not run: HIBP (Requires HIBP_API_KEY) · …                    │
└──────────────┴─────────────────────────────────────────────────────────────┘
```

| Before | After | Rationale |
|---|---|---|
| Type chip + indicator `h1` (mono, `break-all`) | `h1` indicator in mono `title-2`, wrapping at `/ . @ -` via `overflow-wrap:anywhere` (not mid-word for messages); **copy button** beside it. Messages are shown as a quoted `body` block clamped to 3 lines with "Show full message" | #13, #29 |
| Relative time only when cached; `0.0 s` shown for cached results | Meta row: `<time dateTime=ISO>` absolute local time + UTC tooltip; duration only when not cached; "Cached, 4 min ago" badge when cached; "18 of 22 sources answered" | Timestamps are required for evidence; fixes #13 and #29 |
| Share / JSON / Re-scan / Report (rose) | **Copy link** (honest: shows "Couldn't copy" on failure) · **Export** menu (JSON unchanged, plus CSV) · **Refresh** (tooltip "Skip the cache and query every source again") · **Report…** (secondary, flag icon) | #21, #22. Report isn't destructive, so it doesn't get danger styling |
| Semicircle SVG gauge (200 px, 800 ms) | `VerdictMeter`: the visible number `display` "98" + `caption` "/100" and the text label `headline` "Dangerous" sit **on the same row, directly beside the bar**. The bar is an 8 px track with a 200 ms fill (none under reduced motion), exposed as `role="meter"` with `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-valuenow={score}`, `aria-valuetext="98 out of 100, Dangerous"`, and `aria-labelledby` pointing at a "Risk score" label. While scoring: the number shows "—", the label says "Scoring…", and the meter carries no `aria-valuenow` and has `aria-busy="true"`. Colour is the third channel, never the only one | Decision D5. A `div` with the ARIA role instead of native `<meter>`, because `<meter>`'s colours can't be styled reliably across browsers and would bypass the tokens |
| Whole panel `aria-live` | A single `role="status"` region announcing only phase changes ("Looking up… 18 of 22", "Done. Score 98, Dangerous") | #8 |
| Progress bar `div` 500 ms | `role="progressbar"` with `aria-valuemax=total`; 150 ms | #8, #16 |
| Assessment with Sparkles icon | "Summary" + `caption` "Written by AI · the score is rule-based" (or "Generated from rules") | #23; states plainly what the AI does and doesn't decide |
| Red flags list (all top signals, dot colour only) | Top 5 with severity **word + icon**, each linking to its source card (`#source-<id>`); "Show all 8" disclosure | #12, #14 |
| Trust signals, What to do | Kept; same `SignalList` primitive | F16 |
| Only category-grouped cards | **Findings overview table** above the detail cards: status badge, source, one-line summary, duration; each row links to its card. **Filter** (segmented, `role="radiogroup"`): All / Flags (warning+danger) / Clean / Unavailable, with counts. Below 640 px the table becomes a stacked list | Scannability (#13); answers "what fired?" without scrolling |
| Cards: 20 px padding, blur, fade-up 350 ms, icon colour via string split | `Card` 16/20 px padding, hairline border, 150 ms opacity-in; `StatusBadge` from the status map; header is `headline` title + `footnote` summary | #16, #17, #27 |
| Facts `dl` with 11 px uppercase labels | `footnote` sentence-case labels (tertiary); values `body`/mono; **per-value copy button** (visible on hover and focus, always visible on touch) | #1, #13, #18 |
| Items grid with 10 px tags | Items as a list (`rounded-md` rows, `surface-2` on hover), tags as `Badge` `caption`; external items show "Opens <host>" in the accessible name | #18 |
| Footer: "Source: X" link + ms | `SourceLink` ("Source: XposedOrNot ↗") + "Answered in 312 ms"; internal sources say "ScamShield analysis" | Source attribution on every card |
| Error text in mono grey box | Neutral `InlineAlert`: "Unavailable: the source timed out." / "Rate limited by source. Try Refresh in a few minutes." (the upstream `HttpError(429)` message is detected) | #7 (per-source rate limit) |
| Pending: spinner + infinite scan line on every card | Static `Skeleton` row in the overview table plus a compact pending card: name + "Waiting for response" (`caption`). No per-card spinner | #16 |

**Designed states** (each gets its own e2e test; see `STATE-*` in the checklist):

| State | Trigger | Presentation | Copy |
|---|---|---|---|
| Empty (no query) | `/search` without `q` | `EmptyState` under the field | "Enter something to look up." + "Examples" buttons |
| Connecting | before `start` | Header skeleton + verdict skeleton | status region: "Starting lookup…" |
| Streaming | `start` → `check`… | Overview rows fill in; progress "n of m" | "Looking up… 12 of 22 sources" |
| Done | `done` | Full report; status region announces the result | "Done. Score 98, Dangerous." |
| Invalid input | HTTP 400 from the stream (`resolveTarget` error) | Inline `danger` text **under the field** (`aria-describedby`), field keeps its value, no results panel | Server message, e.g. "Phone numbers need 6–15 digits." |
| Rate limited (app) | HTTP 429 | `warning` `InlineAlert` with a live countdown; **Look up/Refresh disabled until it ends**; seconds come from `Retry-After`, else the `RateLimit` header's `reset=`, else 60 | "Too many lookups from your network. Try again in 42 s." |
| Network error / connection lost | EventSource error without an HTTP status, or mid-stream drop | `danger` `InlineAlert` + **Retry** button; partial results stay visible and are marked incomplete | "Connection lost before the lookup finished." |
| All sources unavailable | done with confidence 0 | Verdict shows "Not enough data" instead of a score | "No source answered. Try again later." |
| Source unavailable / source rate-limited | `check` with status `error` | Neutral badge, `InlineAlert` in the card, filter "Unavailable" | see above |

**Bug fix folded in (#11):** the fallback request uses an `AbortController` and aborts as soon as headers arrive. It only parses JSON when `!response.ok`, and it never parses a 200 SSE body.

#### 4.3.1 CSV export (decision D2)

**File:** `scamshield-<type>-<epoch>.csv`, MIME `text/csv;charset=utf-8`, generated client-side from the `done` report (no server change). The button is disabled until `done`, like JSON.

**Columns** (one row per signal; a source with no signals gets one row with empty signal columns): `generated_at, target_type, target, source_id, source_name, category, status, summary, signal_kind, signal_severity, signal_label, source_url, duration_ms`.

**Encoding rules** (OWASP "CSV Injection"), in a pure module `client/src/lib/csv.ts` with no DOM access:

1. Convert `null`/`undefined` to `""`; numbers and booleans become strings with `String()`.
2. **Formula neutralisation:** if the cell's **first character** is `=`, `+`, `-`, `@`, tab (`\t`, U+0009) or carriage return (`\r`, U+000D), prepend a single quote `'`. Dangerous characters that aren't leading are left alone.
3. **Quoting:** wrap **every** field in double quotes and double any embedded `"` (RFC 4180). Commas, LF and CRLF inside values are then safe.
4. **Rows** end with CRLF. The header row gets the same treatment.
5. **File** starts with the UTF-8 BOM `﻿` so Excel detects UTF-8 (IDN domains, non-ASCII message text).

Why these rules:
- Several fields are attacker-controlled: the looked-up message text, WHOIS/registrar strings, profile names. A `=HYPERLINK(...)` in a scam SMS must not execute when an analyst opens the export.
- The quote prefix is the OWASP-recommended neutraliser. Quoting alone is not enough, because spreadsheets evaluate quoted formulas.
- Trade-off: a legitimately negative number would become text. No exported column is negative (`duration_ms ≥ 0`), and the prefix is only visible in raw text.

**Unit tests** (`tests/csv.test.ts`, runs in the existing vitest `node` environment). The exact test names are fixed so `CSV-02` can grep for them:

| Test name | Asserts |
|---|---|
| `neutralises leading "="` | `=1+1` → `"'=1+1"` |
| `neutralises leading "+"` | `+1` → `"'+1"` |
| `neutralises leading "-"` | `-2+3` → `"'-2+3"` |
| `neutralises leading "@"` | `@SUM(A1)` → `"'@SUM(A1)"` |
| `neutralises leading tab` | `\t=1` → `"'\t=1"` |
| `neutralises leading carriage return` | `\r=1` → `"'\r=1"` |
| `does not prefix a dangerous character that is not leading` | `a=b` → `"a=b"` |
| `does not prefix safe values` | `example.com` → `"example.com"` |
| `quotes fields containing commas` | `a,b` → `"a,b"` |
| `doubles embedded double quotes` | `say "hi"` → `"say ""hi"""` |
| `keeps LF newlines inside quoted fields` | `a\nb` → `"a\nb"`, and the row count is unchanged |
| `keeps CRLF newlines inside quoted fields` | `a\r\nb` → `"a\r\nb"` |
| `quotes every field` | every field of every row matches `^".*"$` (dotall) |
| `renders null and undefined as empty quoted fields` | → `""` |
| `terminates rows with CRLF` | output lines joined by `\r\n` |
| `starts with a UTF-8 BOM` | `out.charCodeAt(0) === 0xFEFF` |
| `round-trips through a CSV parser` | a small RFC 4180 parser in the test recovers the original values (with the `'` prefix where applied) |

### 4.4 Report dialog

| Before | After | Rationale |
|---|---|---|
| Category buttons, unassociated label | `<fieldset><legend>Category</legend>` + native radios styled as segmented chips (arrow-key navigation comes free) | #9 |
| Textarea `white/10` border, `slate-600` placeholder | `border-strong`; placeholder tertiary; visible counter "0 / 1000" (`caption`, `aria-live="off"`); helper "Public. Don't include your own personal details." moved **out** of the placeholder | #2, #3; placeholders disappear once typing starts |
| Rose "Submit report" 3.67:1 | Primary accent "Submit report"; `aria-busy` while sending | #2, #22 |
| Success/error as coloured text | `InlineAlert`: success "Report received." · duplicate (info) "You've already reported this." · error (danger) server message · 429 (warning) "Too many reports from your network. Try again later." | Designed states |
| Backdrop blur | `rgb(0 0 0 / .4)` backdrop, no blur; 200 ms fade/scale-in (none under reduced motion) | #17 |
| Focus return unspecified | Focus goes to the first radio on open and **returns to "Report…" on close** | 2.4.3 |

### 4.5 Sources (`/sources`)

| Before | After | Rationale |
|---|---|---|
| One long divided list, green/grey icons | Grouped by category (`title-3` + count "4 sources"), each group a table: **Source** (name + upstream `ExternalLink`) · **Applies to** (`Badge`s) · **Status** ("Active" success badge, or "Needs API key: HIBP_API_KEY" neutral + explanation) | Scannable; status as words |
| "AI-written summaries: enabled/disabled…" line | `InlineAlert` (info): "Summaries are written by AI. Scores are always rule-based." or "Summaries are generated from rules." | Literal |
| "Loading…" / bare error text | 6-row `Skeleton` table · `InlineAlert` danger + **Retry** (`refetch`) · `EmptyState` "No sources configured." | #24 |
| Upstream link `rel="noreferrer"` | `SourceLink` | #26 |

### 4.6 API (`/api`)

| Before | After | Rationale |
|---|---|---|
| Sky/amber method pills | Neutral mono `Badge` "GET"/"POST" | One accent rule |
| `YOUR-HOST` in examples | `window.location.origin` substituted at render | Examples work when copied |
| Examples not copyable | `CopyButton` on each `<pre>` | Copy actions |
| Intro paragraph | Adds a short "Rate limits" subsection: lookups per minute per IP, `RateLimit`/`Retry-After` headers | Documents the behaviour the UI now uses |
| `POST /api/reports` description | Adds the storage sentence from §4.8 when the mode is `ephemeral` | D9 |
| Route `/api` (breaks on direct load, #32) | Client route renamed to **`/api-docs`**; nav label stays "API". No server change (GATE-08) | Deep links, reloads and shared links work |
| `<pre>` examples not focusable (#33) | `tabIndex={0}` + `aria-label="Example: <endpoint>"` on each scrollable block, visible focus ring | WCAG 2.1.1 keyboard access |

### 4.7 Refresh keeps results on screen (audit #31)

"Re-scan", and the automatic re-run after a successful report, currently **blank the whole results view**. The reducer's `reset` returns the initial state, including `target: undefined` (`lib/api.ts:48-49`), so the header, verdict and every card unmount until the new `start` event arrives. In P3, `reset` keeps the previous report and planned list, and marks the page "Refreshing…" (status region + `aria-busy` on the results) until the new `start` event replaces them.

### 4.8 Temporary-storage notices (decision D9)

**Mode:**
- `STORAGE_PERSISTENT` is a new boolean env var, validated in `server/config.ts`, **default `false`**. It resolves to `storageMode` = `"ephemeral"` | `"persistent"`.
- The default is fail-safe: the notices appear unless the operator explicitly declares persistent storage. That matches the user's Free service, which sets nothing.
- `render.yaml`, which provisions a `/var/data` disk, sets `STORAGE_PERSISTENT: "true"`. DEPLOYMENT.md tells Docker users with a volume to set it too.

**Delivery (no API change):**
- The same runtime `<head>` injection as D1 (§4.1.1) fills `<meta name="scamshield-storage" content="%STORAGE_MODE%">`.
- `client/src/lib/deployment.ts` reads it once.
- A missing or unreplaced value (`%STORAGE_MODE%`) is treated as `ephemeral`, so the fallback never implies permanence.

**Where it appears** (all P3–P5 UI; hidden entirely in `persistent` mode):

| Surface | Treatment | Copy |
|---|---|---|
| Report dialog | Info `InlineAlert` directly above the Submit button, so it's read before submitting | "Reports are stored temporarily on this demo deployment and are cleared when the server restarts." |
| Community source card (results) | `caption` line in the card footer, next to the source attribution | "Reports are stored temporarily on this demo deployment." |
| Home stats row | The qualifier follows the restart-scoped stats (lookups run, community reports, reports in 24 h). Known scam indicators never get it, since they're re-seeded on every boot. If D4 zero-hiding leaves no restart-scoped stat, the qualifier is dropped | "1,204 lookups run · 38 community reports since last restart · 6 known scam indicators" |
| `/api` page, `POST /api/reports` | One sentence | "On this deployment reports are stored temporarily and cleared when the server restarts." |
| README | Configuration table row for `STORAGE_PERSISTENT` + a note in "What it does and doesn't do" | Same wording |

**Copy guard:** no "permanent", "forever", "never lost" or similar anywhere in the UI or README (`STORE-05`).

---

## 5. Cleanup plan

### 5.1 Delete (evidence: zero references, or superseded)

| Item | Evidence | Phase |
|---|---|---|
| `brandCount()`, `disposableCount()` in `server/lib/domain.ts:49-55` | `grep -rnw "brandCount\|disposableCount" server shared client tests` → only the definitions | P6 |
| `.panel`, `.chip`, `.btn*`, `.grid-bg` in `client/src/index.css:21-45` | Replaced by primitives (§3.8) | P1–P6 |
| `keyframes.fade-up`, `keyframes.scan`, `animation.*` in `tailwind.config.ts:26-34` | Replaced by motion tokens; the scan effect is banned | P3 |
| `colors.ink`, `colors.brand` in `tailwind.config.ts:10-25` | Replaced by token colours | P6 |
| `RiskGauge.tsx` | Replaced by the `VerdictMeter` inside `VerdictPanel` (D5) | P3 |
| `PendingCard` (`CheckCard.tsx:136-151`) | Replaced by `Skeleton` + pending card variant | P3 |
| `client/public/logo.png` (318 KB JPEG) | Replaced by SVG/PNG set (§8) | P7 |
| `docs/home.png`, `docs/lookup-message.png` | Stale (#29); replaced by light/dark screenshots | P8 |

### 5.2 Merge or move

| From | To | Why |
|---|---|---|
| `SignalList` (`VerdictPanel.tsx:6-17`) + inline signal list (`CheckCard.tsx:74-83`) | `components/SignalList.tsx` | Duplicate markup; one place for severity word + icon |
| Source-link branches (`CheckCard.tsx:119-129`, `Sources.tsx:32-40`) | `components/ui/SourceLink.tsx` | Duplicate logic |
| All outbound `<a target="_blank">` (`CheckCard.tsx:45,92,123`, `Layout.tsx:37-45`, `Sources.tsx:34`) | `components/ui/ExternalLink.tsx` | One `rel` policy (#26) |
| `.btn`/`.btn-primary`/`.btn-ghost` + rose buttons (`Search.tsx:100`, `ReportDialog.tsx:92`) | `components/ui/Button.tsx` | One button |
| `EXAMPLES` exported from a component file (`SearchBox.tsx:7-17`) | `lib/examples.ts` | Data doesn't belong in a component module |
| `lib/ui.ts` (styles + labels + `timeAgo`) | `lib/status.ts` (level/severity/status → token + label + icon), `lib/format.ts` (`timeAgo`, `formatDateTime`, `formatDuration`), `lib/categories.ts` (`CATEGORY_LABELS`, `ORDER` from `Search.tsx:13`) | Single responsibility; removes the `split(" ")[0]` hack |
| `index.css` | `styles/tokens.css`, `styles/base.css`, `styles/index.css` | Tokens are separate and machine-checkable |

### 5.3 Reduce export surface (low priority, P6)

These are exported but only used inside their own module (grep shows no other importer). Remove `export` unless a test needs them:
`CommunityRecord`, `DnsOutcome`, `HostAnalysis`, `HostInfo`, `IpClass`, `LEVEL_LABELS`, `LookupDeps`, `PATTERNS`, `RISK_WEIGHTS`, `TRUST_WEIGHTS`, `TargetParseResult`, `USER_AGENT`, `brandsInLocalPart`, `cacheKey`, `mailProvider`, `pivotsFor`, `resolveA`, `skippedResult`, `isIPv6`, `MAX_INPUT_LENGTH`, `StreamState`, `HttpError` (keep `HttpError`: it's needed for the `instanceof` 429 detection if moved to shared).

### 5.4 Dependencies

| Package | Used by (evidence) | Decision |
|---|---|---|
| `@tanstack/react-query` | `index.tsx`, `Home.tsx`, `Sources.tsx` | Keep |
| `better-sqlite3`, `drizzle-orm` | `server/lib/db.ts`, `community.ts`, `reportCache.ts`, `shared/schema.ts` | Keep |
| `clsx` | `lib/ui.ts` (re-exported as `cn`) | Keep (tiny); moves to `lib/cn.ts` |
| `express`, `express-rate-limit`, `helmet`, `zod` | server | Keep |
| `libphonenumber-js`, `tldts` | `checks/phone.ts`, `lib/domain.ts` | Keep |
| `lucide-react` | 8 client files | Keep: one icon family; standardise `strokeWidth={1.75}`, sizes 16/20 |
| `openai` | `engine/summary.ts` (optional AI summaries) | Keep |
| `wouter` | router | Keep |
| `autoprefixer` (dev) | `postcss.config.js` (not an import, so a naive scan misses it) | Keep |
| **Add (dev)** `@fontsource-variable/inter@5.3.0`, `@fontsource-variable/jetbrains-mono@5.3.0` | fixes #6; source for `npm run fonts:vendor` (§3.2.1) | **devDependencies**: only the vendored latin woff2 + OFL files ship; nothing is imported at runtime |
| **Add (dev)** `@playwright/test@1.56.1`, `@axe-core/playwright@4.13.0` (pinned exact). 1.56.1 matches the Chromium build (1194) preinstalled in the cloud dev environment, so local runs need no browser download; upgrading is a one-line bump | e2e + a11y gates (D3) | `playwright.config.ts` defines **Chromium-only** projects (light, dark, mobile-375, reduced-motion). CI installs only Chromium (see §7.1). Locally, the preinstalled browser is used via `PLAYWRIGHT_BROWSERS_PATH` |

No dependency is unused, so none are removed. No runtime dependency is added. No UI framework is added: the audit shows the problems are token discipline and semantics, not missing components.

### 5.5 Naming

| Concept | Canonical term | Replaces |
|---|---|---|
| The action | "Look up" (verb), "Lookup" (noun) | "Investigate", "Investigating…", "Back to lookup" |
| Re-query | "Refresh" | "Re-scan" |
| A data module | "Source" (UI) / `check` (code) | "intelligence module", "Querying source…" |
| Community report | "Report…" (opens dialog), "Submit report" | "Report as malicious" |
| Files | Components `PascalCase.tsx`; primitives in `components/ui/`; pages `XPage` in `pages/X.tsx` (already consistent) | n/a |

---

## 6. README outline (written last, P8)

1. **ScamShield** (logo `<picture>` light/dark) plus one literal sentence: "Look up an email address, link, domain, IP address, phone number or message against public threat-intelligence sources and get an explained risk score."
2. **Screenshot**: `<picture>` with `docs/screenshot-light.png` / `docs/screenshot-dark.png` (results page with a fixture report).
3. **What it does and doesn't do**: public sources only; never contacts the target; indicators, not proof; responsible-use note, moved up from the bottom.
4. **What it checks**: keep the current table (it's accurate); footnote the optional API-key sources.
5. **Quick start**: `npm install`, `npm run dev`; Docker one-liner.
6. **Configuration**: table of **variable names** and purpose only (from `.env.example`, never values); link to DEPLOYMENT.md. `SITE_URL` is listed first as **required in production** (falls back to `RENDER_EXTERNAL_URL` on Render).
7. **Using the app**: lookup → results overview → filters → copy/export (JSON, CSV) → report dialog → rate limits.
8. **API**: current section, plus the rate-limit headers.
9. **How scoring works**: current section (it's accurate).
10. **Architecture & deployment**: links to ARCHITECTURE.md and DEPLOYMENT.md.
11. **Development**: `check`, `test`, `test:e2e`, `lint:design`, `check:contrast`, `db:generate`, `data:disposable`; "Adding a source".
12. **Accessibility**: WCAG 2.2 AA target, what's automated (axe, contrast script), how to report issues.
13. **License**: MIT for the code; Inter and JetBrains Mono are bundled under the SIL Open Font License 1.1 (`client/public/fonts/OFL-*.txt`).

Removed: the "works like hosted tools such as EmailOSINT" comparison, which is marketing framing. The test-count claim ("100") must be replaced by the actual `vitest` total at the time of writing. ARCHITECTURE.md's client box and the `nofollow` claim get updated in the same PR.

---

## 7. Implementation order and risks

### 7.1 Phases (each phase is one PR that must pass its checklist subset)

| Phase | Scope | Exit criteria (checklist IDs) | Size |
|---|---|---|---|
| **P0 Safety net** | **No application code changes.** Playwright `@playwright/test@1.56.1` + `@axe-core/playwright@4.13.0`. `tests/e2e/` specs assert behaviour through a **page-object layer** (`tests/e2e/support/app.ts`), which is the only file P2–P5 should need to touch when wording and markup change. Typed fixtures from `shared/types.ts` drive `page.route()` mocks for `/api/stats`, `/api/sources`, `/api/reports` and SSE bodies for `/api/lookup/stream`; a **catch-all guard** fails any test that reaches an unmocked `/api/*`. One tagged test per F1–F26 (`@F01`…); F27 is `tests/api.test.ts`. Axe runs as a **ratchet**: violations must be a subset of the committed `tests/e2e/a11y-baseline/`, which must be empty by P6. `scripts/lint-design.mjs` in report-only mode. CI: `actions/cache@v4` on `~/.cache/ms-playwright` keyed by `${{ runner.os }}-playwright-${{ hashFiles('package-lock.json') }}`; on cache **miss** `npx playwright install --with-deps chromium`, on **hit** `npx playwright install-deps chromium` (OS packages aren't in the cache); upload the HTML report on failure | GATE-04, FEAT-*, E2E-* | M · **done** (56 e2e tests; baseline mirrors S1 plus #33) |
| **P1 Foundation** | `tokens.css`, `base.css`, `fonts.css` + `npm run fonts:vendor` (§3.2.1), `check-contrast.mjs`; Tailwind **extend** mapping (old classes still compile); primitives in `components/ui/` | TOK-*, A11Y-02 | M |
| **P2 Shell** | Layout, skip link, Logo placeholder (`currentColor` wordmark), footer, 404, `index.html` colour-scheme metas; **site URL resolution + `<head>` injection** (§4.1.1), with `SITE_URL=` in `.env.example` and DEPLOYMENT.md | A11Y-05/06, SHELL-* | S |
| **P3 Results** | Search page, VerdictPanel, CheckCard, overview table, filter, states, fallback-fetch fix, CSV export, ReportDialog | STATE-*, RES-*, A11Y-* on `/search` | L |
| **P4 Home** | New home composition | HOME-* | S |
| **P5 Sources/API** | Tables, states, copy buttons | SRC-*, API-* | S |
| **P6 Cleanup sweep** | Delete/merge per §5; Tailwind switches from `extend` to **override**; `lint-design` becomes **blocking**; axe becomes **blocking** (0 violations) | CLEAN-*, SLOP-* | M |
| **P7 Logo** | SVG mark, favicon set, OG image, `Logo.tsx` | LOGO-* | S |
| **P8 Docs** | README, ARCHITECTURE, DEPLOYMENT, screenshots | README-* | S |

Order rationale: the safety net comes first because streaming UI regresses silently. Tokens come before pages so no page is styled twice. Results (P3) is the highest-value screen, so it comes before Home. The cleanup sweep runs after all pages are migrated so the Tailwind override can't silently drop classes on pages not yet migrated. The logo comes before the README because the README embeds it.

### 7.2 Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| SSE state regressions (pending → result, rerun, abort on unmount) | Medium | High | P0 fixture-driven e2e; keep `useLookupStream` reducer shape; only the fallback path changes |
| Tailwind override silently removes classes still in use | High if done early | Medium (invisible styles) | Stay in `extend` until P6; `lint-design` flags legacy classes; screenshot diff before/after P6 |
| CSP breakage (fonts, inline styles, theme script) | Low | High | Fonts are bundled (`'self'`); no inline `<script>`; theme is pure CSS; `style-src 'unsafe-inline'` already allows React `style` props; SEC checklist items |
| Font FOUT / layout shift | Medium | Low | `font-display: swap`, metric-compatible fallback stack, preload the Inter woff2 in `index.html` via Vite `?url` import |
| Third-party avatars/images look wrong in light mode | Medium | Low | 1 px `border` ring on item images; `referrerPolicy="no-referrer"` kept |
| Light theme reveals low-contrast hard-coded colours | High during migration | Medium | `lint-design` bans raw palette/hex; axe runs in both schemes |
| CSV formula injection | Low | Medium | Prefix `= + - @` values; unit test |
| e2e flakiness / CI time (+1–2 min) | Medium | Low | Route mocks only (no live network); Chromium-only with a cached browser directory; `retries: 1` in CI only |
| **Existing self-hosted deploys stop starting** (no `SITE_URL`) | High for Docker/VPS users | High | Clear error text naming both variables; `.env.example`, DEPLOYMENT.md Docker example and production checklist updated in the same PR; release note. Render is unaffected (`RENDER_EXTERNAL_URL`) |
| Placeholder leak: `/index.html` served raw with `%SITE_URL%` | Medium | Medium | Explicit route for `/index.html`; `SITE-04` curls it |
| CSV opened in a spreadsheet executes attacker text | Low after D2 | High | OWASP prefixing + full quoting + 17 named unit tests (§4.3.1) |
| Counters and reports reset on ephemeral hosting | Certain on the live Render Free service (D9) | Medium | "since last restart" qualifier and storage notices (§4.8); persistence is FU-1 (§9) |
| Scope creep (new features during redesign) | Medium | Medium | Only CSV export (D2) and the findings filter are new; both are listed |

---

## 8. Logo and brand assets

### 8.1 Brief

- **Concept:** a shield (protection) holding a lens (inspection). The two ideas stay as they are today, drawn with geometric discipline instead of stock-illustration detail. No checkmark: a check promises "safe", which a scam checker must never promise.
- **Deference:** in the UI the mark is monochrome `currentColor`. Colour (the accent tile) appears only where the OS shows it out of context: favicon, home-screen icon, OG card.
- **Legibility:** it must read at 16 px. Two optical sizes: **Mark / Regular** (stroke, ≥24 px) and **Mark / Small** (solid shield with the lens knocked out, ≤20 px, favicon).

### 8.2 Construction (24 × 24 grid, starting geometry to refine in P7)

```svg
<!-- Mark / Regular: 1.75 stroke on a 24 grid, round joins -->
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"
     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M12 2.75 19.25 5.5V11c0 4.6-3 8.3-7.25 10.25C7.75 19.3 4.75 15.6 4.75 11V5.5Z"/>
  <circle cx="11.25" cy="10.5" r="3.25"/>
  <path d="m13.6 12.85 2.4 2.4"/>
</svg>
```

- **Mark / Small:** the same shield outline, filled, with the lens ring and handle subtracted (`fill-rule="evenodd"`), minimum gap 1.5 units.
- **Wordmark:** "ScamShield" in Inter 600, tracking −0.01em; not custom-drawn. Lockup: mark height = cap height × 1.4; gap = 0.5 × mark height.
- **Clear space:** 25% of the mark height on every side.
- **Colour:**
  - UI: `currentColor` (text colour).
  - App icon/favicon: white mark on an accent tile `#0A66C2`, tile radius 22% (the HIG app-icon feel without imitating Apple's squircle).
  - Dark favicon variant: via `@media (prefers-color-scheme: dark)` *inside* the SVG.

### 8.3 Deliverables

| File | Spec |
|---|---|
| `client/src/components/Logo.tsx` | `<Logo variant="regular\|small" />` inline SVG, `currentColor`, `aria-hidden` (the link carries the name) |
| `client/public/favicon.svg` | Mark/Small on accent tile, internal dark-mode media query, **< 2 KB**, no `<text>`, `<image>`, gradients or filters |
| `client/public/favicon-32.png` | 32×32 fallback |
| `client/public/apple-touch-icon.png` | 180×180, opaque (iOS ignores transparency) |
| `client/public/og.png` | 1200×630: `bg` neutral, mark + wordmark + one line "Scam and OSINT lookups from public sources", no gradients |
| `index.html` | `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`, PNG fallback, `apple-touch-icon`, absolute `og:image` from `%SITE_URL%` (§4.1.1), `og:image:width/height`, `twitter:card=summary_large_image` |

The PNGs are rasterised from the SVG masters with Playwright's Chromium (`npm run brand:render`, `scripts/render-brand.mjs`; `playwright-core` is already a devDependency, so no new tool). The OG card is laid out in HTML with the vendored Inter file, so no `<text>` ever enters an SVG. The SVG masters are committed under `docs/brand/`.

---

## 9. Follow-ups (out of this redesign's scope)

### FU-1 Migrate DATABASE_URL to a hosted SQLite-compatible database (Turso/libSQL) so reports and counters persist

**Why:** the live service runs on Render Free, whose filesystem is ephemeral (§4.2.1, D9). Community reports, lookup counters and the lookup cache are lost on every deploy, restart and spin-down. libSQL speaks the SQLite dialect, so the schema and migrations carry over unchanged.

**The core change:** `better-sqlite3` is **synchronous**; `@libsql/client` is **asynchronous**. Every store method becomes `async` and every call site gains an `await`. The HTTP API and `shared/types.ts` stay the same.

| File | Change |
|---|---|
| `server/lib/db.ts` | `createClient({ url: DATABASE_URL, authToken: DATABASE_AUTH_TOKEN })` + `drizzle(client, { schema })` from `drizzle-orm/libsql`; migrator from `drizzle-orm/libsql/migrator` (async); drop the `journal_mode = WAL` and `busy_timeout` pragmas (not applicable remotely), keep `PRAGMA foreign_keys = ON`; `DB` type → `LibSQLDatabase<typeof schema>`; return `{ db, client }` |
| `server/lib/community.ts` | Every `.get()` / `.all()` / `.run()` / `.returning()` awaited; `db.transaction((tx) => …)` → `await db.transaction(async (tx) => …)`; `lookup()` is already async; `submit()`, `stats()` and `bumpStat()` return Promises |
| `server/lib/reportCache.ts` | `ReportCache.get/set/invalidate/purgeExpired` become async |
| `server/engine/lookup.ts` | `await deps.cache.get(...)` (line 45) and `await deps.cache.set(...)` (line 84); `onLookup` may return a Promise |
| `server/routes/api.ts` | `await community.submit(...)` (line 114), `await cache.invalidate(...)` (line 121), `res.json(await community.stats())` (line 137). Responses are unchanged, but this PR is an explicit GATE-08 exception |
| `server/index.ts` | Top-level `await runMigrations(...)` / `await seed(...)` (lines 25-27); the purge interval awaits `cache.purgeExpired()` (lines 64-67); shutdown calls `client.close()` instead of `sqlite.close()` (line 76) |
| `server/seed.ts`, `server/seed-cli.ts` | Async |
| `server/config.ts` | `DATABASE_URL` accepts `libsql://…`, `https://…` and `file:…`; new optional secret `DATABASE_AUTH_TOKEN` |
| `drizzle.config.ts` | `dialect: "turso"` with `dbCredentials: { url, authToken }` |
| `tests/api.test.ts`, `tests/helpers.ts` | In-memory libSQL (`:memory:`) with awaited setup |
| `package.json` / lockfile | `+ @libsql/client`; `− better-sqlite3`, `− @types/better-sqlite3` |
| `Dockerfile` | Drop the `python3 make g++` build dependencies (only needed to compile better-sqlite3) |
| `render.yaml` | `DATABASE_URL` = the libsql URL, `DATABASE_AUTH_TOKEN` with `sync: false` (secret), `STORAGE_PERSISTENT: "true"`; the disk becomes optional |
| `.env.example`, DEPLOYMENT.md, ARCHITECTURE.md | Document the new variables (names only) and the storage model |

**Unchanged:** `shared/schema.ts` and the SQL in `migrations/`, which use the same SQLite dialect.

**Considerations:**
- Every query becomes a network round trip. Put the Turso database in the region nearest the Render service, or use an embedded replica (`syncUrl` + local file) for fast reads.
- Check the free-tier row/storage quotas.
- The in-memory rate limiter still resets on restart, which is acceptable.
- Consider keeping `lookup_cache` local and only moving reports and statistics, if latency matters.

**Done when:** a submitted report and the lookup counter survive a manual redeploy on Render Free, and `STORAGE_PERSISTENT=true` hides every notice from §4.8.

---

## Open questions

None. Q1–Q9 are answered; see the decisions log (D1–D9) at the top.
