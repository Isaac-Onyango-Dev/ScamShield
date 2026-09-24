import type { CheckCategory, CheckResult } from "@shared/types";
import { cn } from "@/lib/cn";
import { matchesFilter, statusPresentation, type FindingFilter } from "@/lib/status";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Skeleton } from "@/components/ui/Skeleton";

export interface PlannedSource {
    id: string;
    name: string;
    category: CheckCategory;
    result?: CheckResult;
}

const FILTERS: { value: FindingFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "flags", label: "Flags" },
    { value: "clean", label: "Clean" },
    { value: "unavailable", label: "Unavailable" },
];

/** Segmented filter built from native radios, so arrow keys work without extra code. */
export function FindingsFilter({ sources, value, onChange }: { sources: PlannedSource[]; value: FindingFilter; onChange: (f: FindingFilter) => void }) {
    return (
        <div role="radiogroup" aria-label="Filter findings" className="inline-flex flex-wrap gap-1 rounded-md bg-surface-2 p-1">
            {FILTERS.map((f) => {
                const count = sources.filter((s) => matchesFilter(s.result?.status, f.value)).length;
                const checked = value === f.value;
                return (
                    <label
                        key={f.value}
                        className={cn(
                            "cursor-pointer rounded-sm px-3 py-1 text-footnote transition-colors duration-fast has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus",
                            checked ? "bg-surface font-semibold text-fg shadow-overlay" : "text-fg-secondary hover:text-fg",
                        )}
                    >
                        <input type="radio" name="findings-filter" value={f.value} checked={checked} onChange={() => onChange(f.value)} className="sr-only" />
                        {f.label} <span className="tabular text-fg-tertiary">{count}</span>
                    </label>
                );
            })}
        </div>
    );
}

/** Scannable overview of every source: status, finding and timing, each row linking to its card. */
export function FindingsTable({ sources, filter }: { sources: PlannedSource[]; filter: FindingFilter }) {
    const rows = sources.filter((s) => matchesFilter(s.result?.status, filter) || (filter === "all" && !s.result));
    return (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full border-collapse text-left text-footnote">
                <caption className="sr-only">Findings by source</caption>
                <thead className="text-caption text-fg-tertiary">
                    <tr className="border-b border-line">
                        <th scope="col" className="px-4 py-2 font-medium">Status</th>
                        <th scope="col" className="px-4 py-2 font-medium">Source</th>
                        <th scope="col" className="hidden px-4 py-2 font-medium sm:table-cell">Finding</th>
                        <th scope="col" className="px-4 py-2 text-right font-medium">Time</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((s) => (
                        <tr key={s.id} data-testid="finding-row" className="border-b border-line last:border-b-0">
                            <td className="px-4 py-2 align-top">
                                {s.result ? <StatusBadge presentation={statusPresentation(s.result)} value={s.result.status} /> : <span className="text-caption text-fg-tertiary">Waiting</span>}
                            </td>
                            <td className="px-4 py-2 align-top">
                                <a href={`#source-${s.id}`} className="font-medium text-fg hover:underline">
                                    {s.name}
                                </a>
                            </td>
                            <td className="hidden px-4 py-2 align-top text-fg-secondary sm:table-cell">{s.result ? s.result.summary : <Skeleton className="w-3/4" />}</td>
                            <td className="tabular whitespace-nowrap px-4 py-2 text-right align-top text-caption text-fg-tertiary">{s.result && s.result.durationMs > 0 ? `${s.result.durationMs} ms` : ""}</td>
                        </tr>
                    ))}
                    {rows.length === 0 && (
                        <tr>
                            <td colSpan={4} className="px-4 py-6 text-center text-fg-secondary">
                                No sources match this filter.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
