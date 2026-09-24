import { useMemo } from "react";
import { STORAGE_NOTICE, storageMode } from "@/lib/deployment";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CopyButton } from "@/components/ui/CopyButton";

const ENDPOINTS = [
    {
        method: "GET",
        path: "/api/lookup?q={query}&type={optional}",
        desc: "Runs every applicable source and returns the full LookupReport as JSON. `type` is auto-detected when omitted (email, domain, url, ip, phone, text). Add `fresh=1` to bypass the cache.",
        example: (host: string) => `curl -G ${host}/api/lookup --data-urlencode "q=paypal-secure-login.xyz"`,
    },
    {
        method: "GET",
        path: "/api/lookup/stream?q={query}",
        desc: "The same lookup as Server-Sent Events: a `start` event listing planned sources, one `check` event per source as it answers, then `done` with the full report.",
        example: (host: string) => `curl -N -G ${host}/api/lookup/stream --data-urlencode "q=+1 888 123 4567"`,
    },
    {
        method: "POST",
        path: "/api/reports",
        desc: 'Submits a community report. Body: {"query": string, "type"?: TargetType, "category": "phishing" | "scam" | "fraud" | "spam" | "malware" | "impersonation" | "other", "description"?: string}. One report per reporter per target.',
        example: (host: string) => `curl -X POST ${host}/api/reports -H "content-type: application/json" -d '{"query":"amaz0n-verify.top","category":"phishing"}'`,
        reports: true,
    },
    { method: "GET", path: "/api/sources", desc: "Lists every source, what it applies to and whether it is enabled.", example: (host: string) => `curl ${host}/api/sources` },
    { method: "GET", path: "/api/stats", desc: "Aggregate lookup and report counters.", example: (host: string) => `curl ${host}/api/stats` },
    { method: "GET", path: "/api/health", desc: "Liveness probe.", example: (host: string) => `curl ${host}/api/health` },
];

/** Renders `code` spans written with backticks in the descriptions. */
function Desc({ text }: { text: string }) {
    return (
        <p className="text-footnote text-fg-secondary">
            {text.split(/(`[^`]+`)/).map((part, i) =>
                part.startsWith("`") ? (
                    <code key={i} className="rounded-sm bg-surface-2 px-1 text-caption text-fg">
                        {part.slice(1, -1)}
                    </code>
                ) : (
                    part
                ),
            )}
        </p>
    );
}

export function ApiDocsPage() {
    const host = window.location.origin;
    const storage = useMemo(storageMode, []);
    return (
        <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-12 sm:px-6">
            <div className="flex flex-col gap-3">
                <h1 className="text-title-2 font-bold tracking-tight text-fg">API</h1>
                <p className="text-body text-fg-secondary">
                    Everything the web app does is available over a small JSON API. Response types are defined in{" "}
                    <code className="rounded-sm bg-surface-2 px-1 text-footnote">shared/types.ts</code>.
                </p>
            </div>

            <section aria-labelledby="rate-limits" className="flex flex-col gap-2">
                <h2 id="rate-limits" className="text-headline font-semibold text-fg">
                    Rate limits
                </h2>
                <p className="text-footnote text-fg-secondary">
                    Lookups and reports are rate-limited per IP address. Responses carry the standard <code className="font-mono text-caption">RateLimit</code> and{" "}
                    <code className="font-mono text-caption">RateLimit-Policy</code> headers; a <code className="font-mono text-caption">429</code> response includes{" "}
                    <code className="font-mono text-caption">Retry-After</code> in seconds. Self-host for higher volume.
                </p>
            </section>

            <div className="flex flex-col gap-4">
                {ENDPOINTS.map((e) => {
                    const example = e.example(host);
                    return (
                        <Card as="section" key={e.path} aria-label={`${e.method} ${e.path}`} className="flex flex-col gap-3 p-5">
                            <div className="flex flex-wrap items-center gap-3">
                                <Badge className="font-mono font-semibold">{e.method}</Badge>
                                <code className="break-all font-mono text-footnote text-fg">{e.path}</code>
                            </div>
                            <Desc text={e.desc} />
                            {e.reports && storage === "ephemeral" && <p className="text-footnote text-fg-secondary">{STORAGE_NOTICE}</p>}
                            <div className="flex items-start gap-2 rounded-md bg-surface-2 p-3">
                                <pre tabIndex={0} aria-label={`Example: ${e.method} ${e.path.split("?")[0]}`} className="min-w-0 flex-1 overflow-x-auto font-mono text-caption text-fg">
                                    {example}
                                </pre>
                                <CopyButton value={example} label={`Copy example for ${e.path.split("?")[0]}`} />
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
