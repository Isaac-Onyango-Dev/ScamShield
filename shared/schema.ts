import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real, primaryKey, index } from "drizzle-orm/sqlite-core";

// Scam Reports - community submitted reports
export const scamReports = sqliteTable("scam_reports", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    contentType: text("content_type", {
        enum: ["phone", "email", "domain", "ip", "text"],
    }).notNull(), // Type of content being reported
    content: text("content").notNull(), // Phone number, email, domain, IP, or text
    reportType: text("report_type", {
        enum: ["scam", "spam", "phishing", "fraud", "malware", "other"],
    }).notNull(),
    description: text("description"), // Optional user description
    riskScore: real("risk_score").default(0), // 0-100, calculated from AI analysis
    reportCount: integer("report_count").default(1), // Number of times reported
    verified: integer("verified").default(0), // Boolean: community verified as legitimate
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`),
    tags: text("tags"), // JSON array of tags ["malware", "phishing", etc]
    metadata: text("metadata"), // JSON: any additional data
});

// Analysis Cache - cache AI analysis results
export const analysisCache = sqliteTable(
    "analysis_cache",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        contentHash: text("content_hash").notNull().unique(), // Hash of analyzed content
        contentType: text("content_type", {
            enum: ["phone", "email", "domain", "ip", "text"],
        }).notNull(),
        content: text("content").notNull(),
        riskScore: real("risk_score").notNull(), // AI-generated risk score
        riskLevel: text("risk_level", {
            enum: ["safe", "low", "medium", "high", "critical"],
        }).notNull(),
        analysis: text("analysis").notNull(), // JSON: AI analysis results
        reasoning: text("reasoning"), // Why it got that score
        createdAt: integer("created_at", { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`),
        expiresAt: integer("expires_at", { mode: "timestamp" }), // Cache expiration
    },
    (table) => [
        index("content_hash_idx").on(table.contentHash),
    ]
);

// Users - optional, for tracking submissions
export const users = sqliteTable("users", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull().unique(),
    password: text("password").notNull(),
    email: text("email"),
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`),
});

// Statistics - Dashboard stats
export const statistics = sqliteTable(
    "statistics",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        metric: text("metric").notNull().unique(), // Key: "total_reports", "total_analyses", etc
        value: integer("value").notNull().default(0),
        updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`),
    },
    (table) => [
        index("metric_idx").on(table.metric),
    ]
);

// Common Scam Numbers/Emails - Pre-populated database
export const commonScams = sqliteTable("common_scams", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    content: text("content").notNull(),
    contentType: text("content_type", {
        enum: ["phone", "email", "domain", "ip"],
    }).notNull(),
    category: text("category").notNull(), // "IRS Scam", "Lottery Scam", "Tech Support", etc
    isKnownScam: integer("is_known_scam").default(1), // Boolean
    source: text("source"), // "FTC", "BBB", "Community", etc
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`),
});
