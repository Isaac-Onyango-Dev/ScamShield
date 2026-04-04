# ScamShield - AI-Powered Scam Detection

A lightweight, open-source web application that uses AI and community data to detect and report scams, fraud, and phishing attempts.

## Features

✅ **AI-Powered Analysis** - Uses OpenAI to analyze suspicious content for scam indicators
✅ **Community Reports** - Build a growing database of reported scams and fraud
✅ **Lookups.io-Style UI** - Clean, intuitive search interface for quick lookups
✅ **SQLite Database** - No external database setup required, works offline
✅ **Easy Deployment** - Deploy from GitHub with zero configuration
✅ **Type-Safe** - Full TypeScript from frontend to backend
✅ **Real-Time Analysis Cache** - Fast repeat lookups with intelligent caching

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Express.js + TypeScript
- **Database**: SQLite + Drizzle ORM
- **AI**: OpenAI GPT-4o (with heuristic fallback)
- **State Management**: TanStack Query

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- OpenAI API key (optional - heuristic analysis works without it)

### Local Development

1. **Clone and install**
   ```bash
   git clone https://github.com/yourusername/ScamShield.git
   cd ScamShield
   npm install
   ```

2. **Setup environment**
   ```bash
   cp .env.example .env
   # Edit .env and add your OpenAI API key (optional)
   ```

3. **Run development server**
   ```bash
   npm run dev
   ```
   Opens at `http://localhost:5000`

4. **Type checking**
   ```bash
   npm run check
   ```

### Production Build

```bash
npm run build
npm run start
```

## Deployment

### GitHub Pages + Vercel

1. Build: `npm run build`
2. Deploy the `/dist` folder to Vercel
3. Set environment variable `OPENAI_API_KEY` in Vercel dashboard

### Self-Hosted

```bash
npm run build
npm run start
PORT=3000 node dist/index.js
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build
EXPOSE 5000
CMD ["npm", "run", "start"]
```

## Environment Variables

```env
# Add to .env
OPENAI_API_KEY=sk-... # Optional - app works without it
DATABASE_URL=sqlite.db # Path to SQLite database
PORT=5000 # Server port
NODE_ENV=production # or development
```

## API Endpoints

### Search/Analyze
- `POST /api/search/search` - Analyze content for scam indicators
- `GET /api/search/:content?type=phone` - Legacy quick lookup

### Community Reports
- `POST /api/search/reports` - Submit a scam report
- `GET /api/search/top-reports?limit=20` - Get top reported scams

### Stats
- `GET /api/stats/stats` - Dashboard statistics

## How It Works

1. **Input**: User enters phone, email, domain, IP, or text
2. **Auto-Detection**: System detects content type automatically
3. **Analysis**: AI checks for fraud patterns + community data
4. **Results**: Risk score (0-100) + recommendations + community insights
5. **Caching**: Results cached for 30 days to speed up repeat lookups

## Community Database

The SQLite database stores:
- **Scam Reports**: User-submitted reports with risk scores
- **Analysis Cache**: AI analysis results for faster lookups
- **Statistics**: Aggregate data for dashboard
- **Known Scams**: Pre-populated database of famous scam numbers/emails

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Add AI analysis rules to `server/services/openai.ts`
4. Commit changes (`git commit -m 'Add amazing feature'`)
5. Push to branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## Roadmap (v1.0 → Enterprise)

**MVP (Current)**
- ✅ AI analysis + community DB
- ✅ SQLite database
- ✅ Search UI

**v1.1 (Next)**
- [ ] User accounts & authentication
- [ ] Advanced reporting system
- [ ] Image scam detection
- [ ] Batch API for businesses

**Enterprise Version**
- [ ] PostgreSQL/MongoDB for scale
- [ ] Real-time data feeds from carriers
- [ ] Reverse lookup API integration
- [ ] Mobile app SDK
- [ ] Multi-language support

## Limitations

- **Data**: Community-based; limited to reported scams until scale grows
- **Accuracy**: AI analysis is heuristic-based without real-time carrier data
- **Rate Limits**: No built-in rate limiting in light version
- **Scale**: SQLite works for 100K+ records; use PostgreSQL for millions

## License

MIT - See LICENSE file

## Disclaimer

ScamShield is a community tool for educational purposes. While we strive for accuracy, we cannot guarantee all results. Always verify suspicious contact before taking action. For fraud, contact local authorities.

## Support

- 📧 Email: support@scamshield.app
- 🐛 Issues: GitHub Issues
- 💬 Discussions: GitHub Discussions
- 📖 Docs: See wiki

## Acknowledgments

Inspired by Lookups.io, Truecaller, and the FTC's fraud prevention efforts.

---

**Built with ❤️ for a safer internet**
