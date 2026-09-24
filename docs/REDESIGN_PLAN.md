# ScamShield redesign plan

Status: **plan only, no application code has changed.** Baseline commit: `86fd98a`, branch `claude/bold-dirac-rk5uw8`.
Companion file: [`REDESIGN_CHECKLIST.md`](REDESIGN_CHECKLIST.md), the definition of done. Every item there can be checked with a command.

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
| A4 | Fonts are self-hosted | Helmet's default CSP allows `font-src 'self'`; no third-party requests (privacy) | If system fonts are chosen instead (open question Q6), drop the two font packages. Mono glyph disambiguation then varies by OS |
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
| F25 | Document metadata | `client/index.html` | Title, description, OG title/description/image, theme-color, favicon |
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

Rules: numbers in data use `font-variant-numeric: tabular-nums`. No uppercase micro-labels; section labels use `footnote` at weight 600 in sentence case. Delivered as `@fontsource-variable/inter` and `@fontsource-variable/jetbrains-mono` (latin subset, `font-display: swap`). Expected weight is about 70–110 KB woff2 in total, cached immutably under `/assets/`.

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

### 4.2 Home (`/`)

| Before | After | Rationale |
|---|---|---|
| Radial glow, grid background, accent-coloured headline word "trust", pill "Free · open source · no sign-up" | Plain `bg`. `title-1`: **"Check an email, link, domain, IP, phone number or message."** `body` secondary: "Results come from public sources and are streamed as each one answers." | Tool-first. Removes the anti-slop elements (#15). The headline says what the page does |
| Search box with glow shadow and nested focus treatment | 44 px `rounded-lg` field, `border-strong` boundary, a single focus ring on the field container, type badge (accent-tint) on the right, primary button **"Look up"** (visible label at all widths; icon-only below 400 px keeps an `aria-label`) | #3, #4, #21 |
| (no helper text) | Helper text below the field (`footnote`, tertiary): "Paste a whole message to extract links and numbers. Defanged input like hxxp://evil[.]com works." | Moves the useful parts of the "1-2-3" section to where they're needed |
| "Try:" chips | "Examples" label + 6 `plain` buttons in `footnote` ("Phishing domain", "Email", …) | Keeps F2; quieter |
| 4 big counters band (shows zeros) | Single `caption` row under the examples: "6 known scam indicators · 0 community reports (24 h) · 0 lookups run". Skeleton while loading; row hidden on error (non-critical data) | Keeps F3. The numbers stay honest without making zeros the loudest thing on the page. See Q4 |
| 6 icon-tile capability cards | One `Card` holding a two-column definition table, "What each lookup checks": type (Email, Link, Domain, IP, Phone, Message) → a comma-separated list of checks, then a "See all sources" link to `/sources` | Keeps F4. Scannable, no decorative icon tiles, about 60% less height |
| "1. Paste anything / 2. … / 3. …" | Removed (content moved to helper text and the Sources page) | Redundant |

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
| Semicircle SVG gauge (200 px, 800 ms) | `display` score "98" + "/100" `caption`, level label `headline` in the level colour, **linear meter** (`role="meter"`, `aria-valuenow`, 8 px, 200 ms fill) with 5 tick labels | More compact, aligns with the text column, and reads correctly without colour. See Q5 |
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

**CSV export (new, additive; see Q2):** `scamshield-<type>-<epoch>.csv`, UTF-8 with BOM, columns `generated_at, target_type, target, source_id, source_name, category, status, summary, signal_kind, signal_severity, signal_label, source_url, duration_ms`, one row per signal (a source with no signals gets one row with empty signal columns). Values are CSV-escaped, and values starting with `= + - @` are prefixed with `'` to prevent formula injection in spreadsheets.

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

---

## 5. Cleanup plan

### 5.1 Delete (evidence: zero references, or superseded)

| Item | Evidence | Phase |
|---|---|---|
| `brandCount()`, `disposableCount()` in `server/lib/domain.ts:49-55` | `grep -rnw "brandCount\|disposableCount" server shared client tests` → only the definitions | P6 |
| `.panel`, `.chip`, `.btn*`, `.grid-bg` in `client/src/index.css:21-45` | Replaced by primitives (§3.8) | P1–P6 |
| `keyframes.fade-up`, `keyframes.scan`, `animation.*` in `tailwind.config.ts:26-34` | Replaced by motion tokens; the scan effect is banned | P3 |
| `colors.ink`, `colors.brand` in `tailwind.config.ts:10-25` | Replaced by token colours | P6 |
| `RiskGauge.tsx` | Replaced by the `VerdictMeter` inside `VerdictPanel` (pending Q5) | P3 |
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
| **Add** `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono` | fixes #6 | Runtime, fonts only |
| **Add (dev)** `@playwright/test`, `@axe-core/playwright` | e2e + a11y gates | Uses the preinstalled Chromium; see Q3 |

No dependency is unused, so none are removed. No UI framework is added: the audit shows the problems are token discipline and semantics, not missing components.

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
6. **Configuration**: table of **variable names** and purpose only (from `.env.example`, never values); link to DEPLOYMENT.md.
7. **Using the app**: lookup → results overview → filters → copy/export (JSON, CSV) → report dialog → rate limits.
8. **API**: current section, plus the rate-limit headers.
9. **How scoring works**: current section (it's accurate).
10. **Architecture & deployment**: links to ARCHITECTURE.md and DEPLOYMENT.md.
11. **Development**: `check`, `test`, `test:e2e`, `lint:design`, `check:contrast`, `db:generate`, `data:disposable`; "Adding a source".
12. **Accessibility**: WCAG 2.2 AA target, what's automated (axe, contrast script), how to report issues.
13. **License**: MIT.

Removed: the "works like hosted tools such as EmailOSINT" comparison, which is marketing framing. The test-count claim ("100") must be replaced by the actual `vitest` total at the time of writing. ARCHITECTURE.md's client box and the `nofollow` claim get updated in the same PR.

---

## 7. Implementation order and risks

### 7.1 Phases (each phase is one PR that must pass its checklist subset)

| Phase | Scope | Exit criteria (checklist IDs) | Size |
|---|---|---|---|
| **P0 Safety net** | Add Playwright + axe; `tests/e2e/` with `page.route()` mocks for `/api/stats`, `/api/sources`, `/api/reports`, and an **SSE fixture** (`tests/e2e/fixtures/*.sse`: start/check/done built from a real report) for `/api/lookup/stream`; one test per F1–F27; axe run recorded as a **baseline** (expected failures listed, not yet blocking); `scripts/lint-design.mjs` in report-only mode; `npm run test:e2e` in CI | GATE-04, FEAT-* | M |
| **P1 Foundation** | `tokens.css`, `base.css`, fonts, `check-contrast.mjs`; Tailwind **extend** mapping (old classes still compile); primitives in `components/ui/` | TOK-*, A11Y-02 | M |
| **P2 Shell** | Layout, skip link, Logo placeholder (`currentColor` wordmark), footer, 404, `index.html` colour-scheme metas | A11Y-05/06, SHELL-* | S |
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
| e2e flakiness / CI time (+1–2 min) | Medium | Low | Route mocks only (no live network); Chromium preinstalled; `retries: 1` in CI only |
| Scope creep (new features during redesign) | Medium | Medium | Only CSV export and the findings filter are new; both are listed and gated by Q2 |

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
| `index.html` | `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`, PNG fallback, `apple-touch-icon`, absolute `og:image` (see Q1), `og:image:width/height`, `twitter:card=summary_large_image` |

The PNGs are rasterised once from the SVG sources with `npx --yes @resvg/resvg-js-cli`. The SVG masters are committed under `docs/brand/`. Nothing is added to `package.json`.

---

## Open questions

See the summary returned with this plan; they're repeated at the end of [`REDESIGN_CHECKLIST.md`](REDESIGN_CHECKLIST.md#open-questions).
