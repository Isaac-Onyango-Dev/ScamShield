import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { createApiRouter, type ApiDeps } from "./routes/api";
import { errorMessage, logger } from "./logger";

export function createApp(deps: ApiDeps) {
    const app = express();
    app.disable("x-powered-by");
    app.set("trust proxy", deps.config.TRUST_PROXY);

    app.use(
        helmet({
            contentSecurityPolicy: {
                useDefaults: true,
                directives: {
                    // Avatars/linked images come from third-party OSINT sources.
                    "img-src": ["'self'", "data:", "https:"],
                    "connect-src": ["'self'"],
                    "script-src": ["'self'"],
                    "style-src": ["'self'", "'unsafe-inline'"],
                    "upgrade-insecure-requests": deps.config.NODE_ENV === "production" ? [] : null,
                },
            },
            crossOriginEmbedderPolicy: false,
            referrerPolicy: { policy: "no-referrer" },
        }),
    );
    app.use(express.json({ limit: "32kb" }));

    app.use("/api", (req, res, next) => {
        const started = Date.now();
        res.on("finish", () => {
            // Never log query strings: they contain the looked-up emails/phones.
            logger.info("request", { method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - started });
        });
        next();
    });
    app.use("/api", createApiRouter(deps));

    app.use((err: Error & { status?: number; type?: string }, _req: Request, res: Response, _next: NextFunction) => {
        if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Malformed JSON body" });
        if (err.type === "entity.too.large") return res.status(413).json({ error: "Request body too large" });
        logger.error("unhandled error", { error: errorMessage(err) });
        res.status(500).json({ error: "Internal server error" });
    });

    return app;
}
