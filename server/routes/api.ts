import express, { type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { REPORT_CATEGORIES, TARGET_TYPES, type SourceInfo, type StreamEvent } from "../../shared/types";
import type { AppConfig } from "../config";
import type { CheckDefinition } from "../engine/types";
import { InputError, type LookupService } from "../engine/lookup";
import { hashReporter, type CommunityService } from "../lib/community";
import type { ReportCache } from "../lib/reportCache";
import { errorMessage, logger } from "../logger";

export interface ApiDeps {
    config: AppConfig;
    lookup: LookupService;
    community: CommunityService;
    cache: ReportCache;
    checks: CheckDefinition[];
}

const lookupQuery = z.object({
    q: z.string().trim().min(1, "Query parameter q is required").max(4000),
    type: z.enum(TARGET_TYPES).optional(),
    fresh: z.enum(["1", "true"]).optional(),
});

const reportBody = z.object({
    query: z.string().trim().min(1).max(4000),
    type: z.enum(TARGET_TYPES).optional(),
    category: z.enum(REPORT_CATEGORIES),
    description: z.string().trim().max(1000).optional(),
});

function badRequest(res: Response, message: string) {
    res.status(400).json({ error: message });
}

export function createApiRouter(deps: ApiDeps) {
    const { config, lookup, community, cache } = deps;
    const router = express.Router();

    const lookupLimiter = rateLimit({
        windowMs: 60_000,
        limit: config.RATE_LIMIT_LOOKUPS_PER_MINUTE,
        standardHeaders: "draft-7",
        legacyHeaders: false,
        message: { error: "Too many lookups — please wait a minute and try again." },
    });
    const reportLimiter = rateLimit({
        windowMs: 60 * 60_000,
        limit: config.RATE_LIMIT_REPORTS_PER_HOUR,
        standardHeaders: "draft-7",
        legacyHeaders: false,
        message: { error: "Too many reports from this network — try again later." },
    });

    router.get("/health", (_req, res) => {
        res.json({ status: "ok", version: "2.0.0", timestamp: new Date().toISOString() });
    });

    router.get("/lookup", lookupLimiter, async (req: Request, res: Response) => {
        const parsed = lookupQuery.safeParse(req.query);
        if (!parsed.success) return badRequest(res, parsed.error.issues[0].message);
        try {
            const target = lookup.resolveTarget(parsed.data.q, parsed.data.type);
            const controller = new AbortController();
            res.on("close", () => !res.writableEnded && controller.abort());
            const report = await lookup.run(target, { signal: controller.signal, fresh: !!parsed.data.fresh });
            res.json(report);
        } catch (err) {
            if (err instanceof InputError) return badRequest(res, err.message);
            logger.error("lookup failed", { error: errorMessage(err) });
            res.status(500).json({ error: "Lookup failed" });
        }
    });

    // Server-Sent Events: each source result is pushed the moment it arrives.
    router.get("/lookup/stream", lookupLimiter, async (req: Request, res: Response) => {
        const parsed = lookupQuery.safeParse(req.query);
        if (!parsed.success) return badRequest(res, parsed.error.issues[0].message);
        let target;
        try {
            target = lookup.resolveTarget(parsed.data.q, parsed.data.type);
        } catch (err) {
            return badRequest(res, errorMessage(err));
        }

        res.writeHead(200, {
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-cache, no-transform",
            connection: "keep-alive",
            "x-accel-buffering": "no",
        });
        const send = (event: StreamEvent) => res.write(`data: ${JSON.stringify(event)}\n\n`);
        const heartbeat = setInterval(() => res.write(": ping\n\n"), 15_000);
        const controller = new AbortController();
        req.on("close", () => controller.abort());

        try {
            await lookup.run(target, { signal: controller.signal, onEvent: send, fresh: !!parsed.data.fresh });
        } catch (err) {
            logger.error("stream lookup failed", { error: errorMessage(err) });
            send({ type: "error", message: "Lookup failed" });
        } finally {
            clearInterval(heartbeat);
            res.end();
        }
    });

    router.post("/reports", reportLimiter, (req: Request, res: Response) => {
        const parsed = reportBody.safeParse(req.body);
        if (!parsed.success) return badRequest(res, parsed.error.issues[0].message);
        try {
            const target = lookup.resolveTarget(parsed.data.query, parsed.data.type);
            const result = community.submit({
                type: target.type,
                value: target.normalized,
                category: parsed.data.category,
                description: parsed.data.description || undefined,
                reporterHash: hashReporter(req.ip ?? "unknown", config.REPORTER_SALT),
            });
            cache.invalidate(target);
            res.status(result.duplicate ? 200 : 201).json({
                id: result.id,
                duplicate: result.duplicate,
                reportCount: result.count,
                message: result.duplicate ? "You've already reported this — thanks!" : "Report received. Thank you for protecting others.",
            });
        } catch (err) {
            if (err instanceof InputError) return badRequest(res, err.message);
            logger.error("report failed", { error: errorMessage(err) });
            res.status(500).json({ error: "Could not save report" });
        }
    });

    router.get("/stats", (_req, res) => {
        res.set("cache-control", "public, max-age=30");
        res.json(community.stats());
    });

    router.get("/sources", (_req, res) => {
        const sources: SourceInfo[] = deps.checks.map((c) => {
            const reason = c.disabledReason?.(config);
            return {
                id: c.id,
                name: c.name,
                category: c.category,
                appliesTo: c.appliesTo,
                enabled: !reason,
                reason,
                source: c.source,
            };
        });
        res.set("cache-control", "public, max-age=300");
        res.json({ sources, aiSummaries: !!config.OPENAI_API_KEY });
    });

    router.use((_req, res) => res.status(404).json({ error: "Not found" }));
    return router;
}
