#!/usr/bin/env node
// Design-system linter for the redesign (docs/REDESIGN_CHECKLIST.md, SLOP-* and CLEAN-02).
// Report-only by default (exit 0) so it can run in CI from P0; `--strict` exits 1 on any
// violation and becomes the default in P6. Pure Node: no grep/ripgrep needed.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const CLIENT = "client/src";
const TOKENS = "client/src/styles/tokens.css";
const TAILWIND = "tailwind.config.ts";
const HTML = "client/index.html";
const README = "README.md";

const inClient = (f) => f.startsWith(`${CLIENT}/`);
const notTokens = (f) => f !== TOKENS;

/**
 * count: "lines" counts matching lines (like `grep -n`), "matches" counts every match (like `grep -o`).
 * files: which files the rule scans. allow: optional predicate for matches that are fine.
 */
export const RULES = [
    { id: "SLOP-01", title: "No gradients", count: "lines", files: inClient, re: /bg-gradient|linear-gradient|radial-gradient|\b(from|via|to)-(transparent|white|black|[a-z]+-[0-9]{2,3})\b/ },
    { id: "SLOP-02", title: "No decorative blur/glow", count: "matches", files: inClient, re: /(^|[" ])blur-(sm|md|lg|xl|2xl|3xl)\b/g },
    { id: "SLOP-03", title: "Glass (backdrop blur) in at most one file", count: "files", max: 1, files: inClient, re: /backdrop-blur|backdrop-filter/ },
    { id: "SLOP-04", title: "No emoji in UI or README", count: "lines", files: (f) => inClient(f) || f === HTML || f === README, re: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u },
    { id: "SLOP-05", title: "No marketing copy", count: "lines", files: (f) => inClient(f) || f === HTML || f === README, re: /unlock the power|seamless|journey|supercharge|cutting-edge|next-gen|empower|effortless|harness the|revolutioni/i },
    { id: "SLOP-06", title: "No hacker aesthetic", count: "lines", files: (f) => inClient(f) || f === TAILWIND, re: /matrix|glitch|typewriter|typing-effect|skull|hoodie|scanline|animate-scan/i },
    {
        id: "SLOP-09",
        title: "No raw Tailwind palette classes",
        count: "matches",
        files: inClient,
        re: /\b(text|bg|border|ring|fill|stroke|outline|divide|decoration|placeholder|marker|shadow|from|via|to)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}/g,
    },
    { id: "SLOP-10", title: "No hex colours outside tokens.css", count: "lines", files: (f) => inClient(f) && notTokens(f) && /\.(ts|tsx|css)$/.test(f), re: /#[0-9a-fA-F]{3,8}\b/ },
    { id: "SLOP-12", title: "No half-step spacing", count: "matches", files: inClient, re: /\b-?(p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y|space-x|space-y|inset|top|right|bottom|left)-[0-9]+\.5\b/g },
    {
        id: "SLOP-13",
        title: "No magic-number arbitrary values",
        count: "matches",
        files: inClient,
        re: /\b-?(p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|top|right|bottom|left|inset|w|h|min-w|max-w|min-h|max-h|text|leading|tracking|rounded)-\[[^\]]*\]/g,
    },
    { id: "SLOP-14", title: "Type scale tokens only", count: "matches", files: inClient, re: /\btext-(xs|sm|base|lg|xl|[2-9]xl)\b|text-\[[0-9.]+(px|rem|em)\]/g },
    { id: "SLOP-16", title: "Radius scale only (sm, md, lg, full)", count: "matches", files: inClient, re: /\brounded(-[a-z0-9]+)?\b/g, allow: (m) => /^rounded-(sm|md|lg|full)$/.test(m) },
    {
        id: "SLOP-18",
        title: "No ad-hoc durations or transition-all",
        count: "matches",
        files: (f) => (inClient(f) && notTokens(f)) || f === TAILWIND,
        re: /transition-all|duration-[0-9]+|(^|[^0-9a-z])\.[0-9]+s\b|\b[0-9]+\.[0-9]+s\b|[0-9]{3,}ms/g,
    },
    { id: "SLOP-19", title: "Infinite animation only in ui/Spinner.tsx", count: "lines", files: (f) => (inClient(f) && f !== `${CLIENT}/components/ui/Spinner.tsx`) || f === TAILWIND, re: /infinite|animate-(spin|ping|pulse|bounce)/ },
    { id: "SLOP-21", title: "Literal, consistent verbs", count: "lines", files: inClient, re: /Investigat|Re-scan|Querying source|intelligence module|Report as malicious/ },
    { id: "SLOP-22", title: "No AI-cliché or hacker icons", count: "lines", files: inClient, re: /\b(Sparkles|Fingerprint|Wand2?|Rocket|Zap|Skull|Terminal)\b/ },
    { id: "CLEAN-02", title: "No legacy palette/animation classes", count: "lines", files: (f) => inClient(f) || f === TAILWIND || f === HTML, re: /grid-bg|animate-scan|animate-fade-up|\bink-[0-9]|\bbrand-[0-9]/ },
];

/** Rules that need client/src/styles/tokens.css (introduced in P1). */
export const TOKEN_RULES = [
    {
        id: "SLOP-07",
        title: "Exactly one accent per theme",
        check: (css) => {
            const n = (css.match(/^\s*--color-accent:/gm) ?? []).length;
            return n === 2 ? [] : [`--color-accent defined ${n}× (expected 2: light + dark)`];
        },
    },
    {
        id: "SLOP-15",
        title: "8-step type scale, nothing below 12px",
        check: (css) => {
            const sizes = [...css.matchAll(/--font-size-[a-z0-9-]+:\s*([0-9]+)px/g)].map((m) => Number(m[1]));
            const out = sizes.filter((s) => s < 12).map((s) => `font size ${s}px < 12px`);
            if (sizes.length !== 8) out.push(`${sizes.length} font-size tokens (expected 8)`);
            return out;
        },
    },
    {
        id: "SLOP-17",
        title: "Motion tokens ≤ 200ms",
        check: (css) => {
            const d = [...css.matchAll(/--duration-([a-z]+):\s*([0-9]+)ms/g)];
            const out = d.filter((m) => Number(m[2]) > 200).map((m) => `--duration-${m[1]} is ${m[2]}ms`);
            if (d.length < 3) out.push(`${d.length} duration tokens (expected ≥ 3)`);
            return out;
        },
    },
];

/** Lints an in-memory file map ({ "client/src/x.tsx": "…" }); returns one result per rule. */
export function lintFiles(files) {
    const results = RULES.map((rule) => {
        const hits = [];
        const filesHit = new Set();
        for (const [file, text] of Object.entries(files)) {
            if (!rule.files(file)) continue;
            text.split("\n").forEach((line, i) => {
                if (rule.count === "matches") {
                    for (const m of line.matchAll(rule.re)) {
                        const token = m[0].trim();
                        if (rule.allow?.(token)) continue;
                        hits.push(`${file}:${i + 1}  ${token}`);
                    }
                } else if (rule.re.test(line)) {
                    hits.push(`${file}:${i + 1}  ${line.trim().slice(0, 100)}`);
                    filesHit.add(file);
                }
            });
        }
        if (rule.count === "files") {
            const n = filesHit.size;
            return { id: rule.id, title: rule.title, count: n > rule.max ? n : 0, detail: `${n} file(s), max ${rule.max}`, hits: [...filesHit] };
        }
        return { id: rule.id, title: rule.title, count: hits.length, hits };
    });

    const tokens = files[TOKENS];
    for (const rule of TOKEN_RULES) {
        if (tokens === undefined) results.push({ id: rule.id, title: rule.title, count: 0, na: "n/a until P1 (no tokens.css)", hits: [] });
        else {
            const hits = rule.check(tokens);
            results.push({ id: rule.id, title: rule.title, count: hits.length, hits });
        }
    }
    return results.sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
}

function walk(dir) {
    return readdirSync(dir).flatMap((name) => {
        const p = path.join(dir, name);
        return statSync(p).isDirectory() ? walk(p) : [p];
    });
}

export function loadRepoFiles(root = process.cwd()) {
    const rel = (p) => path.relative(root, p).split(path.sep).join("/");
    const list = [...walk(path.join(root, CLIENT)), ...[TAILWIND, HTML, README].map((f) => path.join(root, f)).filter(existsSync)];
    return Object.fromEntries(list.map((p) => [rel(p), readFileSync(p, "utf8")]));
}

function main() {
    const strict = process.argv.includes("--strict");
    const results = lintFiles(loadRepoFiles());
    let total = 0;
    for (const r of results) {
        total += r.count;
        const status = r.na ? "n/a " : r.count === 0 ? "ok  " : "FAIL";
        console.log(`${status} ${r.id.padEnd(9)} ${String(r.na ? "-" : r.count).padStart(4)}  ${r.title}${r.detail ? ` (${r.detail})` : ""}${r.na ? ` (${r.na})` : ""}`);
        if (r.count) for (const h of r.hits.slice(0, 5)) console.log(`       ${h}`);
    }
    console.log(`\n${total} design violation(s)${strict ? "" : " (report-only; run with --strict to enforce)"}`);
    if (strict && total > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
