import type { StreamState } from "@/lib/api";
import { Spinner } from "@/components/ui/Spinner";

/**
 * The single live region of the results page: it announces phase changes only
 * ("Starting lookup…", "Looking up… 12 of 22 sources", "Done. Score 98, Dangerous.")
 * instead of re-reading the verdict on every streamed source (audit #8).
 */
export function LookupStatus({ state, answered, total }: { state: StreamState; answered: number; total: number }) {
    const running = state.phase === "connecting" || state.phase === "streaming";
    const verdict = state.report?.verdict;
    let text = "";
    if (state.phase === "connecting") text = state.refreshing ? "Refreshing…" : "Starting lookup…";
    else if (state.phase === "streaming") text = `Looking up… ${answered} of ${total} sources`;
    else if (state.phase === "done" && verdict) text = verdict.confidence === 0 ? "Done. Not enough data for a score." : `Done. Score ${verdict.score}, ${verdict.label}.`;

    return (
        <div className="flex flex-col gap-2">
            <div className="flex min-h-6 items-center gap-2">
                {running && <Spinner />}
                <p role="status" aria-live="polite" className="text-footnote text-fg-secondary">
                    {text}
                </p>
            </div>
            {state.phase === "streaming" && total > 0 && (
                <div
                    role="progressbar"
                    aria-label="Sources answered"
                    aria-valuemin={0}
                    aria-valuemax={total}
                    aria-valuenow={answered}
                    className="h-1 overflow-hidden rounded-full bg-surface-2"
                >
                    <div className="h-full rounded-full bg-accent transition-[width] duration-base" style={{ width: `${(answered / total) * 100}%` }} />
                </div>
            )}
        </div>
    );
}
