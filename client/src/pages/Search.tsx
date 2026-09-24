import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { Download, Flag, RefreshCw } from "lucide-react";
import { TYPE_LABELS } from "@shared/detect";
import { TARGET_TYPES, type TargetType } from "@shared/types";
import { useLookupStream, type LookupError, type StreamState } from "@/lib/api";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/categories";
import { cn } from "@/lib/cn";
import { storageMode } from "@/lib/deployment";
import { EXAMPLES } from "@/lib/examples";
import { exportCsv, exportJson } from "@/lib/exportReport";
import { formatDateTime, formatSeconds, formatUtc, timeAgo } from "@/lib/format";
import { matchesFilter, type FindingFilter } from "@/lib/status";
import { SearchBox } from "@/components/SearchBox";
import { VerdictPanel } from "@/components/VerdictPanel";
import { CheckCard, PendingSource } from "@/components/CheckCard";
import { FindingsFilter, FindingsTable, type PlannedSource } from "@/components/FindingsTable";
import { LookupStatus } from "@/components/LookupStatus";
import { ReportDialog } from "@/components/ReportDialog";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Skeleton } from "@/components/ui/Skeleton";

/** Seconds left on a rate limit, ticking down once per second. */
function useCountdown(error?: LookupError): number {
    const [now, setNow] = useState(() => Date.now());
    const deadline = useMemo(() => (error?.kind === "rate-limited" ? Date.now() + error.retryAfter * 1000 : 0), [error]);
    useEffect(() => {
        if (!deadline) return;
        setNow(Date.now());
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, [deadline]);
    return deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;
}

function MessageTarget({ text }: { text: string }) {
    const [full, setFull] = useState(false);
    const long = text.length > 180;
    return (
        <div className="flex flex-col items-start gap-1">
            <h1 className={cn("whitespace-pre-wrap break-words text-body text-fg", !full && "line-clamp-3")}>“{text}”</h1>
            {long && (
                <Button variant="plain" size="sm" aria-expanded={full} onClick={() => setFull(!full)}>
                    {full ? "Show less" : "Show full message"}
                </Button>
            )}
        </div>
    );
}

function LookupAlert({ error, retryIn, answered, total, onRetry }: { error: LookupError; retryIn: number; answered: number; total: number; onRetry: () => void }) {
    if (error.kind === "rate-limited") {
        return (
            <InlineAlert
                tone="warning"
                title="Too many lookups from your network."
                action={
                    <Button size="sm" onClick={onRetry} disabled={retryIn > 0}>
                        Try again
                    </Button>
                }
            >
                <span data-testid="rate-limit-countdown">{retryIn > 0 ? `Try again in ${retryIn} s.` : "You can try again now."}</span>
            </InlineAlert>
        );
    }
    const partial = total > 0 && answered > 0 ? ` ${answered} of ${total} sources answered; the results below are incomplete.` : "";
    return (
        <InlineAlert
            tone="danger"
            title={error.kind === "server" ? "Lookup failed" : error.message}
            action={
                <Button size="sm" onClick={onRetry}>
                    Retry
                </Button>
            }
        >
            {error.kind === "server" ? error.message : partial.trim() || undefined}
        </InlineAlert>
    );
}

function ConnectingSkeleton() {
    return (
        <div className="flex flex-col gap-4" aria-hidden>
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-8 w-2/3" />
            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
            </div>
        </div>
    );
}

function answeredCount(state: StreamState) {
    return state.planned.filter((p) => state.results[p.id]).length;
}

export function SearchPage() {
    const params = new URLSearchParams(useSearch());
    const q = params.get("q");
    const typeParam = params.get("type");
    const type = TARGET_TYPES.includes(typeParam as TargetType) ? (typeParam as TargetType) : undefined;
    const { state, refresh, retry } = useLookupStream(q, type);
    const [reportOpen, setReportOpen] = useState(false);
    const [filter, setFilter] = useState<FindingFilter>("all");
    const storage = useMemo(storageMode, []);
    const retryIn = useCountdown(state.error);

    const running = state.phase === "connecting" || state.phase === "streaming";
    const rateLimited = state.error?.kind === "rate-limited" && retryIn > 0;
    const answered = answeredCount(state);
    const total = state.planned.length;
    const report = state.report;

    const sources: PlannedSource[] = useMemo(
        () => state.planned.map((p) => ({ ...p, result: state.results[p.id] })).filter((s) => s.result?.status !== "skipped"),
        [state.planned, state.results],
    );
    const sections = useMemo(
        () =>
            CATEGORY_ORDER.map((category) => ({
                category,
                items: sources.filter((s) => s.category === category && (s.result ? matchesFilter(s.result.status, filter) : filter === "all")),
            })).filter((s) => s.items.length > 0),
        [sources, filter],
    );
    const skipped = Object.values(state.results).filter((r) => r.status === "skipped");
    const target = state.target;

    if (!q) {
        return (
            <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
                <SearchBox size="md" />
                <EmptyState title="Enter something to look up.">
                    <p>Or try an example:</p>
                    <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
                        {EXAMPLES.map((ex) => (
                            <li key={ex.label}>
                                <Link href={`/search?q=${encodeURIComponent(ex.q)}`} className="text-accent hover:underline">
                                    {ex.label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </EmptyState>
            </div>
        );
    }

    return (
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
            <SearchBox initial={q} size="md" busy={running} disabled={rateLimited} error={state.error?.kind === "invalid" ? state.error.message : undefined} />

            {state.error && state.error.kind !== "invalid" && <LookupAlert error={state.error} retryIn={retryIn} answered={answered} total={total} onRetry={retry} />}

            {!target && state.phase === "connecting" && (
                <>
                    <LookupStatus state={state} answered={answered} total={total} />
                    <ConnectingSkeleton />
                </>
            )}

            {target && (
                <>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div className="flex min-w-0 flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge tone="accent" data-testid="target-type">
                                    {TYPE_LABELS[target.type]}
                                </Badge>
                                {report?.cached && <Badge data-testid="cached-badge">Cached, {timeAgo(report.generatedAt)}</Badge>}
                            </div>
                            {target.type === "text" ? (
                                <MessageTarget text={target.normalized} />
                            ) : (
                                <div className="flex items-start gap-2">
                                    <h1 className="min-w-0 break-all font-mono text-title-2 font-semibold text-fg">{target.normalized}</h1>
                                    <CopyButton value={target.normalized} label="Copy indicator" className="mt-1" />
                                </div>
                            )}
                            <p className="text-caption text-fg-tertiary">
                                {report && (
                                    <>
                                        Checked{" "}
                                        <time dateTime={report.generatedAt} title={formatUtc(report.generatedAt)}>
                                            {formatDateTime(report.generatedAt)}
                                        </time>
                                        {!report.cached && <> · <span data-testid="duration">{formatSeconds(report.durationMs)}</span></>}
                                        {" · "}
                                    </>
                                )}
                                {answered} of {total} sources answered
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <CopyButton value={window.location.href} label="Copy link" showLabel size="md" />
                            <div role="group" aria-label="Export report" className="flex gap-2">
                                <Button onClick={() => report && exportJson(report)} disabled={!report}>
                                    <Download className="h-4 w-4" aria-hidden />
                                    JSON
                                </Button>
                                <Button onClick={() => report && exportCsv(report)} disabled={!report}>
                                    <Download className="h-4 w-4" aria-hidden />
                                    CSV
                                </Button>
                            </div>
                            <Button onClick={refresh} disabled={running || rateLimited} title="Skip the cache and query every source again">
                                <RefreshCw className="h-4 w-4" aria-hidden />
                                Refresh
                            </Button>
                            <Button variant="secondary" onClick={() => setReportOpen(true)}><Flag className="h-4 w-4" aria-hidden />Report…</Button>
                        </div>
                    </div>

                    <LookupStatus state={state} answered={answered} total={total} />

                    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
                        <aside className="lg:sticky lg:top-20 lg:self-start">
                            <VerdictPanel report={report} sources={total} />
                        </aside>
                        <div className="flex min-w-0 flex-col gap-8" aria-busy={running}>
                            <section aria-labelledby="findings-title" className="flex flex-col gap-3">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <h2 id="findings-title" className="text-title-3 font-semibold text-fg">
                                        Findings
                                    </h2>
                                    <FindingsFilter sources={sources} value={filter} onChange={setFilter} />
                                </div>
                                <FindingsTable sources={sources} filter={filter} />
                            </section>

                            {sections.map((s) => (
                                <section key={s.category} aria-labelledby={`category-${s.category}`} className="flex flex-col gap-3">
                                    <div>
                                        <h2 id={`category-${s.category}`} className="text-headline font-semibold text-fg">
                                            {CATEGORY_LABELS[s.category].title}
                                        </h2>
                                        <p className="text-footnote text-fg-tertiary">{CATEGORY_LABELS[s.category].blurb}</p>
                                    </div>
                                    {s.items.map((c) => (c.result ? <CheckCard key={c.id} result={c.result} storage={storage} /> : <PendingSource key={c.id} id={c.id} name={c.name} />))}
                                </section>
                            ))}
                            {skipped.length > 0 && (
                                <p className="text-caption text-fg-tertiary">Not run: {skipped.map((s) => `${s.name} (${s.summary})`).join(" · ")}</p>
                            )}
                        </div>
                    </div>
                    <ReportDialog target={target} open={reportOpen} onClose={() => setReportOpen(false)} onReported={refresh} storage={storage} />
                </>
            )}
        </div>
    );
}
