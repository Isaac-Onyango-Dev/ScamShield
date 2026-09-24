# Deployment

ScamShield is a long-running Node 22 server with a SQLite file. Deploy it anywhere that runs a persistent process. Serverless platforms (Vercel functions, Netlify, Lambda) are **not** a fit: SSE streams, in-process rate limits and SQLite all need a persistent process and disk.

## Render (blueprint included)

1. Render dashboard → **New → Blueprint** → select this repo. `render.yaml` configures build, start, health check, a 1 GB persistent disk at `/var/data`, and a generated `REPORTER_SALT`.
2. Fill in whichever optional API keys you have.
3. Deploy. Migrations and seeding run on boot.

> On Render's **free** instance there is no persistent disk, so community reports reset on every deploy. Use `starter` or higher to keep data.

## Docker

```bash
docker build -t scamshield .
docker run -d --name scamshield -p 5000:5000 -v scamshield-data:/data \
  -e REPORTER_SALT="$(openssl rand -hex 32)" -e TRUST_PROXY=1 scamshield
```

The image runs as a non-root user, stores the DB in the `/data` volume, and has a health check.

## VPS / bare metal

```bash
npm ci && npm run build
NODE_ENV=production DATABASE_URL=/var/lib/scamshield/db.sqlite PORT=5000 node dist/index.js
```

Run it under systemd or pm2 behind nginx or Caddy. For SSE, disable proxy buffering on `/api/lookup/stream` (`proxy_buffering off;`). The app already sends `X-Accel-Buffering: no`.

## Production checklist

- [ ] `REPORTER_SALT` set to a long random value
- [ ] `TRUST_PROXY` equals the number of proxies in front of the app, or rate limits key on the proxy's IP
- [ ] `DATABASE_URL` on persistent storage, backed up (for example `sqlite3 db ".backup snapshot.db"`)
- [ ] DNS resolver allowed by Spamhaus/URIBL. They refuse big public resolvers; the Sources card shows "unavailable from this resolver" when that happens. Run a local `unbound` or use your host's resolver via `DNS_SERVERS`
- [ ] Optional keys: `URLHAUS_AUTH_KEY` (free), `GOOGLE_SAFE_BROWSING_KEY` (free), `ABUSEIPDB_API_KEY` (free tier), `GITHUB_TOKEN`, `HIBP_API_KEY` (paid), `OPENAI_API_KEY`
- [ ] Health check at `GET /api/health`
- [ ] Logs are JSON lines on stdout/stderr in production; ship them to your log stack

## Environment variables

See [`.env.example`](.env.example). Every variable is validated at startup (`server/config.ts`), so a bad value fails fast with a clear message.
