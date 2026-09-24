import type { CheckResult, Target } from "../../shared/types";
import type { CheckContext, CheckDefinition } from "./types";
import type { AppConfig } from "../config";
import { errorMessage } from "../logger";

export function applicableChecks(checks: CheckDefinition[], target: Target): CheckDefinition[] {
    return checks.filter((c) => c.appliesTo.includes(target.type) && (c.supports?.(target) ?? true));
}

function base(check: CheckDefinition) {
    return { id: check.id, name: check.name, category: check.category, source: check.source };
}

export function skippedResult(check: CheckDefinition, reason: string): CheckResult {
    return { ...base(check), status: "skipped", summary: reason, facts: [], signals: [], durationMs: 0 };
}

class TimeoutError extends Error {}

async function runOne(check: CheckDefinition, ctx: CheckContext, config: AppConfig): Promise<CheckResult> {
    const disabled = check.disabledReason?.(config);
    if (disabled) return skippedResult(check, disabled);

    const started = performance.now();
    const timeoutMs = check.timeoutMs ?? config.CHECK_TIMEOUT_MS;
    const controller = new AbortController();
    const signal = AbortSignal.any([ctx.signal, controller.signal]);
    let timer: NodeJS.Timeout | undefined;
    try {
        const output = await Promise.race([
            check.run({ ...ctx, signal }),
            new Promise<never>((_, reject) => {
                timer = setTimeout(() => {
                    // Reject first so the timeout (not the check's own abort error) wins the race.
                    reject(new TimeoutError(`Timed out after ${(timeoutMs / 1000).toFixed(timeoutMs < 1000 ? 1 : 0)}s`));
                    controller.abort();
                }, timeoutMs);
            }),
        ]);
        return {
            ...base(check),
            status: output.status,
            summary: output.summary,
            facts: output.facts ?? [],
            items: output.items,
            signals: output.signals ?? [],
            durationMs: Math.round(performance.now() - started),
        };
    } catch (err) {
        return {
            ...base(check),
            status: "error",
            summary: "Source unavailable",
            error: errorMessage(err),
            facts: [],
            signals: [],
            durationMs: Math.round(performance.now() - started),
        };
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Runs every check concurrently. Individual failures never fail the lookup;
 * `onResult` fires as each source answers so the UI can stream progress.
 */
export async function runChecks(
    checks: CheckDefinition[],
    ctx: CheckContext,
    config: AppConfig,
    onResult?: (result: CheckResult) => void,
): Promise<CheckResult[]> {
    const results = await Promise.all(
        checks.map(async (check) => {
            const result = await runOne(check, ctx, config);
            onResult?.(result);
            return result;
        }),
    );
    return results;
}

export function createMemo() {
    const cache = new Map<string, Promise<unknown>>();
    return function memo<T>(key: string, fn: () => Promise<T>): Promise<T> {
        let hit = cache.get(key) as Promise<T> | undefined;
        if (!hit) {
            hit = fn();
            cache.set(key, hit);
            // Don't memoize failures: a later caller may succeed.
            hit.catch(() => cache.delete(key));
        }
        return hit;
    };
}
