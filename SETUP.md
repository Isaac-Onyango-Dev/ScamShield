# ScamShield v1.0 - Light Edition Setup Guide

## ✅ What We've Built

A fully functional, production-ready **light version** of ScamShield that combines:
- AI-powered scam analysis
- Community reporting database
- Lookups.io-style UI
- SQLite (no external database needed)
- Deployable from GitHub

## 📁 Project Structure

```
ScamShield/
├── client/src/
│   ├── components/
│   │   ├── SearchBar.tsx        # Main search interface
│   │   ├── SearchResults.tsx    # Results display
│   │   └── StatsDisplay.tsx     # Dashboard stats
│   ├── pages/
│   │   └── Home.tsx             # Main page
│   ├── lib/
│   │   └── api.ts               # React hooks for API
│   ├── App.tsx                  # Main app component
│   ├── index.tsx                # React entry point
│   ├── index.css                # Tailwind styles
│   └── index.html               # HTML template
│
├── server/
│   ├── index.ts                 # Express server
│   ├── seed.ts                  # Demo data seeder
│   ├── routes/
│   │   ├── search.ts            # Search/report endpoints
│   │   └── stats.ts             # Statistics endpoint
│   ├── services/
│   │   └── openai.ts            # OpenAI integration
│   └── lib/
│       ├── db.ts                # Database connection
│       └── cache.ts             # Analysis cache
│
├── shared/
│   ├── schema.ts                # SQLite schema (Drizzle)
│   └── types.ts                 # TypeScript types
│
├── Config files
│   ├── vite.config.ts           # Vite build config
│   ├── drizzle.config.ts        # Drizzle ORM config
│   ├── tailwind.config.ts       # Tailwind config
│   └── tsconfig.json            # TypeScript config
│
├── Docs
│   ├── README.md                # Main documentation
│   ├── DEPLOYMENT.md            # Deployment guide
│   └── SETUP.md                 # This file
│
└── Setup files
    ├── .env.example             # Environment template
    ├── .github/workflows/       # GitHub Actions
    └── package.json             # Dependencies
```

## 🚀 Quick Start

### Step 1: Install Dependencies

```bash
npm install
```

This installs:
- React + Vite for frontend
- Express for backend
- better-sqlite3 for database
- Drizzle ORM for schema
- OpenAI API client
- Tailwind CSS for styling
- TanStack Query for state

### Step 2: Setup Environment

```bash
cp .env.example .env
```

Edit `.env`:
```env
# Optional - app works without OpenAI API
OPENAI_API_KEY=sk-your-key-here

# Database location
DATABASE_URL=sqlite.db

# Server port
PORT=5000

# Development mode
NODE_ENV=development
```

### Step 3: Seed Demo Data (Optional)

```bash
npx tsx server/seed.ts
```

This adds common known scams to the database for testing.

### Step 4: Run Development Server

```bash
npm run dev
```

Opens: `http://localhost:5000`

The server will:
- Start Express API on port 5000
- Serve React frontend from `/client`
- Auto-reload on changes

### Step 5: Build for Production

```bash
npm run build
```

This creates:
- `/dist/public` - Frontend (Vite)
- `/dist/index.js` - Backend (esbuild)

### Step 6: Run Production

```bash
npm run start
```

## 🔧 Key Features & How They Work

### 1. AI-Powered Analysis

**File**: `server/services/openai.ts`

Uses OpenAI GPT-4o to analyze content. If no API key:
- Falls back to **heuristic analysis**
- Checks for known scam patterns
- Calculates risk score (0-100)

```typescript
const result = await analyzeContent("1-800-0000001", "phone");
// Returns:
// {
//   riskScore: 75,
//   riskLevel: "high",
//   isScam: true,
//   reasoning: "...",
//   recommendations: ["...", "..."],
//   details: {...}
// }
```

### 2. Search & Lookup

**Endpoint**: `POST /api/search/search`

Combines:
- AI analysis
- Community reports database
- Known scams database
- Cached results (30-day cache)

### 3. Community Reporting

**Endpoint**: `POST /api/search/reports`

Users can report scams:
- Stored in SQLite with AI analysis
- Increment counter if duplicate
- Updates dashboard statistics

### 4. Dashboard Stats

**Endpoint**: `GET /api/stats/stats`

Shows:
- Total reports
- Average risk score
- Recent reports (24h)
- Top report types

### 5. Content Type Detection

Auto-detects in search bar:
- **Phone**: `+1-800-...` → `phone`
- **Email**: `text@domain.com` → `email`
- **Domain**: `example.com` → `domain`
- **IP**: `192.168.1.1` → `ip`
- **Text**: Anything else → `text`

## 📊 Database Schema

**SQLite Tables** (Drizzle ORM):

| Table | Purpose |
|-------|---------|
| `scam_reports` | User-submitted reports with risk scores |
| `analysis_cache` | Cached AI analysis (30-day expiry) |
| `common_scams` | Pre-populated known scams database |
| `statistics` | Dashboard stats (total_reports, etc) |
| `users` | Optional user accounts (not yet used) |

Query examples:
```typescript
// Get all reports for a phone
const reports = await db
  .select()
  .from(scamReports)
  .where(eq(scamReports.content, "+1-800-0000001"))
  .all();

// Get top reported scams
const top = await db
  .select()
  .from(scamReports)
  .orderBy(desc(scamReports.reportCount))
  .limit(20)
  .all();
```

## 🎨 Frontend Components

### SearchBar
- Auto-detects content type
- Beautiful hero section
- Accessible input with icons

### SearchResults
- Risk score display (0-100)
- Color-coded risk levels (safe → critical)
- Community report info
- AI reasoning & recommendations

### StatsDisplay
- 4-card grid: Reports, Risk, Recent, Analyses
- Real-time updates (every 30s)
- Skeleton loading state

### HomePage
- Full-page layout
- Hero + search bar
- Stats display
- Info section explaining how it works

## 🔌 API Endpoints

### Search & Analysis
```bash
POST /api/search/search
Body: { content: "...", type: "phone|email|domain|ip|text" }
Response: { analysis, communityReports, cached }

GET /api/search/:content?type=phone
Quick lookup without AI analysis
```

### Community Reports
```bash
POST /api/search/reports
Body: { content, contentType, reportType, description }
Response: { id, analysis, message }

GET /api/search/top-reports?limit=20
Get most reported scams
```

### Statistics
```bash
GET /api/stats/stats
Response: { totalReports, avgRiskScore, recentReports, ... }
```

### Health
```bash
GET /api/health
Response: { status: "ok", timestamp }
```

## 📦 npm Scripts

```bash
npm run dev      # Start dev server (React + Express)
npm run build    # Build for production
npm run start    # Run production build
npm run check    # TypeScript type checking
npm run db:push  # Apply database migrations
```

## 🌍 Deployment

### Quick Deploy (Vercel)

```bash
# Push to GitHub
git push origin main

# Connect to Vercel: vercel.com → Add Project
# Set env var: OPENAI_API_KEY
# Auto-deploys on push
```

### Self-Hosted (Docker)

```bash
docker build -t scamshield .
docker run -p 5000:5000 -e OPENAI_API_KEY=sk-... scamshield
```

See `DEPLOYMENT.md` for more platforms.

## 🎯 Next Steps (Enterprise Version)

After this light version works:

1. **User Accounts** - Authentication & personal history
2. **Advanced Analysis** - Image scam detection, file analysis
3. **Real-time Data** - Carrier API integration, live feeds
4. **Scale** - Move to PostgreSQL for millions of records
5. **Mobile** - React Native app for iOS/Android
6. **Business API** - For enterprise integration

## ❓ Troubleshooting

**"Cannot find module '@/components'"**
- Check tsconfig.json paths
- Run `npm install`

**"sqlite.db is locked"**
- Only one server instance allowed
- Kill any lingering node processes

**"OPENAI_API_KEY not found"**
- App will use heuristic analysis (falls back gracefully)
- Add key to .env for full AI capabilities

**"Port 5000 already in use"**
```bash
PORT=3000 npm run start
```

**Build fails with TypeScript errors**
```bash
npm run check
# Fix errors then rebuild
npm run build
```

## 📝 Development Tips

### Adding a New API Endpoint

1. Create route in `server/routes/`
2. Export from route file
3. Mount in `server/index.ts`:
   ```typescript
   app.use("/api/new", newRoutes);
   ```

### Adding a New UI Component

1. Create `.tsx` in `client/src/components/`
2. Import in page: `import { Component } from "@/components/Component"`
3. Use Tailwind CSS for styling

### Testing the API

```bash
# Search
curl -X POST http://localhost:5000/api/search/search \
  -H "Content-Type: application/json" \
  -d '{"content":"1-800-0000001","type":"phone"}'

# Stats
curl http://localhost:5000/api/stats/stats
```

## 📚 Resources

- [OpenAI API](https://platform.openai.com/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Express.js](https://expressjs.com/)
- [React](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)

---

**Questions?** Check README.md or open a GitHub issue.

**Ready to deploy?** See DEPLOYMENT.md for step-by-step instructions.
