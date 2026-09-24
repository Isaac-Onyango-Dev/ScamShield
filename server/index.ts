import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import { config } from "./config";
import { logger, errorMessage } from "./logger";
import { openDatabase, runMigrations } from "./lib/db";
import { createDnsClient } from "./lib/dns";
import { createCommunityStore } from "./lib/community";
import { createReportCache } from "./lib/reportCache";
import { createLookupService } from "./engine/lookup";
import { createSummarizer } from "./engine/summary";
import { ALL_CHECKS } from "./checks";
import { createApp } from "./app";
import { seed } from "./seed";

const here = path.dirname(fileURLToPath(import.meta.url));
// Serve the built client whenever we're running from the bundle (dist/), even if the
// host's start command forgot NODE_ENV=production (e.g. a bare `node dist/index.js`).
const bundledClient = fs.existsSync(path.join(here, "public", "index.html"));
const isProd = config.NODE_ENV === "production" || bundledClient;
// Bundled server lives in dist/ next to dist/migrations and dist/public.
const migrationsFolder = fs.existsSync(path.join(here, "migrations")) ? path.join(here, "migrations") : path.join(here, "../migrations");

const { db, sqlite } = openDatabase(config.DATABASE_URL);
runMigrations(db, migrationsFolder);
seed(db);

const community = createCommunityStore(db);
const cache = createReportCache(db);
const lookup = createLookupService({
    config,
    checks: ALL_CHECKS,
    fetch: globalThis.fetch,
    dns: createDnsClient(config.DNS_SERVERS),
    community,
    cache,
    summarize: createSummarizer(config),
    onLookup: () => community.bumpStat("total_lookups"),
});

const app = createApp({ config, lookup, community, cache, checks: ALL_CHECKS });

if (isProd) {
    const clientDir = path.join(here, "public");
    app.use(express.static(clientDir, { index: false, maxAge: "1h", setHeaders: (res, file) => {
        if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader("cache-control", "public, max-age=31536000, immutable");
    } }));
    app.get("*", (_req, res) => res.sendFile(path.join(clientDir, "index.html")));
} else {
    // Dev: Vite middleware gives HMR on the same port as the API.
    const { createServer } = await import("vite");
    const vite = await createServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
}

const server = app.listen(config.PORT, () => {
    logger.info(`ScamShield listening on http://localhost:${config.PORT}`, { env: config.NODE_ENV });
    const off = ALL_CHECKS.filter((c) => c.disabledReason?.(config)).map((c) => c.id);
    if (off.length) logger.info("optional sources disabled (no API key)", { sources: off });
});

const purge = setInterval(() => {
    try {
        const n = cache.purgeExpired();
        if (n) logger.debug("purged expired lookups", { count: n });
    } catch (err) {
        logger.warn("cache purge failed", { error: errorMessage(err) });
    }
}, 15 * 60_000);
purge.unref();

function shutdown(signal: string) {
    logger.info(`${signal} received, shutting down`);
    server.close(() => {
        sqlite.close();
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
