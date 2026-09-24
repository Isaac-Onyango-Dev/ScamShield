import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, CircleDashed, ExternalLink, Info, Loader2, OctagonAlert, Search, XCircle } from "lucide-react";
import { Link } from "wouter";
import type { CheckResult, CheckStatus, Item } from "@shared/types";
import { cn, SEVERITY_DOT, STATUS_STYLES } from "@/lib/ui";

const ICONS: Record<CheckStatus, typeof Info> = {
    clean: CheckCircle2,
    found: Search,
    info: Info,
    warning: AlertTriangle,
    danger: OctagonAlert,
    error: XCircle,
    skipped: CircleDashed,
};

function ItemLink({ item }: { item: Item }) {
    const internal = item.href?.startsWith("/");
    const body = (
        <div className="flex min-w-0 items-start gap-3">
            {item.image && <img src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-9 w-9 shrink-0 rounded-lg object-cover" />}
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate font-medium text-slate-100">{item.title}</span>
                    {item.date && <span className="text-xs tabular-nums text-slate-500">{item.date}</span>}
                    {item.href && !internal && <ExternalLink className="h-3 w-3 shrink-0 text-slate-500" />}
                </div>
                {item.subtitle && <p className="mt-0.5 break-words text-xs text-slate-400">{item.subtitle}</p>}
                {item.tags && item.tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                        {item.tags.map((t) => (
                            <span key={t} className="chip px-1.5 py-0 text-[10px]">
                                {t}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
    const cls = "block rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 transition hover:border-white/15 hover:bg-white/[0.04]";
    if (!item.href) return <div className={cls}>{body}</div>;
    if (internal) return <Link href={item.href} className={cls}>{body}</Link>;
    return (
        <a href={item.href} target="_blank" rel="noopener noreferrer nofollow" className={cls}>
            {body}
        </a>
    );
}

export function CheckCard({ result }: { result: CheckResult }) {
    const [expanded, setExpanded] = useState(false);
    const Icon = ICONS[result.status];
    const style = STATUS_STYLES[result.status];
    const items = result.items ?? [];
    const shown = expanded ? items : items.slice(0, 6);
    const quiet = result.status === "skipped" || result.status === "error";

    return (
        <article className={cn("panel animate-fade-up p-5", quiet && "opacity-70")}>
            <header className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", style.cls.split(" ")[0])} />
                    <div className="min-w-0">
                        <h3 className="font-semibold text-white">{result.name}</h3>
                        <p className="mt-0.5 text-sm text-slate-400">{result.summary}</p>
                    </div>
                </div>
                <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold", style.cls)}>{style.label}</span>
            </header>

            {result.error && <p className="mt-3 rounded-lg bg-white/[0.03] px-3 py-2 font-mono text-xs text-slate-400">{result.error}</p>}

            {result.signals.length > 0 && (
                <ul className="mt-4 space-y-1.5">
                    {result.signals.map((s) => (
                        <li key={s.id + s.label} className="flex items-start gap-2 text-sm">
                            <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", s.kind === "trust" ? "bg-emerald-400" : SEVERITY_DOT[s.severity])} />
                            <span className={s.kind === "trust" ? "text-emerald-200/90" : "text-slate-200"}>{s.label}</span>
                        </li>
                    ))}
                </ul>
            )}

            {result.facts.length > 0 && (
                <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                    {result.facts.map((f, i) => (
                        <div key={f.label + i} className="min-w-0">
                            <dt className="text-[11px] uppercase tracking-wide text-slate-500">{f.label}</dt>
                            <dd className={cn("break-words text-slate-200", f.mono && "font-mono text-[13px]")}>
                                {f.href ? (
                                    <a href={f.href} target="_blank" rel="noopener noreferrer nofollow" className="text-brand-300 hover:underline">
                                        {f.value}
                                    </a>
                                ) : (
                                    f.value
                                )}
                            </dd>
                        </div>
                    ))}
                </dl>
            )}

            {items.length > 0 && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {shown.map((item, i) => (
                        <ItemLink key={item.title + i} item={item} />
                    ))}
                </div>
            )}
            {items.length > 6 && (
                <button onClick={() => setExpanded(!expanded)} className="mt-3 inline-flex items-center gap-1 text-sm text-brand-300 hover:text-brand-200">
                    {expanded ? "Show less" : `Show all ${items.length}`}
                    <ChevronDown className={cn("h-4 w-4 transition", expanded && "rotate-180")} />
                </button>
            )}

            <footer className="mt-4 flex items-center justify-between text-[11px] text-slate-500">
                {result.source ? (
                    result.source.url.startsWith("/") ? (
                        <span>Source: {result.source.name}</span>
                    ) : (
                        <a href={result.source.url} target="_blank" rel="noopener noreferrer" className="hover:text-slate-300">
                            Source: {result.source.name}
                        </a>
                    )
                ) : (
                    <span>ScamShield analysis</span>
                )}
                {result.durationMs > 0 && <span className="tabular-nums">{result.durationMs} ms</span>}
            </footer>
        </article>
    );
}

export function PendingCard({ name }: { name: string }) {
    return (
        <div className="panel relative overflow-hidden p-5">
            <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-brand-400" />
                <div>
                    <p className="font-semibold text-slate-300">{name}</p>
                    <p className="text-sm text-slate-500">Querying source…</p>
                </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-px overflow-hidden">
                <div className="h-px w-1/3 animate-scan bg-gradient-to-r from-transparent via-brand-400 to-transparent" />
            </div>
        </div>
    );
}
