import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { initializeDatabase, db } from "./lib/db";
import { statistics } from "../shared/schema";
import { seed } from "./seed";
import searchRoutes from "./routes/search";
import statsRoutes from "./routes/stats";
import { count } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

import { migrate } from "drizzle-orm/better-sqlite3/migrator";

// Initialize database and auto-seed if empty
initializeDatabase();
(async () => {
    try {
        // Run migrations to ensure tables exist
        const migrationsPath = process.env.NODE_ENV === "production" 
            ? path.join(__dirname, "./migrations") 
            : path.join(__dirname, "../migrations");
            
        console.log(`🛠️ Verifying database schema at: ${migrationsPath}`);
        await migrate(db, { migrationsFolder: migrationsPath });
        
        // Check if seeding is needed
        const statsCount = await db.select({ value: count() }).from(statistics);
        if (statsCount[0].value === 0) {
            console.log("🌱 Empty database detected. Starting auto-seed...");
            await seed();
        }
    } catch (error) {
        console.error("❌ Startup process failed:", error);
    }
})();

// API Routes
app.use("/api/search", searchRoutes);
app.use("/api/stats", statsRoutes);

// Health check
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Serve React app
const clientPath = path.join(__dirname, "../dist/public");
app.use(express.static(clientPath));

// Fallback to index.html for React routing
app.get("*", (req, res) => {
    res.sendFile(path.join(clientPath, "index.html"));
});

// Error handling
app.use(
    (
        err: any,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) => {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
);

app.listen(PORT, () => {
    console.log(`🚀 ScamShield API running on http://localhost:${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
});
