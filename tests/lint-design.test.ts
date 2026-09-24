import { describe, expect, it } from "vitest";
import { lintFiles, loadRepoFiles } from "../scripts/lint-design.mjs";

const count = (files: Record<string, string>, id: string) => lintFiles(files).find((r) => r.id === id)!.count;
const tsx = (body: string) => ({ "client/src/X.tsx": body });

describe("lint-design", () => {
    it.each([
        ["SLOP-01", `<div className="bg-gradient-to-r from-purple-500 to-blue-500" />`, `<div className="bg-surface" />`],
        ["SLOP-02", `<div className="blur-3xl" />`, `<div className="backdrop-blur-sm" />`],
        ["SLOP-06", `<div className="animate-scan" />`, `<div className="animate-none" />`],
        ["SLOP-09", `<p className="text-slate-500" />`, `<p className="text-tertiary" />`],
        ["SLOP-10", `const c = "#19c08c";`, `const id = "#main";`],
        ["SLOP-12", `<p className="mt-0.5 px-2.5" />`, `<p className="mt-1 px-2" />`],
        ["SLOP-13", `<p className="w-[900px]" />`, `<p className="grid-cols-[320px_1fr]" />`],
        ["SLOP-14", `<p className="text-sm text-[11px]" />`, `<p className="text-footnote" />`],
        ["SLOP-16", `<p className="rounded-2xl" />`, `<p className="rounded-lg rounded-full" />`],
        ["SLOP-18", `<p className="transition-all duration-500" />`, `<p className="transition-colors duration-base" />`],
        ["SLOP-19", `<Loader className="animate-spin" />`, `<Loader className="h-4" />`],
        ["SLOP-21", `<button>Investigate</button>`, `<button>Look up</button>`],
        ["SLOP-22", `import { Sparkles } from "lucide-react";`, `import { Search } from "lucide-react";`],
        ["CLEAN-02", `<div className="bg-ink-950" />`, `<div className="bg-bg" />`],
    ])("%s flags the bad snippet and passes the good one", (id, bad, good) => {
        expect(count(tsx(bad), id)).toBeGreaterThan(0);
        expect(count(tsx(good), id)).toBe(0);
    });

    it("SLOP-03 allows glass in one file but not two", () => {
        const one = { "client/src/A.tsx": "backdrop-blur-md" };
        expect(count(one, "SLOP-03")).toBe(0);
        expect(count({ ...one, "client/src/B.tsx": "backdrop-blur-sm" }, "SLOP-03")).toBe(2);
    });

    it("SLOP-04 and SLOP-05 scan the README too", () => {
        expect(count({ "README.md": "Unlock the power of OSINT 🚀" }, "SLOP-04")).toBe(1);
        expect(count({ "README.md": "Unlock the power of OSINT" }, "SLOP-05")).toBe(1);
        expect(count({ "README.md": "Look up an email address." }, "SLOP-05")).toBe(0);
    });

    it("token rules are n/a until tokens.css exists, then enforced", () => {
        const na = lintFiles({}).find((r) => r.id === "SLOP-17")!;
        expect(na.na).toMatch(/until P1/);
        const css = ":root { --color-accent: #0A66C2; --duration-fast: 100ms; --duration-base: 150ms; --duration-slow: 250ms; }";
        const results = lintFiles({ "client/src/styles/tokens.css": css });
        expect(results.find((r) => r.id === "SLOP-17")!.count).toBe(1); // 250ms > 200ms
        expect(results.find((r) => r.id === "SLOP-07")!.count).toBe(1); // accent defined once, not per theme
    });

    it("hex colours are allowed inside tokens.css only", () => {
        expect(count({ "client/src/styles/tokens.css": ":root { --color-bg: #FFFFFF; }" }, "SLOP-10")).toBe(0);
    });

    it("loads the real repository files", () => {
        const files = loadRepoFiles();
        expect(Object.keys(files)).toContain("client/src/App.tsx");
        expect(Object.keys(files)).toContain("tailwind.config.ts");
    });
});
