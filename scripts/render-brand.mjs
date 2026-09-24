#!/usr/bin/env node
// Rasterises the brand masters with Playwright's Chromium (already a devDependency):
//   client/public/favicon-32.png      32×32, from favicon.svg (light variant)
//   client/public/apple-touch-icon.png 180×180, opaque, full-bleed tile (iOS rounds it)
//   client/public/og.png              1200×630 social card: mark + wordmark in Inter
// Run after changing docs/brand/*.svg or client/public/favicon.svg: `npm run brand:render`.
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const root = process.cwd();
const pub = path.join(root, "client/public");
const favicon = await readFile(path.join(pub, "favicon.svg"), "utf8");
const regular = await readFile(path.join(root, "docs/brand/mark-regular.svg"), "utf8");
const inter = pathToFileURL(path.join(pub, "fonts/inter-latin-wght-5.3.0.woff2")).href;

const LIGHT = { bg: "#F5F5F7", text: "#1D1D1F", secondary: "#4A4A4F", accent: "#0A66C2" };
const page = (body, size) => `<!doctype html><html><head><style>
@font-face { font-family: "Inter Variable"; src: url("${inter}") format("woff2"); font-weight: 100 900; }
html, body { margin: 0; width: ${size[0]}px; height: ${size[1]}px; overflow: hidden; }
body { font-family: "Inter Variable", sans-serif; -webkit-font-smoothing: antialiased; }
svg { display: block; }
</style></head><body>${body}</body></html>`;

// Full-bleed opaque tile for iOS; the mark sits in the central ~70%.
const touch = favicon.replace(/<rect class="t" width="32" height="32" rx="7"\/>/, '<rect class="t" width="32" height="32"/>');

const og = `<div style="box-sizing:border-box;width:1200px;height:630px;background:${LIGHT.bg};padding:96px;display:flex;flex-direction:column;justify-content:space-between">
  <div style="display:flex;align-items:center;gap:28px;color:${LIGHT.text}">
    <div style="width:112px;height:112px;color:${LIGHT.accent}">${regular.replace("<svg ", '<svg width="112" height="112" ')}</div>
    <div style="font-size:88px;font-weight:650;letter-spacing:-0.02em">ScamShield</div>
  </div>
  <div style="font-size:44px;line-height:1.3;font-weight:450;color:${LIGHT.secondary};max-width:900px">Scam and OSINT lookups from public sources, with an explained risk score.</div>
</div>`;

const dir = await mkdtemp(path.join(tmpdir(), "scamshield-brand-"));
const browser = await chromium.launch();
try {
    const jobs = [
        { out: "favicon-32.png", html: page(favicon.replace("<svg ", '<svg width="32" height="32" '), [32, 32]), size: [32, 32], transparent: true },
        { out: "apple-touch-icon.png", html: page(touch.replace("<svg ", '<svg width="180" height="180" '), [180, 180]), size: [180, 180] },
        { out: "og.png", html: page(og, [1200, 630]), size: [1200, 630] },
    ];
    for (const job of jobs) {
        const file = path.join(dir, `${job.out}.html`);
        await writeFile(file, job.html);
        const p = await browser.newPage({ viewport: { width: job.size[0], height: job.size[1] }, deviceScaleFactor: 1, colorScheme: "light" });
        await p.goto(pathToFileURL(file).href);
        await p.evaluate(() => document.fonts.ready);
        await p.screenshot({ path: path.join(pub, job.out), omitBackground: !!job.transparent });
        await p.close();
        console.log(`client/public/${job.out} (${job.size.join("×")})`);
    }
} finally {
    await browser.close();
    await rm(dir, { recursive: true, force: true });
}
