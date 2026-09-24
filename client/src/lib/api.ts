import { useCallback, useEffect, useReducer, useRef } from "react";
import type {
    CheckCategory,
    CheckResult,
    DashboardStats,
    LookupReport,
    ReportCategory,
    SourceInfo,
    StreamEvent,
    Target,
    TargetType,
} from "@shared/types";

/** An API failure with its HTTP status, so the UI can design each case (400, 429, 5xx…). */
export class ApiError extends Error {
    constructor(
        readonly status: number,
        message: string,
        readonly retryAfter?: number,
    ) {
        super(message);
    }
}

/** Seconds until a rate limit resets: Retry-After, then the draft-7 `RateLimit: …, reset=N`, then 60. */
export function retryAfterSeconds(headers: Headers): number {
    const retryAfter = headers.get("retry-after");
    if (retryAfter) {
        const seconds = Number(retryAfter);
        if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
        const date = Date.parse(retryAfter);
        if (!Number.isNaN(date)) return Math.max(1, Math.ceil((date - Date.now()) / 1000));
    }
    const reset = /reset=(\d+)/.exec(headers.get("ratelimit") ?? "");
    if (reset) return Math.max(1, Number(reset[1]));
    return 60;
}

async function json<T>(res: Response): Promise<T> {
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
        const message = (body as { error?: string; message?: string }).error ?? (body as { message?: string }).message ?? `Request failed (${res.status})`;
        throw new ApiError(res.status, message, res.status === 429 ? retryAfterSeconds(res.headers) : undefined);
    }
    return body as T;
}

export const fetchStats = () => fetch("/api/stats").then((r) => json<DashboardStats>(r));
export const fetchSources = () => fetch("/api/sources").then((r) => json<{ sources: SourceInfo[]; aiSummaries: boolean }>(r));

export function submitReport(body: { query: string; type?: TargetType; category: ReportCategory; description?: string }) {
    return fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    }).then((r) => json<{ duplicate: boolean; reportCount: number; message: string }>(r));
}

export type LookupError =
    | { kind: "invalid"; message: string }
    | { kind: "rate-limited"; message: string; retryAfter: number }
    | { kind: "network"; message: string }
    | { kind: "server"; message: string };

export interface StreamState {
    phase: "idle" | "connecting" | "streaming" | "done" | "error";
    target?: Target;
    planned: { id: string; name: string; category: CheckCategory }[];
    results: Record<string, CheckResult>;
    report?: LookupReport;
    error?: LookupError;
    /** Re-running an existing lookup: the previous results stay on screen until new ones arrive. */
    refreshing: boolean;
}

type Action =
    | { type: "reset"; keep: boolean }
    | { type: "event"; event: StreamEvent }
    | { type: "fail"; error: LookupError };

const initial: StreamState = { phase: "idle", planned: [], results: {}, refreshing: false };

function reducer(state: StreamState, action: Action): StreamState {
    switch (action.type) {
        case "reset":
            // Keeping target/planned/results/report means a refresh never blanks the page (audit #31).
            return action.keep && state.target ? { ...state, phase: "connecting", error: undefined, refreshing: true } : { ...initial, phase: "connecting" };
        case "fail":
            return { ...state, phase: "error", error: action.error, refreshing: false };
        case "event": {
            const e = action.event;
            if (e.type === "start") return { ...state, phase: "streaming", target: e.target, planned: e.checks, results: {}, report: undefined, refreshing: false };
            if (e.type === "check") return { ...state, results: { ...state.results, [e.result.id]: e.result } };
            if (e.type === "done") {
                const results = Object.fromEntries(e.report.checks.map((c) => [c.id, c]));
                return { ...state, phase: "done", report: e.report, target: e.report.target, results, refreshing: false };
            }
            return { ...state, phase: "error", error: { kind: "server", message: e.message }, refreshing: false };
        }
    }
}

const NETWORK: LookupError = { kind: "network", message: "Couldn't reach the lookup service. Check your connection and try again." };
const DROPPED: LookupError = { kind: "network", message: "Connection lost before the lookup finished." };

/**
 * EventSource hides HTTP error responses, so after a failed connection we ask once more with
 * fetch to learn *why*. That request is aborted as soon as its headers arrive when it turns
 * out to be a healthy stream, and only non-OK bodies are parsed (audit #11).
 */
async function diagnose(url: string): Promise<LookupError> {
    const controller = new AbortController();
    try {
        const res = await fetch(url, { signal: controller.signal, headers: { accept: "application/json" } });
        if (res.ok) {
            controller.abort();
            return DROPPED;
        }
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        const message = body?.error ?? `The lookup service answered ${res.status}.`;
        if (res.status === 400) return { kind: "invalid", message };
        if (res.status === 429) return { kind: "rate-limited", message, retryAfter: retryAfterSeconds(res.headers) };
        return { kind: "server", message };
    } catch {
        return NETWORK;
    }
}

/** Streams a lookup over Server-Sent Events so result cards appear as each source answers. */
export function useLookupStream(query: string | null, type?: TargetType) {
    const [state, dispatch] = useReducer(reducer, initial);
    const sourceRef = useRef<EventSource | null>(null);

    const start = useCallback(
        (opts: { fresh?: boolean; keep?: boolean } = {}) => {
            sourceRef.current?.close();
            if (!query) return;
            const params = new URLSearchParams({ q: query });
            if (type) params.set("type", type);
            if (opts.fresh) params.set("fresh", "1");
            const url = `/api/lookup/stream?${params}`;
            dispatch({ type: "reset", keep: !!opts.keep });

            const es = new EventSource(url);
            sourceRef.current = es;
            let received = false;
            let finished = false;
            es.onmessage = (msg) => {
                received = true;
                const event = JSON.parse(msg.data) as StreamEvent;
                dispatch({ type: "event", event });
                if (event.type === "done" || event.type === "error") {
                    finished = true;
                    es.close();
                }
            };
            es.onerror = () => {
                es.close();
                if (finished || sourceRef.current !== es) return;
                if (received) dispatch({ type: "fail", error: DROPPED });
                else void diagnose(url).then((error) => sourceRef.current === es && dispatch({ type: "fail", error }));
            };
        },
        [query, type],
    );

    useEffect(() => {
        start();
        return () => {
            const es = sourceRef.current;
            sourceRef.current = null;
            es?.close();
        };
    }, [start]);

    return {
        state,
        /** Bypass the cache and query every source again, keeping current results visible. */
        refresh: () => start({ fresh: true, keep: true }),
        /** Try the same lookup again after an error. */
        retry: () => start({ keep: true }),
    };
}
