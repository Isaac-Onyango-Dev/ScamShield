import { config } from "./config";

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof LEVELS;

/** Minimal structured logger: JSON lines in production, readable lines in development. */
function write(level: Level, msg: string, meta?: Record<string, unknown>) {
    if (LEVELS[level] < LEVELS[config.LOG_LEVEL] || config.NODE_ENV === "test") return;
    const stream = level === "error" || level === "warn" ? process.stderr : process.stdout;
    if (config.NODE_ENV === "production") {
        stream.write(JSON.stringify({ ts: new Date().toISOString(), level, msg, ...meta }) + "\n");
    } else {
        stream.write(`[${level}] ${msg}${meta ? " " + JSON.stringify(meta) : ""}\n`);
    }
}

export const logger = {
    debug: (msg: string, meta?: Record<string, unknown>) => write("debug", msg, meta),
    info: (msg: string, meta?: Record<string, unknown>) => write("info", msg, meta),
    warn: (msg: string, meta?: Record<string, unknown>) => write("warn", msg, meta),
    error: (msg: string, meta?: Record<string, unknown>) => write("error", msg, meta),
};

export function errorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
}
