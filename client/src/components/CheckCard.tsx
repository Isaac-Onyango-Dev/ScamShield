import { useState } from "react";
import { Link } from "wouter";
import type { CheckResult, Item } from "@shared/types";
import { isRateLimited, statusPresentation } from "@/lib/status";
import { STORAGE_NOTICE_SHORT, type StorageMode } from "@/lib/deployment";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { SourceLink } from "@/components/ui/SourceLink";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { SignalList } from "./SignalList";

const PREVIEW = 6;

function ItemBody({ item }: { item: Item }) {
    return (
        <div className="flex min-w-0 items-start gap-3">
            {item.image && <img src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-8 w-8 shrink-0 rounded-sm border border-line object-cover" />}
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="truncate font-medium text-fg">{item.title}</span>
                    {item.date && <span className="tabular text-caption text-fg-tertiary">{item.date}</span>}
                </div>
                {item.subtitle && <p className="break-words text-caption text-fg-secondary">{item.subtitle}</p>}
                {item.tags && item.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                        {item.tags.map((t) => (
                            <Badge key={t}>{t}</Badge>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function ItemRow({ item }: { item: Item }) {
    const cls = "block rounded-md px-3 py-2 text-footnote transition-colors duration-fast hover:bg-surface-2";
    if (!item.href) return <div className={cls}><ItemBody item={item} /></div>;
    if (item.href.startsWith("/")) return <Link href={item.href} className={cls}><ItemBody item={item} /></Link>;
    return <ExternalLink href={item.href} className={cls}><ItemBody item={item} /></ExternalLink>;
}

export function CheckCard({ result, storage }: { result: CheckResult; storage: StorageMode }) {
    const [expanded, setExpanded] = useState(false);
    const items = result.items ?? [];
    const shown = expanded ? items : items.slice(0, PREVIEW);
    const titleId = `source-${result.id}-title`;
    return (
        <Card as="article" id={`source-${result.id}`} data-testid="source-card" aria-labelledby={titleId} className="flex scroll-mt-20 animate-fade-in flex-col gap-4 p-4 sm:p-5">
            <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 id={titleId} className="text-headline font-semibold text-fg">
                        {result.name}
                    </h3>
                    <p className="text-footnote text-fg-secondary">{result.summary}</p>
                </div>
                <StatusBadge presentation={statusPresentation(result)} value={result.status} />
            </header>

            {result.error && (
                <InlineAlert title={isRateLimited(result) ? "Rate limited by source. Try Refresh in a few minutes." : "Unavailable"}>{result.error}</InlineAlert>
            )}

            {result.signals.length > 0 && <SignalList signals={result.signals} />}

            {result.facts.length > 0 && (
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                    {result.facts.map((f, i) => (
                        <div key={f.label + i} className="min-w-0">
                            <dt className="text-caption text-fg-tertiary">{f.label}</dt>
                            <dd className="flex items-start gap-1 text-footnote text-fg">
                                <span className={f.mono ? "min-w-0 break-all font-mono" : "min-w-0 break-words"}>
                                    {f.href ? (
                                        <ExternalLink href={f.href} className="text-accent hover:underline">
                                            {f.value}
                                        </ExternalLink>
                                    ) : (
                                        f.value
                                    )}
                                </span>
                                <CopyButton value={f.value} label={`Copy ${f.label}`} />
                            </dd>
                        </div>
                    ))}
                </dl>
            )}

            {items.length > 0 && (
                <ul data-testid="card-items" className="-mx-3 flex flex-col">
                    {shown.map((item, i) => (
                        <li key={item.title + i}>
                            <ItemRow item={item} />
                        </li>
                    ))}
                </ul>
            )}
            {items.length > PREVIEW && (
                <Button variant="plain" size="sm" className="self-start" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
                    {expanded ? "Show fewer" : `Show all ${items.length}`}
                </Button>
            )}

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                <SourceLink source={result.source} />
                {result.durationMs > 0 && <span className="tabular text-caption text-fg-tertiary">Answered in {result.durationMs} ms</span>}
                {result.id === "community" && storage === "ephemeral" && <p className="w-full text-caption text-fg-tertiary">{STORAGE_NOTICE_SHORT}</p>}
            </footer>
        </Card>
    );
}

/** Placeholder for a source that hasn't answered yet: static, no spinner or shimmer. */
export function PendingSource({ id, name }: { id: string; name: string }) {
    return (
        <Card as="article" id={`source-${id}`} data-testid="pending-source" aria-busy className="flex flex-col gap-3 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                    <h3 className="text-headline font-semibold text-fg-secondary">{name}</h3>
                    <p className="text-footnote text-fg-tertiary">Waiting for response</p>
                </div>
                <Skeleton className="h-5 w-16" />
            </div>
        </Card>
    );
}
