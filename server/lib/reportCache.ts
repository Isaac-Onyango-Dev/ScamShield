import crypto from "node:crypto";
import { eq, lt } from "drizzle-orm";
import type { DB } from "./db";
import { lookupCache } from "../../shared/schema";
import type { LookupReport, Target } from "../../shared/types";

export function cacheKey(target: Pick<Target, "type" | "normalized">): string {
    return crypto.createHash("sha256").update(`${target.type}:${target.normalized}`).digest("hex");
}

export interface ReportCache {
    get(target: Target): LookupReport | null;
    set(target: Target, report: LookupReport, ttlMinutes: number): void;
    invalidate(target: Pick<Target, "type" | "normalized">): void;
    purgeExpired(): number;
}

export function createReportCache(db: DB): ReportCache {
    return {
        get(target) {
            const row = db.select().from(lookupCache).where(eq(lookupCache.key, cacheKey(target))).get();
            if (!row) return null;
            if (row.expiresAt.getTime() <= Date.now()) {
                db.delete(lookupCache).where(eq(lookupCache.key, row.key)).run();
                return null;
            }
            return JSON.parse(row.report) as LookupReport;
        },
        set(target, report, ttlMinutes) {
            if (ttlMinutes <= 0) return;
            const now = new Date();
            const values = {
                key: cacheKey(target),
                targetType: target.type,
                report: JSON.stringify(report),
                createdAt: now,
                expiresAt: new Date(now.getTime() + ttlMinutes * 60_000),
            };
            db.insert(lookupCache).values(values).onConflictDoUpdate({ target: lookupCache.key, set: values }).run();
        },
        invalidate(target) {
            db.delete(lookupCache).where(eq(lookupCache.key, cacheKey(target))).run();
        },
        purgeExpired() {
            return db.delete(lookupCache).where(lt(lookupCache.expiresAt, new Date())).run().changes;
        },
    };
}
