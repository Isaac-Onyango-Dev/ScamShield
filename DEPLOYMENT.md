# Deployment

ScamShield is a long-running Node 22 server with a SQLite file. Deploy it anywhere that runs a persistent process. Serverless platforms (Vercel functions, Netlify, Lambda) are **not** a fit: SSE streams, in-process rate limits and SQLite all need a persistent process and disk.

Two settings describe the deployment itself:

| Variable | Required | What it does |
|---|---|---|
| `SITE_URL` | **Yes, in production** | Public origin (e.g. `https://scamshield.example`), used for absolute `og:url`, `og:image` and the canonical link. Must be `https` with no path. On Render it falls back to `RENDER_EXTERNAL_URL` automatically. If neither is set, the server refuses to start with `SITE_URL is required in production`. |
| `STORAGE_PERSISTENT` | No (default `false`) | Set to `true` only when `DATABASE_URL` is on storage that survives restarts. While it's `false`, the UI tells users that reports are stored temporarily and that the counters count since the last restart. |

## Render (blueprint included)

1. Render dashboard → **New → Blueprint** → select this repo. `render.yaml` configures build, start, health check, a 1 GB persistent disk at `/var/data`, `STORAGE_PERSISTENT=true` and a generated `REPORTER_SALT`.
2. Fill in whichever optional API keys you have. `SITE_URL` is optional on Render: `RENDER_EXTERNAL_URL` is used when it's unset. Set it if you serve the app from a custom domain.
3. Deploy. Migrations and seeding run on boot.

> **Render Free has no persistent disk.** Community reports and counters reset on every deploy, restart and spin-down. Leave `STORAGE_PERSISTENT` unset there (remove it if you started from the blueprint) so the app says so. To keep data on Free, see follow-up FU-1 in [`docs/REDESIGN_PLAN.md`](docs/REDESIGN_PLAN.md) (hosted libSQL).

## Docker

```bash
docker build -t scamshield .
docker run -d --name scamshield -p 5000:5000 -v scamshield-data:/data \
  -e SITE_URL=https://scamshield.example \
  -e STORAGE_PERSISTENT=true \
  -e REPORTER_SALT="$(openssl rand -hex 32)" -e TRUST_PROXY=1 scamshield
```

The image runs as a non-root user, stores the DB in the `/data` volume, and has a health check. Without `-v`, the database lives in the container layer: drop `STORAGE_PERSISTENT=true` in that case.

> **Upgrading from 2.0:** the image now requires `SITE_URL` (see above). An existing container started without it will exit with a clear error; add `-e SITE_URL=…` and restart.

## VPS / bare metal

```bash
npm ci && npm run build
NODE_ENV=production SITE_URL=https://scamshield.example STORAGE_PERSISTENT=true \
  DATABASE_URL=/var/lib/scamshield/db.sqlite PORT=5000 node dist/index.js
```

Run it under systemd or pm2 behind nginx or Caddy. For SSE, disable proxy buffering on `/api/lookup/stream` (`proxy_buffering off;`). The app already sends `X-Accel-Buffering: no`.

## Production checklist

- [ ] `SITE_URL` set to the public `https` origin (or running on Render, where `RENDER_EXTERNAL_URL` is used)
- [ ] `STORAGE_PERSISTENT=true` only if `DATABASE_URL` is on a disk or volume that survives restarts
- [ ] `REPORTER_SALT` set to a long random value
- [ ] `TRUST_PROXY` equals the number of proxies in front of the app, or rate limits key on the proxy's IP
- [ ] `DATABASE_URL` on persistent storage, backed up (for example `sqlite3 db ".backup snapshot.db"`)
- [ ] DNS resolver allowed by Spamhaus/URIBL. They refuse big public resolvers; the Sources card shows "unavailable from this resolver" when that happens. Run a local `unbound` or use your host's resolver via `DNS_SERVERS`
- [ ] Optional keys: `URLHAUS_AUTH_KEY` (free), `GOOGLE_SAFE_BROWSING_KEY` (free), `ABUSEIPDB_API_KEY` (free tier), `GITHUB_TOKEN`, `HIBP_API_KEY` (paid), `OPENAI_API_KEY`
- [ ] Health check at `GET /api/health`
- [ ] Logs are JSON lines on stdout/stderr in production; ship them to your log stack

## Environment variables

See [`.env.example`](.env.example). Every variable is validated at startup (`server/config.ts`), so a bad value fails fast with a clear message.
