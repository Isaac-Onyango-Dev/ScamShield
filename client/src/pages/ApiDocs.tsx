const ENDPOINTS = [
    {
        method: "GET",
        path: "/api/lookup?q={query}&type={optional}",
        desc: "Runs every applicable source and returns the full LookupReport as JSON. `type` is auto-detected when omitted (email, domain, url, ip, phone, text). Add `fresh=1` to bypass the cache.",
        example: 'curl -G https://YOUR-HOST/api/lookup --data-urlencode "q=paypal-secure-login.xyz"',
    },
    {
        method: "GET",
        path: "/api/lookup/stream?q={query}",
        desc: "Same lookup as Server-Sent Events: a `start` event listing planned sources, one `check` event per source as it answers, then `done` with the full report.",
        example: 'curl -N -G https://YOUR-HOST/api/lookup/stream --data-urlencode "q=+1 888 123 4567"',
    },
    {
        method: "POST",
        path: "/api/reports",
        desc: 'Submit a community report. Body: {"query": string, "type"?: TargetType, "category": "phishing"|"scam"|"fraud"|"spam"|"malware"|"impersonation"|"other", "description"?: string}. One report per reporter per target.',
        example:
            'curl -X POST https://YOUR-HOST/api/reports -H "content-type: application/json" -d \'{"query":"amaz0n-verify.top","category":"phishing"}\'',
    },
    { method: "GET", path: "/api/sources", desc: "Lists every intelligence module, what it applies to and whether it is enabled.", example: "curl https://YOUR-HOST/api/sources" },
    { method: "GET", path: "/api/stats", desc: "Aggregate lookup and report counters.", example: "curl https://YOUR-HOST/api/stats" },
    { method: "GET", path: "/api/health", desc: "Liveness probe.", example: "curl https://YOUR-HOST/api/health" },
];

export function ApiDocsPage() {
    return (
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
            <h1 className="text-3xl font-bold tracking-tight text-white">API</h1>
            <p className="mt-3 text-slate-400">
                Everything the web app does is available over a small JSON API. Lookups are rate-limited per IP; self-host for higher volume. Types are defined in{" "}
                <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-sm">shared/types.ts</code>.
            </p>
            <div className="mt-10 space-y-5">
                {ENDPOINTS.map((e) => (
                    <div key={e.path} className="panel p-5">
                        <div className="flex flex-wrap items-center gap-3">
                            <span className={`rounded-md px-2 py-0.5 font-mono text-xs font-bold ${e.method === "GET" ? "bg-sky-400/15 text-sky-300" : "bg-amber-400/15 text-amber-300"}`}>
                                {e.method}
                            </span>
                            <code className="break-all font-mono text-sm text-white">{e.path}</code>
                        </div>
                        <p className="mt-3 text-sm text-slate-400">{e.desc}</p>
                        <pre className="mt-3 overflow-x-auto rounded-xl bg-ink-950 p-3 font-mono text-xs text-slate-300">{e.example}</pre>
                    </div>
                ))}
            </div>
        </div>
    );
}
