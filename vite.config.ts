import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { renderIndexHtml, resolveSiteUrl, storageModeFrom } from "./server/lib/siteUrl";

/**
 * Dev-server counterpart of the production <head> injection in server/index.ts: fills the
 * %SITE_URL% / %PATH% / %STORAGE_MODE% placeholders with the same resolver (serve only; the
 * production build keeps the placeholders so the server can fill them at runtime).
 */
function siteUrlPlugin(): Plugin {
    return {
        name: "scamshield-site-url",
        apply: "serve",
        transformIndexHtml(html, ctx) {
            const siteUrl = resolveSiteUrl({
                SITE_URL: process.env.SITE_URL,
                RENDER_EXTERNAL_URL: process.env.RENDER_EXTERNAL_URL,
                NODE_ENV: process.env.NODE_ENV ?? "development",
                PORT: Number(process.env.PORT ?? 5000),
            });
            const persistent = ["1", "true", "yes"].includes((process.env.STORAGE_PERSISTENT ?? "").toLowerCase());
            return renderIndexHtml(html, { siteUrl, path: ctx.path, storageMode: storageModeFrom(persistent) });
        },
    };
}

/**
 * Build-only: Vite resolves <link href> / og:image URLs as assets and chokes on "%" placeholders.
 * Swap them for an inert external URL (which Vite leaves alone) before its HTML processing and
 * restore them afterwards, so dist/public/index.html keeps %SITE_URL%/%PATH% for the server.
 */
function keepPlaceholders(): Plugin {
    const SITE = "https://scamshield-site-url.invalid";
    const PATH = "/__scamshield_path__";
    return {
        name: "scamshield-keep-placeholders",
        apply: "build",
        transformIndexHtml: {
            order: "pre",
            handler: (html) => html.replaceAll("%SITE_URL%%PATH%", SITE + PATH).replaceAll("%SITE_URL%", SITE),
        },
    };
}

/** Runs after Vite's asset processing and restores the runtime placeholders. */
function restorePlaceholders(): Plugin {
    const SITE = "https://scamshield-site-url.invalid";
    const PATH = "/__scamshield_path__";
    return {
        name: "scamshield-restore-placeholders",
        apply: "build",
        transformIndexHtml: {
            order: "post",
            handler: (html) => html.replaceAll(SITE + PATH, "%SITE_URL%%PATH%").replaceAll(SITE, "%SITE_URL%"),
        },
    };
}

export default defineConfig({
    plugins: [react(), siteUrlPlugin(), keepPlaceholders(), restorePlaceholders()],
    resolve: {
        alias: {
            "@": path.resolve(import.meta.dirname, "client", "src"),
            "@shared": path.resolve(import.meta.dirname, "shared"),
        },
    },
    root: path.resolve(import.meta.dirname, "client"),
    build: {
        outDir: path.resolve(import.meta.dirname, "dist/public"),
        emptyOutDir: true,
        sourcemap: false,
    },
    server: {
        fs: { strict: true, deny: ["**/.*"] },
    },
});
