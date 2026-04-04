import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { initializeDatabase } from "./lib/db";
import searchRoutes from "./routes/search";
import statsRoutes from "./routes/stats";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Initialize database
initializeDatabase();

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
