import { z } from "zod";
import { resolveSiteUrl } from "./lib/siteUrl";

const optional = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().optional());

const schema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().positive().default(5000),
    DATABASE_URL: z.string().default("sqlite.db"),
    /** Number of reverse proxies in front of the app (Render/Fly/Heroku = 1). */
    TRUST_PROXY: z.coerce.number().int().min(0).default(1),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

    // Optional integrations — every one of them degrades gracefully when unset.
    OPENAI_API_KEY: optional,
    OPENAI_MODEL: z.string().default("gpt-4o-mini"),
    HIBP_API_KEY: optional,
    GOOGLE_SAFE_BROWSING_KEY: optional,
    URLHAUS_AUTH_KEY: optional,
    ABUSEIPDB_API_KEY: optional,
    GITHUB_TOKEN: optional,
    GRAVATAR_API_KEY: optional,

    DEFAULT_PHONE_REGION: z.string().length(2).toUpperCase().default("US"),
    DNS_SERVERS: optional,
    LOOKUP_CACHE_TTL_MINUTES: z.coerce.number().int().min(0).default(360),
    CHECK_TIMEOUT_MS: z.coerce.number().int().min(500).default(8000),
    RATE_LIMIT_LOOKUPS_PER_MINUTE: z.coerce.number().int().min(1).default(20),
    RATE_LIMIT_REPORTS_PER_HOUR: z.coerce.number().int().min(1).default(10),
    /** Public origin for absolute og:url/og:image; required in production (falls back to RENDER_EXTERNAL_URL). */
    SITE_URL: optional,
    RENDER_EXTERNAL_URL: optional,
    /** Declare that DATABASE_URL is on persistent storage; otherwise the UI says reports are temporary. */
    STORAGE_PERSISTENT: z.preprocess((v) => (typeof v === "string" ? ["1", "true", "yes"].includes(v.trim().toLowerCase()) : v), z.boolean().default(false)),
    /** Salt for hashing reporter IPs. Set a long random value in production. */
    REPORTER_SALT: z.string().default("scamshield-dev-salt"),
});

export type AppConfig = Omit<z.infer<typeof schema>, "SITE_URL"> & { SITE_URL: string };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
    const parsed = schema.safeParse(env);
    if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
        throw new Error(`Invalid configuration: ${issues}`);
    }
    try {
        return { ...parsed.data, SITE_URL: resolveSiteUrl(parsed.data) };
    } catch (err) {
        throw new Error(`Invalid configuration: ${(err as Error).message}`);
    }
}

export const config = loadConfig();
