import type { CheckResult, LookupReport, StreamEvent, Target, TargetType } from "../../shared/types";
import { parseTarget } from "../../shared/detect";
import type { AppConfig } from "../config";
import type { Fetcher } from "../lib/http";
import type { DnsClient } from "../lib/dns";
import type { CommunityStore } from "../lib/community";
import type { ReportCache } from "../lib/reportCache";
import type { CheckDefinition } from "./types";
import { applicableChecks, createMemo, runChecks } from "./runner";
import { computeVerdict } from "./scoring";
import type { Summarizer } from "./summary";
import { normalizePhone } from "../checks/phone";

export class InputError extends Error {}

interface LookupDeps {
    config: AppConfig;
    checks: CheckDefinition[];
    fetch: Fetcher;
    dns: DnsClient;
    community: CommunityStore;
    cache: ReportCache;
    summarize: Summarizer;
    onLookup?: () => void;
}

const CATEGORY_ORDER = ["community", "reputation", "content", "identity", "exposure", "infrastructure", "pivots"];

export function createLookupService(deps: LookupDeps) {
    const { config } = deps;

    function resolveTarget(input: string, type?: TargetType): Target {
        const parsed = parseTarget(input, type);
        if (!parsed.ok) throw new InputError(parsed.error);
        const target = parsed.target;
        if (target.type === "phone") target.normalized = normalizePhone(target.input, config.DEFAULT_PHONE_REGION);
        return target;
    }

    async function run(target: Target, opts: { signal?: AbortSignal; onEvent?: (e: StreamEvent) => void; fresh?: boolean } = {}) {
        const emit = opts.onEvent ?? (() => undefined);
        const checks = applicableChecks(deps.checks, target);
        emit({ type: "start", target, checks: checks.map((c) => ({ id: c.id, name: c.name, category: c.category })) });

        const cached = opts.fresh ? null : deps.cache.get(target);
        if (cached) {
            const report: LookupReport = { ...cached, cached: true };
            for (const result of report.checks) emit({ type: "check", result });
            emit({ type: "done", report });
            return report;
        }

        deps.onLookup?.();
        const started = performance.now();
        const results: CheckResult[] = await runChecks(
            checks,
            {
                target,
                signal: opts.signal ?? new AbortController().signal,
                config,
                fetch: deps.fetch,
                dns: deps.dns,
                community: deps.community,
                memo: createMemo(),
            },
            config,
            (result) => emit({ type: "check", result }),
        );
        results.sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category));

        const verdict = computeVerdict(results);
        const summary = await deps.summarize(target, verdict, results);
        const report: LookupReport = {
            target,
            verdict,
            checks: results,
            summary,
            generatedAt: new Date().toISOString(),
            cached: false,
            durationMs: Math.round(performance.now() - started),
        };

        // Don't pin a mostly-failed lookup in the cache.
        if (!opts.signal?.aborted && verdict.confidence >= 0.5) deps.cache.set(target, report, config.LOOKUP_CACHE_TTL_MINUTES);
        emit({ type: "done", report });
        return report;
    }

    return { resolveTarget, run };
}

export type LookupService = ReturnType<typeof createLookupService>;
