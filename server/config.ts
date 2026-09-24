import { z } from "zod";

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
    /** Salt for hashing reporter IPs. Set a long random value in production. */
    REPORTER_SALT: z.string().default("scamshield-dev-salt"),
});

export type AppConfig = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
    const parsed = schema.safeParse(env);
    if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
        throw new Error(`Invalid configuration: ${issues}`);
    }
    return parsed.data;
}

export const config = loadConfig();
