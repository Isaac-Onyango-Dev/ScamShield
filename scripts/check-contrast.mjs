#!/usr/bin/env node
// Verifies WCAG 2.2 AA contrast for every token pair the UI uses, in both themes
// (docs/REDESIGN_CHECKLIST.md A11Y-02). Reads client/src/styles/tokens.css directly.
import { readFileSync } from "node:fs";

const FILE = "client/src/styles/tokens.css";
const css = readFileSync(FILE, "utf8");

function tokens(block) {
    return Object.fromEntries([...block.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]));
}

const darkStart = css.indexOf("@media (prefers-color-scheme: dark)");
const light = tokens(css.slice(0, darkStart));
const dark = { ...light, ...tokens(css.slice(darkStart)) };

function luminance(hex) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function ratio(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

const SURFACES = ["bg", "surface", "surface-2"];
const TEXT = 4.5; // WCAG 1.4.3, normal text
const UI = 3; // WCAG 1.4.11, component boundaries and focus indicators

const pairs = [
    ...["text", "text-secondary", "text-tertiary", "accent", "accent-hover", "success", "warning", "danger"].flatMap((fg) => SURFACES.map((bg) => [fg, bg, TEXT])),
    ["on-accent", "accent", TEXT],
    ["on-accent", "accent-hover", TEXT],
    ["on-danger", "danger", TEXT],
    ["accent", "accent-tint", TEXT],
    ["text", "accent-tint", TEXT],
    ["success", "success-tint", TEXT],
    ["warning", "warning-tint", TEXT],
    ["danger", "danger-tint", TEXT],
    ["text", "success-tint", TEXT],
    ["text", "warning-tint", TEXT],
    ["text", "danger-tint", TEXT],
    ...SURFACES.flatMap((bg) => [
        ["border-strong", bg, UI],
        ["focus", bg, UI],
    ]),
];

let failures = 0;
for (const [theme, t] of [
    ["light", light],
    ["dark", dark],
]) {
    for (const [fg, bg, min] of pairs) {
        if (!t[fg] || !t[bg]) {
            console.log(`FAIL ${theme.padEnd(5)} --color-${fg} on --color-${bg}: token missing`);
            failures++;
            continue;
        }
        const r = ratio(t[fg], t[bg]);
        const ok = r >= min;
        if (!ok) failures++;
        if (!ok || process.argv.includes("--verbose")) {
            console.log(`${ok ? "ok  " : "FAIL"} ${theme.padEnd(5)} ${fg.padEnd(14)} on ${bg.padEnd(12)} ${r.toFixed(2).padStart(5)} (min ${min})`);
        }
    }
}
console.log(`${pairs.length * 2 - failures}/${pairs.length * 2} contrast pairs pass (${FILE})`);
if (failures) process.exitCode = 1;
