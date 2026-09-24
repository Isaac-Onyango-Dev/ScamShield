# Architecture

```
            ┌──────────────────────────── client (React + Vite + Tailwind) ──────────────────────────┐
            │  SearchBox ─detect()─▶ /search?q=…  ──EventSource──▶ /api/lookup/stream                 │
            │  VerdictPanel (gauge, red flags, trust, advice)   CheckCard × N (fill in as they stream) │
            └───────────────────────────────────────────────┬────────────────────────────────────────┘
                                                            │ SSE / JSON
┌───────────────────────────────────────── server (Express) ▼─────────────────────────────────────────┐
│ helmet CSP · rate limits · zod validation                                     routes/api.ts           │
│                                                                                                        │
│ LookupService.resolveTarget(q) ── shared/detect.ts (+ libphonenumber E.164)       engine/lookup.ts    │
│        │                                                                                               │
│        ├─ cache hit? (lookup_cache, sha256(type:normalized), TTL) ──▶ replay events                   │
│        ▼                                                                                               │
│ runChecks(applicableChecks)  — Promise.all, per-check timeout + AbortSignal, errors isolated          │
│   community · email.* · phone · text · url · lookalike · blocklists · safebrowsing · urlhaus ·         │
│   abuseipdb · breaches · hibp · infostealer · dns · rdap · tls · ip.network · pivots                   │
│        │  (shared per-lookup memo dedupes DNS between checks)                                          │
│        ▼                                                                                               │
│ computeVerdict(signals)  →  summarize() (rules, or OpenAI with rules fallback)  →  cache.set          │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                 │ better-sqlite3 (WAL)                          │ fetch / node:dns / node:tls
          scam_reports · report_events ·                 XposedOrNot · Hudson Rock · Gravatar · GitHub ·
          common_scams · lookup_cache · statistics       keys.openpgp.org · rdap.org · Spamhaus/SURBL/URIBL ·
                                                         SpamCop · DroneBL · (HIBP, GSB, URLhaus, AbuseIPDB)
```

## Key design decisions

| Decision | Why | Trade-off |
|---|---|---|
| **Pluggable `CheckDefinition`s** with `appliesTo`, `supports()`, `disabledReason()` | One file per source; the Sources page, skipping and streaming come free | Checks can't depend on each other's output (they share a memo instead) |
| **Concurrent execution, per-check timeout, AbortSignal** | Total latency is the slowest source (≈8 s max), not the sum. Aborted sockets and fetches are released | A slow source shows "Unavailable" rather than blocking |
| **Failures never fail the lookup** | Third-party APIs rate-limit and go down. `confidence` reports coverage honestly | The score may be computed on partial evidence (shown in the UI) |
| **Server-Sent Events** instead of WebSockets | One-way, proxy-friendly, auto-reconnect semantics, trivial on Express | No client→server messages mid-lookup (not needed) |
| **Deterministic, explainable scoring**; AI only summarizes | Reproducible, testable, can't be prompt-injected by the message being analysed | Weights are hand-tuned (see `engine/scoring.ts`) |
| **SQLite + WAL** | Zero-ops, fast, single-file backups | Single node. For horizontal scale, move to Postgres (drizzle makes this mechanical) and Redis for rate limits and cache |
| **Cache keyed by `sha256(type:normalized)`**, invalidated on report | Avoids hammering free APIs; community changes show up immediately | Up to `LOOKUP_CACHE_TTL_MINUTES` of staleness for external data (users can Re-scan) |

## Security

- **SSRF:** the only check that opens a socket to a user-controlled host (TLS) resolves the host first and refuses loopback, RFC1918, link-local (cloud metadata), CGNAT, multicast and reserved ranges (`lib/netguard.ts`). URLs are **never fetched**.
- **Input:** zod-validated, max 4000 chars, JSON body limit 32 KB.
- **Abuse:** per-IP rate limits (`TRUST_PROXY` must match your proxy depth). Reports are de-duplicated per `sha256(salt:ip)`; raw IPs are never stored.
- **Privacy:** request logs contain the path only, never the query string. Infostealer passwords are never shown or stored. The cache is short-lived and purged every 15 minutes.
- **Headers:** helmet CSP (`script-src 'self'`), `no-referrer`, and no `x-powered-by`. Outbound links use `noopener noreferrer nofollow`.

## Data model (`shared/schema.ts`)

- `scam_reports`: one aggregate row per `(content_type, content)`.
- `report_events`: individual submissions with a unique `(report_id, reporter_hash)` index. Powers the 24 h stats and prevents ballot-stuffing.
- `common_scams`: curated indicators, unique on `(content_type, content)`.
- `lookup_cache`: full JSON reports with `expires_at`.
- `statistics`: counters (upserted atomically).

Migrations live in `migrations/` and run on boot. `0001` upgrades v1 databases in place: it converts legacy text timestamps, de-duplicates rows, and adds the new tables.

## Scaling path

1. **Now:** a single instance handles hundreds of lookups per minute. The bottleneck is upstream API quotas, not CPU.
2. **Next:** put the lookup service behind a queue (BullMQ) and move the cache and rate limits to Redis so several web instances share them.
3. **Later:** swap SQLite for Postgres, add API keys per consumer, and add a bulk endpoint that fans out through the queue.
