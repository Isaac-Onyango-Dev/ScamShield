# ScamShield redesign: definition of done

Companion to [`REDESIGN_PLAN.md`](REDESIGN_PLAN.md). Every item is checked **by running a command or opening a file/line, never by opinion**. Run all commands from the repo root.

Conventions:
- `BASE` = `86fd98a` (last commit before the redesign). `origin/main` is behind this branch, so diffs are taken against `BASE`.
- **"→ no output"** means the command must print nothing. **"→ exit 0"** means it must succeed.
- `@tag` items are Playwright tests in `tests/e2e/`, run with `npx playwright test --grep <tag>`. Tests use `page.route()` mocks and SSE fixtures, never live sources.
- The **Today** column is what the command returns on `BASE`. It shows the check actually detects the current problem. The grep commands below were dry-run against `BASE` while writing this file.

---

## Gates

- [ ] **GATE-01** TypeScript passes. Verify: `npm run check` → exit 0
- [ ] **GATE-02** Unit and integration tests pass. Verify: `npm test` → exit 0
- [ ] **GATE-03** Production build passes. Verify: `npm run build` → exit 0
- [ ] **GATE-04** E2E suite exists and passes. Verify: `node -p "require('./package.json').scripts['test:e2e']"` ≠ `undefined` **and** `npm run test:e2e` → exit 0
- [ ] **GATE-05** Design lint passes. Verify: `npm run lint:design` → exit 0
- [ ] **GATE-06** Contrast check passes. Verify: `npm run check:contrast` → exit 0
- [ ] **GATE-07** CI runs the new gates. Verify: `grep -cE "test:e2e|lint:design|check:contrast" .github/workflows/build.yml` → `3`
- [ ] **GATE-08** API contract, CSP and log policy unchanged. Verify: `git diff --exit-code 86fd98a -- server/routes/api.ts server/app.ts shared/types.ts shared/detect.ts` → exit 0

## Feature parity (one e2e test per inventory row, plan §1)

- [ ] **FEAT-01** Search input: type badge updates live; Enter submits; Shift+Enter inserts a newline; defanged `hxxp://evil[.]com` resolves to URL; navigates to `/search?q=`. Verify: `npx playwright test --grep @F01`
- [ ] **FEAT-02** All 6 examples open a lookup. Verify: `npx playwright test --grep @F02`
- [ ] **FEAT-03** Home counters render values from `/api/stats`. Verify: `npx playwright test --grep @F03`
- [ ] **FEAT-04** Capability overview lists all 6 target types and links to `/sources`. Verify: `npx playwright test --grep @F04`
- [ ] **FEAT-05** Streaming: planned sources show as pending, then fill in one by one; `done` renders the verdict. Verify: `npx playwright test --grep @F05`
- [ ] **FEAT-06** `?type=` forces the type; an invalid value is ignored. Verify: `npx playwright test --grep @F06`
- [ ] **FEAT-07** Category order is community → reputation → content → identity → exposure → infrastructure → pivots. Verify: `npx playwright test --grep @F07`
- [ ] **FEAT-08** Skipped sources appear under "Not run" with their reason. Verify: `npx playwright test --grep @F08`
- [ ] **FEAT-09** Target header shows type, normalized indicator, message truncation, and the cached badge. Verify: `npx playwright test --grep @F09`
- [ ] **FEAT-10** Copy link writes the current URL to the clipboard. Verify: `npx playwright test --grep @F10`
- [ ] **FEAT-11** JSON export downloads `scamshield-<type>-<digits>.json`, whose content equals the `done` report. Verify: `npx playwright test --grep @F11`
- [ ] **FEAT-12** Refresh requests the stream with `fresh=1` and is disabled while running. Verify: `npx playwright test --grep @F12`
- [ ] **FEAT-13** Report dialog: 7 categories, default `scam`, 1000-char limit, duplicate doesn't re-run, success re-runs, Esc closes. Verify: `npx playwright test --grep @F13`
- [ ] **FEAT-14** Verdict shows score, level label, confidence %, source count and progress. Verify: `npx playwright test --grep @F14`
- [ ] **FEAT-15** Summary text renders and is labelled AI or rules according to `generatedBy`. Verify: `npx playwright test --grep @F15`
- [ ] **FEAT-16** Red flags, trust signals and recommendations render. Verify: `npx playwright test --grep @F16`
- [ ] **FEAT-17** Verdict stays in view after scrolling at 1280 px width. Verify: `npx playwright test --grep @F17`
- [ ] **FEAT-18** Source card renders status label, summary, error, signals, facts (incl. links), items, "Show all N" (>6), source attribution and duration. Verify: `npx playwright test --grep @F18`
- [ ] **FEAT-19** Internal pivot item (`href="/search?…"`) navigates in-app without a full reload. Verify: `npx playwright test --grep @F19`
- [ ] **FEAT-20** Each planned source has a pending placeholder until its `check` event arrives. Verify: `npx playwright test --grep @F20`
- [ ] **FEAT-21** Sources page shows enabled/disabled, reason, category, upstream link, applies-to, and AI flag. Verify: `npx playwright test --grep @F21`
- [ ] **FEAT-22** API page lists all 6 endpoints. Verify: `npx playwright test --grep @F22`
- [ ] **FEAT-23** Unknown route shows "Page not found" and a link to `/`. Verify: `npx playwright test --grep @F23`
- [ ] **FEAT-24** Nav marks "Lookup" active on `/` and `/search`; GitHub link present; footer disclaimers present. Verify: `npx playwright test --grep @F24`
- [ ] **FEAT-25** Document metadata: title, description, OG tags, icons. Verify: `npx playwright test --grep @F25`
- [ ] **FEAT-26** Reduced motion: under `reducedMotion: 'reduce'`, the computed `transition-duration` of a button is `0s`. Verify: `npx playwright test --grep @F26`
- [ ] **FEAT-27** Server contract: `npm test` (tests/api.test.ts) passes and GATE-08 holds. Verify: `npx vitest run tests/api.test.ts` → exit 0

## Designed states (every data-fetching view)

- [ ] **STATE-01** `/search` with no query shows the empty state with examples. Verify: `npx playwright test --grep @state-search-empty`
- [ ] **STATE-02** Connecting shows skeletons (no spinner grid) and the status region says "Starting lookup…". Verify: `npx playwright test --grep @state-search-connecting`
- [ ] **STATE-03** Streaming shows "Looking up… n of m sources" and a `role="progressbar"` with the correct `aria-valuenow`. Verify: `npx playwright test --grep @state-search-streaming`
- [ ] **STATE-04** Done: the status region announces "Done. Score N, <Level>." Verify: `npx playwright test --grep @state-search-done`
- [ ] **STATE-05** HTTP 400 shows the server message inline under the field (`aria-describedby`); the field keeps its value; no results panel. Verify: `npx playwright test --grep @state-search-invalid`
- [ ] **STATE-06** HTTP 429 with `Retry-After: 42` shows "Try again in 42 s"; the countdown decrements; Look up and Refresh are disabled until it reaches 0. Verify: `npx playwright test --grep @state-search-ratelimited`
- [ ] **STATE-07** 429 without `Retry-After` falls back to the `RateLimit` header's `reset=`, then to 60 s. Verify: `npx playwright test --grep @state-search-ratelimit-fallback`
- [ ] **STATE-08** A network drop mid-stream keeps partial results, marks them incomplete, and shows a Retry button that restarts the lookup. Verify: `npx playwright test --grep @state-search-network`
- [ ] **STATE-09** The EventSource fallback request is aborted after headers: at most **one** extra `/api/lookup/stream` request, and its body is never parsed as JSON on 200. Verify: `npx playwright test --grep @state-search-fallback`
- [ ] **STATE-10** A report where every source errored shows "Not enough data" instead of a score. Verify: `npx playwright test --grep @state-search-allfailed`
- [ ] **STATE-11** A source `error` with an upstream 429 message shows "Rate limited by source"; other errors show "Unavailable". Verify: `npx playwright test --grep @state-source-error`
- [ ] **STATE-12** Home counters show a skeleton while loading and hide the row on error (no "—"). Verify: `npx playwright test --grep @state-home-stats`
- [ ] **STATE-13** Sources page: skeleton rows while loading; error alert with a Retry that refetches; empty state for `[]`. Verify: `npx playwright test --grep @state-sources`
- [ ] **STATE-14** Report dialog: success, duplicate (info), server error (danger) and 429 (warning) each render their own alert. Verify: `npx playwright test --grep @state-report`

## Anti-slop rules

- [ ] **SLOP-01** No gradients (no purple/blue gradient hero). Verify: `grep -rnE "bg-gradient|linear-gradient|radial-gradient|\b(from|via|to)-(transparent|white|black|[a-z]+-[0-9]{2,3})\b" client/src` → no output (today: 4 hits)
- [ ] **SLOP-02** No decorative blur/glow. Verify: `grep -rnoE "(^|[\" ])blur-(sm|md|lg|xl|2xl|3xl)\b" client/src` → no output (today: 1 (`Home.tsx:56`))
- [ ] **SLOP-03** Glass only on the sticky header. Verify: `grep -rlE "backdrop-blur|backdrop-filter" client/src` → exactly 1 file (today: 3 files)
- [ ] **SLOP-04** No emoji in UI or README. Verify: `LC_ALL=C.UTF-8 grep -rnP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{2B00}-\x{2BFF}]" client/src client/index.html README.md` → no output (today: 0 (keep it))
- [ ] **SLOP-05** No marketing copy. Verify: `grep -rniE "unlock the power|seamless|journey|supercharge|cutting-edge|next-gen|empower|effortless|harness the|revolutioni" client/src client/index.html README.md` → no output (today: 0 (keep it))
- [ ] **SLOP-06** No hacker aesthetic (Matrix, glitch, typing effect, skull/hoodie, scan line). Verify: `grep -rniE "matrix|glitch|typewriter|typing-effect|skull|hoodie|scanline|animate-scan" client/src client/public tailwind.config.ts` → no output (today: 1 (`CheckCard.tsx:147`))
- [ ] **SLOP-07** Exactly one accent, defined per theme, and it's blue. Verify: `grep -E "^\s*--color-accent:" client/src/styles/tokens.css` → exactly 2 lines: `#0A66C2`, `#4C9AFF` (today: file absent)
- [ ] **SLOP-08** Only the allowed colour tokens exist. Verify: `grep -oE "^\s*--color-[a-z0-9-]+" client/src/styles/tokens.css | tr -d ' ' | sort -u` → ⊆ {bg, surface, surface-2, text, text-secondary, text-tertiary, border, border-strong, accent, accent-hover, accent-tint, on-accent, success, success-tint, warning, warning-tint, danger, danger-tint, on-danger, focus} (today: file absent)
- [ ] **SLOP-09** No raw Tailwind palette classes. Verify: `grep -rnoE "\b(text|bg|border|ring|fill|stroke|outline|divide|decoration|placeholder|marker|shadow|from|via|to)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}" client/src` → no output (today: 121 hits)
- [ ] **SLOP-10** No hex colours outside tokens. Verify: `grep -rnE "#[0-9a-fA-F]{3,8}\b" client/src --include=*.ts --include=*.tsx --include=*.css | grep -v "styles/tokens.css"` → no output (today: 5 hits)
- [ ] **SLOP-11** One sans + one mono. Verify: `node --experimental-strip-types --no-warnings -e "import('./tailwind.config.ts').then(m=>console.log(Object.keys(m.default.theme.fontFamily??m.default.theme.extend.fontFamily).join()))"` → `sans,mono` (today: `sans,mono` but not loaded (see TOK-03))
- [ ] **SLOP-12** 4/8 px spacing: no half steps. Verify: `grep -rnoE "\b-?(p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y|space-x|space-y|inset|top|right|bottom|left)-[0-9]+\.5\b" client/src` → no output (today: 26 hits)
- [ ] **SLOP-13** No magic-number arbitrary values. Verify: `grep -rnoE "\b-?(p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|top|right|bottom|left|inset|w|h|min-w|max-w|min-h|max-h|text|leading|tracking|rounded)-\[[^]]*\]" client/src` → no output (today: 12 hits)
- [ ] **SLOP-14** Type scale only (no Tailwind default sizes, no px sizes). Verify: `grep -rnoE "\btext-(xs|sm|base|lg|xl|[2-9]xl)\b|text-\[[0-9.]+(px|rem|em)\]" client/src` → no output (today: 71 hits)
- [ ] **SLOP-15** Type scale has exactly 8 steps, none below 12 px. Verify: `grep -cE "^\s*--font-size-[a-z0-9-]+:" client/src/styles/tokens.css` → `8`; `grep -oE "\-\-font-size-[a-z0-9-]+:\s*[0-9]+px" client/src/styles/tokens.css | awk -F: '{gsub(/[^0-9]/,"",$2); if ($2<12) print}'` → `8`; no output (today: file absent)
- [ ] **SLOP-16** Radius from the 4-step scale only. Verify: `grep -rnoE "\brounded(-[a-z0-9]+)?\b" client/src | grep -vE "rounded-(sm|md|lg|full)$"` → no output (today: 9 hits)
- [ ] **SLOP-17** Motion tokens ≤200 ms. Verify: `grep -oE "\-\-duration-[a-z]+:\s*[0-9]+ms" client/src/styles/tokens.css | awk -F: '{gsub(/[^0-9]/,"",$2); if ($2>200) print}'` (and ≥3 tokens exist: `grep -c "\-\-duration-" client/src/styles/tokens.css` ≥ 3) → no output (today: file absent)
- [ ] **SLOP-18** No ad-hoc durations or `transition-all`. Verify: `grep -rnoE "transition-all|duration-[0-9]+|(^|[^0-9a-z])\.[0-9]+s\b|\b[0-9]+\.[0-9]+s\b|[0-9]{3,}ms" client/src tailwind.config.ts | grep -v "styles/tokens.css"` → no output (today: 6 hits)
- [ ] **SLOP-19** No decorative infinite animation; at most one spinner component. Verify: `grep -rnE "infinite|animate-(spin|ping|pulse|bounce)" client/src tailwind.config.ts` → matches only in `client/src/components/ui/Spinner.tsx` (today: 5 hits in 4 files)
- [ ] **SLOP-20** Reduced motion respected. Verify: `grep -c "prefers-reduced-motion" client/src/styles/base.css` ≥ 1 **and** FEAT-26 passes → ≥1 (today: in `index.css` only)
- [ ] **SLOP-21** Literal, consistent verbs. Verify: `grep -rnE "Investigat|Re-scan|Querying source|intelligence module|Report as malicious" client/src` → no output; `grep -c "Look up" client/src/components/SearchBox.tsx` ≥ 1 → as stated (today: 4 + 0)
- [ ] **SLOP-22** No AI-cliché or hacker icons. Verify: `grep -rnwE "Sparkles|Fingerprint|Wand2?|Rocket|Zap|Skull|Terminal" client/src` → no output (today: 4 hits)
- [ ] **SLOP-23** Home headline is task-focused. Verify: `grep -c "Check an email, link, domain, IP, phone number or message." client/src/pages/Home.tsx` → `1` (today: 0)
- [ ] **SLOP-24** Results have an overview table and filter. Verify: `grep -c "<table" client/src/components/FindingsTable.tsx` ≥ 1 **and** `npx playwright test --grep @findings-filter` → pass (today: file absent)
- [ ] **SLOP-25** Results carry absolute timestamps. Verify: `grep -rn "<time" client/src/pages/Search.tsx client/src/components` → ≥1 hit with `dateTime=` (today: 0)
- [ ] **SLOP-26** Every source card shows source attribution. Verify: `npx playwright test --grep @source-attribution` (count of `[data-testid=source-card]` = count of `[data-testid=source-attribution]`) → pass (today: n/a)
- [ ] **SLOP-27** Per-value copy with honest feedback. Verify: `npx playwright test --grep @copy` (success → "Copied"; denied clipboard → "Couldn't copy") → pass (today: copy shows success on failure (`Search.tsx:51-55`))
- [ ] **SLOP-28** JSON and CSV export. Verify: `npx playwright test --grep "@export-json|@export-csv"` → pass (today: JSON only)
- [ ] **SLOP-29** CSV is formula-injection safe. Verify: `npx vitest run tests/csv.test.ts` (asserts `=`, `+`, `-`, `@` prefixed with `'`) → exit 0 (today: file absent)

## Tokens and foundation

- [ ] **TOK-01** Token file with light default and dark override. Verify: `test -f client/src/styles/tokens.css && grep -c "prefers-color-scheme: dark" client/src/styles/tokens.css` → ≥1
- [ ] **TOK-02** Tailwind theme **overrides** (not extends) the scales. Verify: `node --experimental-strip-types --no-warnings -e "import('./tailwind.config.ts').then(m=>{const t=m.default.theme;console.log(['colors','spacing','fontSize','borderRadius','transitionDuration'].map(k=>k+':'+((k in t)?'override':(t.extend&&k in t.extend)?'extend':'default')).join(' '))})"` → all five `override` (today: `colors:extend`, rest `default`)
- [ ] **TOK-03** Fonts are actually bundled. Verify: `grep -rnE "@fontsource-variable/(inter|jetbrains-mono)" client/src | wc -l` → `2`; after build, `ls dist/public/assets/*.woff2 | wc -l` → ≥2
- [ ] **TOK-04** OS theme metadata. Verify: `grep -c 'name="theme-color"' client/index.html` → `2` **and** `grep -c 'name="color-scheme" content="light dark"' client/index.html` → `1`
- [ ] **TOK-05** E2E runs in both schemes and at mobile width. Verify: `grep -cE "colorScheme: ['\"](light|dark)['\"]" playwright.config.ts` → ≥2 **and** `grep -c "375" playwright.config.ts` → ≥1
- [ ] **TOK-06** Primitives exist. Verify: `ls client/src/components/ui/{Button,Badge,StatusBadge,Card,ExternalLink,SourceLink,CopyButton,Skeleton,InlineAlert,EmptyState}.tsx` → exit 0
- [ ] **TOK-07** Old stylesheet split. Verify: `ls client/src/styles/{tokens,base,index}.css` → exit 0 **and** `test ! -e client/src/index.css`

## Accessibility (WCAG 2.2 AA)

- [ ] **A11Y-01** axe: zero violations for tags `wcag2a, wcag2aa, wcag21aa, wcag22aa` on `/`, `/search` (done, streaming, error, rate-limited), `/sources`, `/api`, `/nope`, report dialog open, in the light, dark, mobile-375 and reduced-motion projects. Verify: `npx playwright test --grep @axe` → exit 0
- [ ] **A11Y-02** Every text/background token pair is ≥4.5:1 and every UI boundary/focus pair ≥3:1, in both themes. Verify: `node scripts/check-contrast.mjs` → exit 0 (today: slate-500/ink-950 = 4.19, white/rose-500 = 3.67)
- [ ] **A11Y-03** One visible focus ring, never suppressed. Verify: `grep -c ":focus-visible" client/src/styles/base.css` → ≥1 **and** `grep -rnE "focus:outline-none|focus-visible:ring-0|focus-visible:outline-none" client/src` → no output (today: `SearchBox.tsx:73`, `ReportDialog.tsx:82`)
- [ ] **A11Y-04** Keyboard paths: first Tab lands on "Skip to content"; Enter submits; Shift+Enter adds a newline; filter uses arrow keys; dialog traps focus, Esc closes, and focus returns to "Report…". Verify: `npx playwright test --grep @keyboard`
- [ ] **A11Y-05** Skip link targets main. Verify: `grep -c 'href="#main"' client/src/components/Layout.tsx` → `1` **and** `grep -c 'id="main"' client/src/components/Layout.tsx` → `1`
- [ ] **A11Y-06** Active nav exposed. Verify: `grep -c "aria-current" client/src/components/Layout.tsx` → ≥1 (today 0)
- [ ] **A11Y-07** Live regions are scoped. Verify: `grep -rln "aria-live" client/src` → only `client/src/components/LookupStatus.tsx` and `client/src/components/ui/CopyButton.tsx`; `grep -c "aria-live" client/src/components/VerdictPanel.tsx` → `0`
- [ ] **A11Y-08** Progress and score are exposed. Verify: `grep -rnoE 'role="(progressbar|meter)"' client/src | wc -l` → ≥2
- [ ] **A11Y-09** Report category is a real radio group. Verify: `grep -cE "<fieldset|<legend|type=\"radio\"" client/src/components/ReportDialog.tsx` → ≥3
- [ ] **A11Y-10** Submit and home link have accessible names at 375 px (fixes `SearchBox.tsx:84`, `Layout.tsx:19-20`). Verify: `npx playwright test --grep @axe --project=mobile-light` → exit 0
- [ ] **A11Y-11** Severity and status never rely on colour alone: every `[data-severity]` and `[data-status]` element has non-empty text. Verify: `npx playwright test --grep @color-independence`
- [ ] **A11Y-12** Document language set. Verify: `grep -c '<html lang="en"' client/index.html` → `1`

## Page-specific

- [ ] **SHELL-01** Logo component in header, wordmark visible at all widths. Verify: `grep -c "<Logo" client/src/components/Layout.tsx` → ≥1 **and** `grep -c "hidden sm:inline" client/src/components/Layout.tsx` → `0`
- [ ] **SHELL-02** 404 copy is literal. Verify: `grep -c "Go to lookup" client/src/App.tsx` → `1`
- [ ] **HOME-01** Capability overview is one table/definition list, not icon cards. Verify: `grep -cE "<table|<dl" client/src/pages/Home.tsx` → ≥1 **and** `grep -c "CAPABILITIES.map(({ icon" client/src/pages/Home.tsx` → `0`
- [ ] **HOME-02** Hero decorations removed. Verify: `grep -cE "grid-bg|blur-3xl|Free · open source" client/src/pages/Home.tsx` → `0` (today 3)
- [ ] **RES-01** Verdict meter reflects the score. Verify: `npx playwright test --grep @verdict-meter` (`role=meter` `aria-valuenow` = fixture score)
- [ ] **RES-02** Red flags capped at 5, with "Show all N" and links to `#source-<id>`. Verify: `npx playwright test --grep @red-flags`
- [ ] **RES-03** Message targets clamp to 3 lines with "Show full message". Verify: `npx playwright test --grep @message-target`
- [ ] **RES-04** "Report…" is not styled as danger. Verify: `grep -nE "Report…" client/src/pages/Search.tsx` shows `variant="secondary"` on that line
- [ ] **SRC-01** Sources are grouped by category into tables with a status column. Verify: `grep -c "<table" client/src/pages/Sources.tsx` → ≥1 **and** `grep -c "Needs API key" client/src/pages/Sources.tsx` → ≥1
- [ ] **API-01** Examples use the real origin. Verify: `grep -c "YOUR-HOST" client/src/pages/ApiDocs.tsx` → `0` **and** `grep -c "location.origin" client/src/pages/ApiDocs.tsx` → ≥1
- [ ] **API-02** Code examples are copyable. Verify: `grep -c "<CopyButton" client/src/pages/ApiDocs.tsx` → ≥1

## Cleanup

- [ ] **CLEAN-01** Dead server functions removed. Verify: `grep -rnwE "brandCount|disposableCount" server shared client tests` → no output (today 2)
- [ ] **CLEAN-02** Legacy palette, animations and utilities removed. Verify: `grep -rnE "grid-bg|animate-scan|animate-fade-up|\bink-[0-9]|\bbrand-[0-9]" client/src tailwind.config.ts client/index.html` → no output (today 31)
- [ ] **CLEAN-03** Legacy component classes removed. Verify: `grep -rnwE "btn|btn-primary|btn-ghost|panel|chip" client/src --include=*.tsx --include=*.css` → no output (today 31)
- [ ] **CLEAN-04** One outbound-link policy. Verify: `grep -rlE 'rel="|target="_blank"' client/src` → only `client/src/components/ui/ExternalLink.tsx` **and** `grep -c 'noopener noreferrer nofollow' client/src/components/ui/ExternalLink.tsx` → `1` (today 3 files, 2 policies)
- [ ] **CLEAN-05** One SignalList. Verify: `grep -rn "function SignalList" client/src | wc -l` → `1` **and** `grep -rln "signals.map" client/src` → only `client/src/components/SignalList.tsx`
- [ ] **CLEAN-06** No class-string hacks. Verify: `grep -rn 'split(" ")\[0\]' client/src` → no output (today `CheckCard.tsx:63`)
- [ ] **CLEAN-07** No data exported from component files. Verify: `grep -rn "export const EXAMPLES" client/src/components` → no output **and** `test -f client/src/lib/examples.ts`
- [ ] **CLEAN-08** `lib/ui.ts` split. Verify: `test ! -e client/src/lib/ui.ts && ls client/src/lib/{status,format,categories}.ts`
- [ ] **CLEAN-09** Superseded components removed (if Q5 approved). Verify: `test ! -e client/src/components/RiskGauge.tsx && ! grep -rn "PendingCard" client/src`
- [ ] **CLEAN-10** Internal-only symbols no longer exported. Verify: `for n in CommunityRecord DnsOutcome HostAnalysis HostInfo IpClass LEVEL_LABELS LookupDeps PATTERNS RISK_WEIGHTS TRUST_WEIGHTS TargetParseResult USER_AGENT brandsInLocalPart cacheKey mailProvider pivotsFor resolveA skippedResult; do grep -rnE "^export (async )?(const|function|type|interface|class) $n\b" server shared client/src; done` → no output
- [ ] **CLEAN-11** Every runtime dependency is imported. Verify: `for d in $(node -p "Object.keys(require('./package.json').dependencies).join(' ')"); do grep -rqE "from [\"']$d|import [\"']$d" server client/src shared || echo "UNUSED $d"; done` → no output
- [ ] **CLEAN-12** Dependency tree consistent. Verify: `npm ls --depth=0` → exit 0
- [ ] **CLEAN-13** No UI framework added. Verify: `node -p "Object.keys({...require('./package.json').dependencies,...require('./package.json').devDependencies}).filter(d=>/^(@mui|@chakra-ui|antd|@mantine|bootstrap|@radix-ui|framer-motion|styled-components|@emotion)/.test(d)).join()"` → empty line

## Logo and brand assets

- [ ] **LOGO-01** Asset set exists. Verify: `ls client/public/favicon.svg client/public/favicon-32.png client/public/apple-touch-icon.png client/public/og.png client/src/components/Logo.tsx docs/brand/*.svg` → exit 0
- [ ] **LOGO-02** Raster sizes and formats are exact. Verify: `file client/public/favicon-32.png client/public/apple-touch-icon.png client/public/og.png` → `PNG image data, 32 x 32`, `180 x 180`, `1200 x 630` respectively
- [ ] **LOGO-03** Old JPEG gone and unreferenced. Verify: `test ! -e client/public/logo.png && ! grep -rn "logo.png" client README.md`
- [ ] **LOGO-04** Favicon is tiny. Verify: `test $(wc -c < client/public/favicon.svg) -lt 2048`
- [ ] **LOGO-05** Vector-pure marks (no raster, text, gradients, filters). Verify: `grep -lE "<image|<text|Gradient|<filter|base64" client/public/favicon.svg client/src/components/Logo.tsx docs/brand/*.svg` → no output
- [ ] **LOGO-06** Favicon adapts to dark mode. Verify: `grep -c "prefers-color-scheme" client/public/favicon.svg` → ≥1
- [ ] **LOGO-07** In-app mark uses the text colour. Verify: `grep -c "currentColor" client/src/components/Logo.tsx` → ≥1
- [ ] **LOGO-08** Icons and OG wired correctly. Verify: `grep -cE 'rel="icon" href="/favicon.svg" type="image/svg\+xml"|rel="apple-touch-icon"|property="og:image" content="https://|property="og:image:width"|name="twitter:card"' client/index.html` → `5`
- [ ] **LOGO-09** Home link is named. Verify: `grep -c 'aria-label="ScamShield home"' client/src/components/Layout.tsx` → `1`
- [ ] **LOGO-10** Public assets are lighter. Verify: `du -cb client/public/* | tail -1` → < 150000 (today 318060)

## README and docs

- [ ] **README-01** Required sections present. Verify: `for h in "## What it does" "## What it checks" "## Quick start" "## Configuration" "## Using the app" "## API" "## How scoring works" "## Development" "## Accessibility" "## License"; do grep -qF "$h" README.md || echo "missing: $h"; done` → no output
- [ ] **README-02** No competitor/marketing framing. Verify: `grep -c "EmailOSINT" README.md` → `0` (today 1)
- [ ] **README-03** Light/dark screenshots referenced and present. Verify: `grep -c "screenshot-light.png\|screenshot-dark.png" README.md` → ≥2 **and** `ls docs/screenshot-light.png docs/screenshot-dark.png`
- [ ] **README-04** All local links and images resolve. Verify: `node -e "const fs=require('fs');const s=fs.readFileSync('README.md','utf8');const r=[...s.matchAll(/\]\(((?!https?:|mailto:)[^)#\s]+)[^)]*\)|(?:src|srcset)=\"((?!https?:)[^\"\s]+)/g)].map(m=>m[1]||m[2]);const miss=r.filter(p=>!fs.existsSync(p));console.log(miss.length?'MISSING '+miss:'OK')"` → `OK`
- [ ] **README-05** Every `npm run X` in the README exists. Verify: `node -e "const p=require('./package.json').scripts;const s=require('fs').readFileSync('README.md','utf8');const m=[...new Set([...s.matchAll(/npm run ([\w:-]+)/g)].map(x=>x[1]))].filter(x=>!p[x]);console.log(m.length?'MISSING '+m:'OK')"` → `OK`
- [ ] **README-06** Test count claim matches reality. Verify: the number in `grep -oE "[0-9]+ unit" README.md` equals the "Tests N passed" total from `npx vitest run`
- [ ] **README-07** Configuration table lists names, never values. Verify: `grep -nE "(API_KEY|TOKEN|SALT|AUTH_KEY)=[^$\" ]" README.md` → no output
- [ ] **README-08** ARCHITECTURE.md link-policy claim is true. Verify: CLEAN-04 passes **and** `grep -c "noopener noreferrer nofollow" ARCHITECTURE.md` → ≥1

## Security and secrets

- [ ] **SEC-01** No env files tracked except the example. Verify: `git ls-files | grep -E "(^|/)\.env" | grep -v "^\.env\.example$"` → no output
- [ ] **SEC-02** Example file ships with empty API keys. Verify: `grep -cE "^(OPENAI_API_KEY|HIBP_API_KEY|GOOGLE_SAFE_BROWSING_KEY|URLHAUS_AUTH_KEY|ABUSEIPDB_API_KEY|GITHUB_TOKEN)=.+" .env.example` → `0`
- [ ] **SEC-03** No secret-shaped strings in docs or build output. Verify: `grep -rnE "sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}|xox[bpa]-|AIza[0-9A-Za-z_-]{20,}" README.md ARCHITECTURE.md DEPLOYMENT.md docs dist/public` → no output
- [ ] **SEC-04** No inline scripts (CSP `script-src 'self'` still valid). Verify: `grep -E "<script" client/index.html | grep -v 'src='` → no output
- [ ] **SEC-05** No third-party font or CDN requests. Verify: `grep -rnE "fonts.googleapis|fonts.gstatic|unpkg|jsdelivr|cdnjs" client` → no output
- [ ] **SEC-06** CSP, logging and headers unchanged. Verify: GATE-08 (`server/app.ts` byte-identical to `BASE`)

---

## Open questions

These block specific items. Defaults are shown in brackets.

1. **Canonical site URL for `og:image`** (LOGO-08). OG crawlers need an absolute URL. Options: hard-code `https://scamshield-dkmg.onrender.com` (already used in `build.yml`), or read `%VITE_SITE_URL%` at build time. [Default: env var, with the Render URL in `render.yaml`.]
2. **CSV export** (SLOP-28/29) is a new, additive feature. Keep it? [Default: yes.]
3. **Playwright + axe dev dependencies** add about 1–2 min to CI but make ~45 items verifiable. OK? [Default: yes.]
4. **Home counters** show zeros on fresh deploys. Keep them as a quiet caption row (plan §4.2), hide them until `totalLookups ≥ 100`, or move them to `/sources`? [Default: quiet caption row.]
5. **Replace the semicircle gauge with a linear meter** (CLEAN-09, RES-01)? [Default: yes.]
6. **Self-hosted Inter + JetBrains Mono vs pure system stack** (TOK-03). Self-hosted means consistent rendering and a dotted zero, at about 100 KB. The system stack is native on Apple devices, costs 0 KB, and varies elsewhere. [Default: self-hosted.]
7. **Manual light/dark toggle**: deferred. It needs an external pre-paint script plus `localStorage`. Needed now? [Default: no, follow the OS.]
8. **GitHub Pages redirect page** (`.github/workflows/build.yml:53`) has its own inline styling with `#2563eb`. Restyle it to match, or leave it? [Default: leave; out of scope.]
