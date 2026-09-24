import type { LookupReport, StreamEvent } from "../../../shared/types";

/** Serializes events exactly like server/routes/api.ts does for /api/lookup/stream. */
export function sse(events: StreamEvent[]): string {
    return events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
}

function start(report: LookupReport): StreamEvent {
    return { type: "start", target: report.target, checks: report.checks.map(({ id, name, category }) => ({ id, name, category })) };
}

/** start → one check per source → done. */
export function fullStream(report: LookupReport): string {
    return sse([start(report), ...report.checks.map((result): StreamEvent => ({ type: "check", result })), { type: "done", report }]);
}

/** start → only the listed sources answer; the stream then ends without `done` (sources still pending). */
export function partialStream(report: LookupReport, answeredIds: string[]): string {
    const answered = report.checks.filter((c) => answeredIds.includes(c.id));
    return sse([start(report), ...answered.map((result): StreamEvent => ({ type: "check", result }))]);
}
