import { describe, expect, it } from "vitest";
import { loadConfig } from "../server/config";
import { SITE_URL_REQUIRED, escapeAttr, renderIndexHtml, resolveSiteUrl, storageModeFrom } from "../server/lib/siteUrl";

const prod = { NODE_ENV: "production", PORT: 5000 };
const dev = { NODE_ENV: "development", PORT: 5000 };

describe("resolveSiteUrl", () => {
    it("prefers SITE_URL over RENDER_EXTERNAL_URL", () => {
        expect(resolveSiteUrl({ ...prod, SITE_URL: "https://a.example", RENDER_EXTERNAL_URL: "https://b.onrender.com" })).toBe("https://a.example");
    });

    it("falls back to RENDER_EXTERNAL_URL", () => {
        expect(resolveSiteUrl({ ...prod, RENDER_EXTERNAL_URL: "https://scamshield.onrender.com" })).toBe("https://scamshield.onrender.com");
    });

    it("strips a trailing slash", () => {
        expect(resolveSiteUrl({ ...prod, SITE_URL: "https://a.example/" })).toBe("https://a.example");
    });

    it.each(["scamshield.example", "/relative", "ftp://a.example", "https://a.example/app", "https://a.example/?x=1", "https://user:pw@a.example"])("rejects %s", (value) => {
        expect(() => resolveSiteUrl({ ...prod, SITE_URL: value })).toThrow(/SITE_URL/);
    });

    it("rejects http in production but allows it in development", () => {
        expect(() => resolveSiteUrl({ ...prod, SITE_URL: "http://a.example" })).toThrow(/https/);
        expect(resolveSiteUrl({ ...dev, SITE_URL: "http://localhost:5173" })).toBe("http://localhost:5173");
    });

    it("fails with a clear message in production when nothing is set", () => {
        expect(() => resolveSiteUrl(prod)).toThrow(SITE_URL_REQUIRED);
        expect(SITE_URL_REQUIRED).toMatch(/^SITE_URL is required in production/);
        expect(SITE_URL_REQUIRED).toMatch(/RENDER_EXTERNAL_URL/);
    });

    it("falls back to localhost outside production", () => {
        expect(resolveSiteUrl({ ...dev, PORT: 5173 })).toBe("http://localhost:5173");
        expect(resolveSiteUrl({ NODE_ENV: "test", PORT: 5000 })).toBe("http://localhost:5000");
    });
});

describe("loadConfig", () => {
    it("exposes the resolved SITE_URL", () => {
        const c = loadConfig({ NODE_ENV: "production", SITE_URL: "https://a.example/", DATABASE_URL: ":memory:" } as NodeJS.ProcessEnv);
        expect(c.SITE_URL).toBe("https://a.example");
    });

    it("throws an Invalid configuration error in production without a site URL", () => {
        expect(() => loadConfig({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toThrow(/Invalid configuration: SITE_URL is required in production/);
    });

    it.each([
        [undefined, false],
        ["", false],
        ["false", false],
        ["true", true],
        ["1", true],
    ])("STORAGE_PERSISTENT=%s → %s (storageMode)", (value, expected) => {
        const c = loadConfig({ NODE_ENV: "test", STORAGE_PERSISTENT: value } as NodeJS.ProcessEnv);
        expect(c.STORAGE_PERSISTENT).toBe(expected);
        expect(storageModeFrom(c.STORAGE_PERSISTENT)).toBe(expected ? "persistent" : "ephemeral");
    });
});

describe("renderIndexHtml", () => {
    const template = '<link rel="canonical" href="%SITE_URL%%PATH%"><meta property="og:image" content="%SITE_URL%/og.png"><meta name="scamshield-storage" content="%STORAGE_MODE%">';

    it("fills every placeholder and never includes the query string", () => {
        const html = renderIndexHtml(template, { siteUrl: "https://a.example", path: "/search?q=a%40b.com", storageMode: "ephemeral" });
        expect(html).toBe('<link rel="canonical" href="https://a.example/search"><meta property="og:image" content="https://a.example/og.png"><meta name="scamshield-storage" content="ephemeral">');
    });

    it("escapes attribute-breaking characters", () => {
        expect(escapeAttr(`"<>&'`)).toBe("&quot;&lt;&gt;&amp;&#39;");
        const html = renderIndexHtml(template, { siteUrl: "https://a.example", path: '/x"><script>', storageMode: "persistent" });
        expect(html).not.toContain("<script>");
        expect(html).toContain('content="persistent"');
    });
});
