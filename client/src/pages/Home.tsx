import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import type { DashboardStats } from "@shared/types";
import { fetchStats } from "@/lib/api";
import { storageMode, type StorageMode } from "@/lib/deployment";
import { EXAMPLES } from "@/lib/examples";
import { formatCount } from "@/lib/format";
import { SearchBox } from "@/components/SearchBox";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

const CAPABILITIES = [
    { type: "Email", checks: ["breach history (XposedOrNot, HIBP)", "infostealer logs (Hudson Rock)", "Gravatar, GitHub and PGP footprint", "disposable and brand-impersonating mailboxes", "MX, SPF and DMARC"] },
    { type: "Link", checks: ["shorteners, raw-IP hosts and '@' tricks", "risky downloads and phishing-kit paths", "Google Safe Browsing and URLhaus", "every domain check"] },
    { type: "Domain", checks: ["registration age (RDAP)", "typosquats and homographs (IDN)", "Spamhaus DBL, SURBL, URIBL", "TLS certificate"] },
    { type: "IP address", checks: ["network owner and abuse contact (RDAP)", "reverse DNS", "Spamhaus ZEN, SpamCop, DroneBL", "AbuseIPDB"] },
    { type: "Phone", checks: ["validity, country and line type", "VoIP, premium-rate and Wangiri ranges", "community reports", "Truecaller and Tellows pivots"] },
    { type: "Message", checks: ["17 social-engineering tactics", "links, emails and numbers extracted for follow-up lookups"] },
];

/**
 * Public counters as one quiet line (decisions D4, D9). Zero values are never shown; the whole
 * row disappears when everything is zero. On ephemeral storage the restart-scoped counters are
 * qualified with "since last restart"; known indicators are re-seeded on boot, so they aren't.
 */
export function statsLine(stats: DashboardStats, storage: StorageMode): string | null {
    const scoped = [
        stats.reportsLast24h > 0 && `${formatCount(stats.reportsLast24h)} reports in the last 24 h`,
        stats.totalLookups > 0 && `${formatCount(stats.totalLookups)} lookups run`,
        stats.totalReports > 0 && `${formatCount(stats.totalReports)} community reports`,
    ].filter(Boolean) as string[];
    if (scoped.length && storage === "ephemeral") scoped[scoped.length - 1] += " since last restart";
    const parts = [...scoped, ...(stats.knownScams > 0 ? [`${formatCount(stats.knownScams)} known scam indicators`] : [])];
    return parts.length ? parts.join(" · ") : null;
}

function Stats() {
    const storage = useMemo(storageMode, []);
    const { data, isLoading, isError } = useQuery({ queryKey: ["stats"], queryFn: fetchStats, refetchInterval: 60_000 });
    if (isLoading) return <Skeleton className="mx-auto h-4 w-1/2" />;
    if (isError || !data) return null; // non-critical: hide rather than show a broken row
    const line = statsLine(data, storage);
    if (!line) return null;
    return (
        <p data-testid="stats-row" className="tabular text-center text-caption text-fg-tertiary">
            {line}
        </p>
    );
}

export function HomePage() {
    return (
        <div className="mx-auto flex max-w-3xl flex-col gap-12 px-4 py-12 sm:px-6 sm:py-20">
            <section className="flex flex-col gap-6">
                <div className="flex flex-col gap-3 text-center">
                    <h1 className="text-title-2 font-bold tracking-tight text-fg sm:text-title-1">Check an email, link, domain, IP, phone number or message.</h1>
                    <p className="text-body text-fg-secondary">Results come from public sources and appear as each one answers.</p>
                </div>
                <SearchBox helper="Paste a whole message to extract its links and numbers. Defanged input like hxxp://evil[.]com works." />
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-footnote">
                    <span className="text-fg-tertiary">Examples</span>
                    {EXAMPLES.map((ex) => (
                        <Link key={ex.label} href={`/search?q=${encodeURIComponent(ex.q)}`} className="rounded-sm text-accent hover:underline">
                            {ex.label}
                        </Link>
                    ))}
                </div>
                <Stats />
            </section>

            <Card as="section" aria-labelledby="capabilities-title" className="flex flex-col gap-4 p-5 sm:p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 id="capabilities-title" className="text-headline font-semibold text-fg">
                        What each lookup checks
                    </h2>
                    <Link href="/sources" className="text-footnote text-accent hover:underline">
                        See all sources
                    </Link>
                </div>
                <table data-testid="capabilities" className="w-full border-collapse text-left text-footnote">
                    <caption className="sr-only">Checks run for each type of input</caption>
                    <tbody>
                        {CAPABILITIES.map((c) => (
                            <tr key={c.type} className="border-t border-line align-top first:border-t-0">
                                <th scope="row" className="w-1/4 py-3 pr-4 font-semibold text-fg">
                                    {c.type}
                                </th>
                                <td className="py-3 text-fg-secondary">{c.checks.join(", ")}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>
        </div>
    );
}
