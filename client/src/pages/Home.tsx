import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AtSign, Fingerprint, Globe, Link2, MessageSquareWarning, Phone, Server } from "lucide-react";
import { EXAMPLES, SearchBox } from "@/components/SearchBox";
import { fetchStats } from "@/lib/api";

const CAPABILITIES = [
    {
        icon: AtSign,
        title: "Email addresses",
        points: ["Breach history (XposedOrNot, HIBP)", "Infostealer malware logs (Hudson Rock)", "Gravatar, GitHub & PGP footprint", "Disposable / brand-impersonating mailboxes", "MX, SPF & DMARC posture"],
    },
    {
        icon: Link2,
        title: "Links & URLs",
        points: ["Shorteners, raw-IP hosts, '@' tricks", "Dangerous downloads & phishing-kit paths", "Google Safe Browsing & URLhaus", "Everything in the domain checks"],
    },
    {
        icon: Globe,
        title: "Domains",
        points: ["Registration age via RDAP", "Typosquats & homograph (IDN) attacks", "Spamhaus DBL, SURBL, URIBL", "TLS certificate inspection"],
    },
    {
        icon: Server,
        title: "IP addresses",
        points: ["Network owner & abuse contact (RDAP)", "Reverse DNS", "Spamhaus ZEN, SpamCop, DroneBL", "AbuseIPDB confidence score"],
    },
    {
        icon: Phone,
        title: "Phone numbers",
        points: ["Validity, country & carrier line type", "VoIP, premium-rate & Wangiri ranges", "Community reports", "WhatsApp, Truecaller & Tellows pivots"],
    },
    {
        icon: MessageSquareWarning,
        title: "Messages (SMS / email / DM)",
        points: ["17 social-engineering tactics detected", "Links, emails & numbers auto-extracted", "Each indicator one click from a full lookup", "Explainable, not a black box"],
    },
];

function Stat({ label, value }: { label: string; value?: number }) {
    return (
        <div className="text-center">
            <div className="text-2xl font-bold tabular-nums text-white sm:text-3xl">{value === undefined ? "—" : value.toLocaleString()}</div>
            <div className="mt-1 text-xs uppercase tracking-wider text-slate-500">{label}</div>
        </div>
    );
}

export function HomePage() {
    const { data: stats } = useQuery({ queryKey: ["stats"], queryFn: fetchStats, refetchInterval: 60_000 });

    return (
        <>
            <section className="relative overflow-hidden">
                <div className="grid-bg pointer-events-none absolute inset-0" />
                <div className="pointer-events-none absolute left-1/2 top-[-200px] h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-brand-500/10 blur-3xl" />
                <div className="relative mx-auto max-w-3xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
                    <span className="chip border-brand-400/25 text-brand-300">
                        <Fingerprint className="h-3.5 w-3.5" /> Free · open source · no sign-up
                    </span>
                    <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-6xl">
                        Investigate before
                        <br className="hidden sm:block" /> you <span className="text-brand-400">trust</span>.
                    </h1>
                    <p className="mx-auto mt-5 max-w-xl text-base text-slate-400 sm:text-lg">
                        Check any email, link, domain, IP address, phone number or suspicious message against live breach data,
                        malware logs, blocklists, DNS and community reports — in seconds.
                    </p>
                    <div className="mt-10">
                        <SearchBox autoFocus />
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
                        <span className="text-slate-500">Try:</span>
                        {EXAMPLES.map((ex) => (
                            <Link key={ex.label} href={`/search?q=${encodeURIComponent(ex.q)}`} className="chip transition hover:border-brand-400/40 hover:text-white">
                                {ex.label}
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            <section className="border-y border-white/[0.06] bg-ink-900/40">
                <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 px-4 py-8 sm:grid-cols-4">
                    <Stat label="Lookups run" value={stats?.totalLookups} />
                    <Stat label="Community reports" value={stats?.totalReports} />
                    <Stat label="Reports (24h)" value={stats?.reportsLast24h} />
                    <Stat label="Known scam indicators" value={stats?.knownScams} />
                </div>
            </section>

            <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
                <div className="mx-auto max-w-2xl text-center">
                    <h2 className="text-3xl font-bold tracking-tight text-white">One search. 20+ intelligence sources.</h2>
                    <p className="mt-3 text-slate-400">
                        Every source runs in parallel and streams in live. Each finding is a weighted, explainable signal — you see
                        exactly why a score is what it is.
                    </p>
                </div>
                <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {CAPABILITIES.map(({ icon: Icon, title, points }) => (
                        <div key={title} className="panel p-6">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-300">
                                <Icon className="h-5 w-5" />
                            </div>
                            <h3 className="mt-4 font-semibold text-white">{title}</h3>
                            <ul className="mt-3 space-y-1.5 text-sm text-slate-400">
                                {points.map((p) => (
                                    <li key={p} className="flex gap-2">
                                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand-400" />
                                        {p}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </section>

            <section className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
                <div className="panel grid gap-8 p-8 sm:grid-cols-3">
                    {[
                        ["1. Paste anything", "The input type is detected automatically — even defanged indicators like hxxp://evil[.]com."],
                        ["2. Sources answer live", "Breach, reputation, DNS and registry sources are queried concurrently with strict timeouts."],
                        ["3. Get an explainable verdict", "Red flags and trust signals combine into a 0–100 score, with plain-language advice."],
                    ].map(([t, d]) => (
                        <div key={t}>
                            <h3 className="font-semibold text-white">{t}</h3>
                            <p className="mt-2 text-sm text-slate-400">{d}</p>
                        </div>
                    ))}
                </div>
            </section>
        </>
    );
}
