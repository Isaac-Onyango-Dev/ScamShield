import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";

const TARGET_ENUM = ["phone", "email", "domain", "ip", "text", "url"] as const;

// Aggregated community reports: one row per (content_type, content).
export const scamReports = sqliteTable(
    "scam_reports",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        contentType: text("content_type", { enum: TARGET_ENUM }).notNull(),
        content: text("content").notNull(), // normalized target value
        reportType: text("report_type").notNull(), // most recent category
        description: text("description"),
        riskScore: real("risk_score").default(0),
        reportCount: integer("report_count").default(1),
        verified: integer("verified").default(0),
        createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()),
        updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()),
        tags: text("tags"),
        metadata: text("metadata"),
    },
    (table) => [index("scam_reports_lookup_idx").on(table.contentType, table.content)],
);

// Individual report submissions (audit trail, 24h stats, per-reporter dedupe).
export const reportEvents = sqliteTable(
    "report_events",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        reportId: integer("report_id")
            .notNull()
            .references(() => scamReports.id, { onDelete: "cascade" }),
        category: text("category").notNull(),
        description: text("description"),
        reporterHash: text("reporter_hash").notNull(),
        createdAt: integer("created_at", { mode: "timestamp_ms" })
            .notNull()
            .$defaultFn(() => new Date()),
    },
    (table) => [
        index("report_events_report_idx").on(table.reportId),
        index("report_events_created_idx").on(table.createdAt),
        uniqueIndex("report_events_reporter_uidx").on(table.reportId, table.reporterHash),
    ],
);

// Full lookup reports, keyed by sha256(type:normalized). Short-lived by design.
export const lookupCache = sqliteTable(
    "lookup_cache",
    {
        key: text("key").primaryKey(),
        targetType: text("target_type").notNull(),
        report: text("report").notNull(),
        createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
        expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    },
    (table) => [index("lookup_cache_expires_idx").on(table.expiresAt)],
);

export const statistics = sqliteTable(
    "statistics",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        metric: text("metric").notNull().unique(),
        value: integer("value").notNull().default(0),
        updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()),
    },
    (table) => [index("metric_idx").on(table.metric)],
);

// Curated indicators known to be malicious (seeded + extendable).
export const commonScams = sqliteTable(
    "common_scams",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        content: text("content").notNull(),
        contentType: text("content_type", { enum: TARGET_ENUM }).notNull(),
        category: text("category").notNull(),
        isKnownScam: integer("is_known_scam").default(1),
        source: text("source"),
        createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()),
    },
    (table) => [uniqueIndex("common_scams_content_uidx").on(table.contentType, table.content)],
);
