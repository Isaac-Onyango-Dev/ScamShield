# Deployment Guide

Quick guide to deploy ScamShield from GitHub.

## Option 1: Vercel (Recommended - Free Tier Available)

### Setup

1. **Connect GitHub**
   - Go to [vercel.com](https://vercel.com)
   - Sign in with GitHub
   - Click "Add New..." → "Project"
   - Select your ScamShield repository

2. **Configure Build**
   - Build Command: `npm run build`
   - Output Directory: `dist/public`
   - Node.js Version: 18.x

3. **Environment Variables**
   - Add `OPENAI_API_KEY` from your OpenAI dashboard
   - Add `DATABASE_URL` (auto-generated or point to cloud SQLite)

4. **Deploy**
   - Click "Deploy"
   - Vercel automatically redeploys on `git push`

**URL**: `https://your-project.vercel.app`

---

## Option 2: GitHub Pages + API Server

For static deployment with external API backend:

1. Build: `npm run build`
2. Deploy `/dist/public` to GitHub Pages
3. Deploy `/server` to a Node.js host (Railway, Heroku, etc.)
4. Update API endpoint in frontend

---

## Option 3: Self-Hosted Server

### Docker

```bash
# Build image
docker build -t scamshield .

# Run container
docker run -p 5000:5000 \
  -e OPENAI_API_KEY=sk-... \
  -e DATABASE_URL=/data/sqlite.db \
  -v ./data:/data \
  scamshield
```

### Traditional Server (Ubuntu/Debian)

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and setup
git clone https://github.com/yourusername/ScamShield.git
cd ScamShield
npm install
npm run build

# Run with PM2 (process manager)
npm install -g pm2
pm2 start "npm run start" --name scamshield
pm2 save
```

---

## Option 4: Railway

1. Connect GitHub repo
2. Set environment variables
3. Railway auto-detects Node.js app and deploys
4. Custom domain optional

---

## Environment Setup Checklist

- [ ] `OPENAI_API_KEY` set (optional, heuristic analysis works without it)
- [ ] `DATABASE_URL` set or using default `sqlite.db`
- [ ] `NODE_ENV=production`
- [ ] Build completed: `npm run build`
- [ ] Seed demo data: `npx tsx server/seed.ts` (optional)

## Database Migrations (if needed)

```bash
# Push schema to database
npm run db:push

# Generate migrations
npx drizzle-kit generate:sqlite
```

## Troubleshooting

**Port already in use**
```bash
PORT=3000 npm run start
```

**Database locked error**
- Ensure only one instance of the server running
- Check for lingering node processes: `ps aux | grep node`

**OpenAI API errors**
- Verify API key is valid
- Check rate limits on OpenAI dashboard
- App falls back to heuristic analysis on failure

**Build fails**
```bash
rm -rf node_modules dist
npm install
npm run build
```

---

## Performance Tips

1. **Enable caching**: Results cached for 30 days
2. **Monitor database**: Check `sqlite.db` size periodically
3. **Use CDN**: Serve static assets (`dist/public`) via CDN
4. **Scale DB**: Move to PostgreSQL after 100K+ reports

## Monitoring

Add health check URL: `GET /api/health`

Example uptime monitoring:
```bash
# Check every 5 minutes
*/5 * * * * curl -f http://localhost:5000/api/health || alert
```

---

**Need help?** See README.md or open an issue on GitHub.
