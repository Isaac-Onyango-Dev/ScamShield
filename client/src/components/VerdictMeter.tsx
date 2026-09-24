import { useId } from "react";
import type { RiskLevel } from "@shared/types";
import { cn } from "@/lib/cn";
import { LEVELS } from "@/lib/status";
import { StatusBadge } from "@/components/ui/StatusBadge";

const FILL = { neutral: "bg-fg-tertiary", accent: "bg-accent", success: "bg-success", warning: "bg-warning", danger: "bg-danger" } as const;

/**
 * Risk score as a number, a written level and a linear meter (decision D5). The number and
 * label are always visible next to the bar, so colour is never the only signal.
 */
export function VerdictMeter({ score, level, label }: { score: number | null; level: RiskLevel; label: string }) {
    const labelId = useId();
    const p = LEVELS[level];
    const pending = score === null;
    return (
        <div data-testid="verdict-meter" aria-busy={pending} className="flex flex-col gap-3">
            <p id={labelId} className="text-footnote font-semibold text-fg-secondary">
                Risk score
            </p>
            <div className="flex items-end justify-between gap-3">
                <p className="flex items-baseline gap-1">
                    <span className="tabular text-display font-bold text-fg">{pending ? "—" : score}</span>
                    <span className="text-caption text-fg-tertiary">/100</span>
                </p>
                {pending ? (
                    <span className="text-footnote text-fg-secondary">Scoring…</span>
                ) : (
                    <StatusBadge presentation={{ ...p, label }} kind="level" value={level} className="mb-2" />
                )}
            </div>
            {pending ? (
                // A meter must carry a value (ARIA), so while scoring there is only an empty track.
                <div aria-hidden className="h-2 rounded-full bg-surface-2" />
            ) : (
                <div
                    role="meter"
                    aria-labelledby={labelId}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={score}
                    aria-valuetext={`${score} out of 100, ${label}`}
                    className="h-2 overflow-hidden rounded-full bg-surface-2"
                >
                    <div className={cn("h-full rounded-full transition-[width] duration-slow", FILL[p.tone])} style={{ width: `${score}%` }} />
                </div>
            )}
        </div>
    );
}
