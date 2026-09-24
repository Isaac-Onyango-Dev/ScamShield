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

async function json<T>(res: Response): Promise<T> {
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
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

export interface StreamState {
    phase: "idle" | "connecting" | "streaming" | "done" | "error";
    target?: Target;
    planned: { id: string; name: string; category: CheckCategory }[];
    results: Record<string, CheckResult>;
    report?: LookupReport;
    error?: string;
}

type Action =
    | { type: "reset" }
    | { type: "event"; event: StreamEvent }
    | { type: "fail"; message: string };

const initial: StreamState = { phase: "idle", planned: [], results: {} };

function reducer(state: StreamState, action: Action): StreamState {
    switch (action.type) {
        case "reset":
            return { ...initial, phase: "connecting" };
        case "fail":
            return { ...state, phase: "error", error: action.message };
        case "event": {
            const e = action.event;
            if (e.type === "start") return { ...state, phase: "streaming", target: e.target, planned: e.checks };
            if (e.type === "check") return { ...state, results: { ...state.results, [e.result.id]: e.result } };
            if (e.type === "done") {
                const results = Object.fromEntries(e.report.checks.map((c) => [c.id, c]));
                return { ...state, phase: "done", report: e.report, target: e.report.target, results };
            }
            return { ...state, phase: "error", error: e.message };
        }
    }
}

/** Streams a lookup over Server-Sent Events so result cards appear as each source answers. */
export function useLookupStream(query: string | null, type?: TargetType) {
    const [state, dispatch] = useReducer(reducer, initial);
    const sourceRef = useRef<EventSource | null>(null);

    const start = useCallback(
        (fresh = false) => {
            sourceRef.current?.close();
            if (!query) return;
            const params = new URLSearchParams({ q: query });
            if (type) params.set("type", type);
            if (fresh) params.set("fresh", "1");
            const url = `/api/lookup/stream?${params}`;
            dispatch({ type: "reset" });

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
                if (finished) return;
                if (!received) {
                    // EventSource hides HTTP error bodies; fetch once to surface validation / rate-limit messages.
                    fetch(url)
                        .then(async (r) => {
                            const body = await r.json().catch(() => null);
                            dispatch({ type: "fail", message: body?.error ?? "Could not reach the lookup service." });
                        })
                        .catch(() => dispatch({ type: "fail", message: "Could not reach the lookup service." }));
                } else {
                    dispatch({ type: "fail", message: "Connection lost before the lookup finished. Try again." });
                }
            };
        },
        [query, type],
    );

    useEffect(() => {
        start();
        return () => sourceRef.current?.close();
    }, [start]);

    return { state, rerun: () => start(true) };
}
