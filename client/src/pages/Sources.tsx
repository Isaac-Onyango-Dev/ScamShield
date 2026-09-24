import { useQuery } from "@tanstack/react-query";
import { TYPE_LABELS } from "@shared/detect";
import type { SourceInfo } from "@shared/types";
import { fetchSources } from "@/lib/api";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/categories";
import { STATUSES } from "@/lib/status";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { SourceLink } from "@/components/ui/SourceLink";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";

/** "Requires HIBP_API_KEY" → "Needs API key: HIBP_API_KEY", keeping any extra guidance. */
function disabledText(reason?: string): { title: string; detail?: string } {
    const m = /Requires ([A-Z0-9_]+)\s*(.*)$/.exec(reason ?? "");
    if (m) return { title: `Needs API key: ${m[1]}`, detail: m[2]?.replace(/^\(|\)$/g, "") || undefined };
    return { title: reason ?? "Not configured" };
}

function SourceRow({ s }: { s: SourceInfo }) {
    const off = disabledText(s.reason);
    return (
        <tr data-testid="source-row" className="border-t border-line align-top">
            <th scope="row" className="py-3 pr-4 text-left font-normal">
                <p className="font-semibold text-fg">{s.name}</p>
                <SourceLink source={s.source} />
            </th>
            <td className="py-3 pr-4">
                <div className="flex flex-wrap gap-1">
                    {s.appliesTo.map((t) => (
                        <Badge key={t}>{TYPE_LABELS[t]}</Badge>
                    ))}
                </div>
            </td>
            <td className="py-3">
                {s.enabled ? (
                    <StatusBadge presentation={{ ...STATUSES.clean, label: "Active" }} value="active" />
                ) : (
                    <div className="flex flex-col items-start gap-1">
                        <StatusBadge presentation={{ ...STATUSES.skipped, label: off.title }} value="needs-key" />
                        {off.detail && <p className="text-caption text-fg-tertiary">{off.detail}</p>}
                    </div>
                )}
            </td>
        </tr>
    );
}

export function SourcesPage() {
    const { data, isLoading, isError, error, refetch, isFetching } = useQuery({ queryKey: ["sources"], queryFn: fetchSources });
    const groups = CATEGORY_ORDER.map((category) => ({ category, sources: data?.sources.filter((s) => s.category === category) ?? [] })).filter((g) => g.sources.length);

    return (
        <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-12 sm:px-6">
            <div className="flex flex-col gap-3">
                <h1 className="text-title-2 font-bold tracking-tight text-fg">Sources</h1>
                <p className="text-body text-fg-secondary">
                    Every lookup is answered by these modules. Optional sources turn on when the operator sets an API key. ScamShield only reads public data: it never sends email, calls numbers or logs into accounts.
                </p>
                {data && (
                    <InlineAlert tone="info">
                        {data.aiSummaries ? "Summaries are written by AI. Scores are always rule-based." : "Summaries are generated from rules. Scores are always rule-based."}
                    </InlineAlert>
                )}
            </div>

            {isLoading && (
                <div className="flex flex-col gap-4" aria-label="Loading sources">
                    {Array.from({ length: 6 }, (_, i) => (
                        <Skeleton key={i} className="h-8 w-full" />
                    ))}
                </div>
            )}

            {isError && (
                <InlineAlert
                    tone="danger"
                    title="Couldn't load the source list."
                    action={
                        <Button size="sm" onClick={() => refetch()} disabled={isFetching}>
                            Retry
                        </Button>
                    }
                >
                    {(error as Error).message}
                </InlineAlert>
            )}

            {data && data.sources.length === 0 && <EmptyState title="No sources configured." />}

            {groups.map((g) => (
                <section key={g.category} aria-labelledby={`sources-${g.category}`} className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between gap-3">
                        <h2 id={`sources-${g.category}`} className="text-title-3 font-semibold text-fg">
                            {CATEGORY_LABELS[g.category].title}
                        </h2>
                        <p className="text-caption text-fg-tertiary">
                            {g.sources.length} {g.sources.length === 1 ? "source" : "sources"}
                        </p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-footnote">
                            <thead className="text-left text-caption text-fg-tertiary">
                                <tr>
                                    <th scope="col" className="pb-2 pr-4 font-medium">Source</th>
                                    <th scope="col" className="pb-2 pr-4 font-medium">Applies to</th>
                                    <th scope="col" className="pb-2 font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {g.sources.map((s) => (
                                    <SourceRow key={s.id} s={s} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            ))}
        </div>
    );
}
