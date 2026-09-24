import { and, desc, eq, gte, sql, count } from "drizzle-orm";
import crypto from "node:crypto";
import type { DB } from "./db";
import { commonScams, reportEvents, scamReports, statistics } from "../../shared/schema";
import type { DashboardStats, ReportCategory, TargetType } from "../../shared/types";

export interface CommunityRecord {
    reports: {
        count: number;
        lastReportedAt: string | null;
        categories: Record<string, number>;
        recent: { category: string; description: string | null; createdAt: string }[];
    } | null;
    known: { category: string; source: string | null } | null;
}

export interface CommunityStore {
    lookup(type: TargetType, value: string): Promise<CommunityRecord>;
}

export function hashReporter(ip: string, salt: string): string {
    return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

function iso(d: Date | null | undefined): string | null {
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
}

export function createCommunityStore(db: DB) {
    const store = {
        async lookup(type: TargetType, value: string): Promise<CommunityRecord> {
            const known = db
                .select({ category: commonScams.category, source: commonScams.source })
                .from(commonScams)
                .where(and(eq(commonScams.contentType, type), eq(commonScams.content, value)))
                .get();

            const report = db
                .select()
                .from(scamReports)
                .where(and(eq(scamReports.contentType, type), eq(scamReports.content, value)))
                .get();

            if (!report) return { reports: null, known: known ?? null };

            const events = db
                .select()
                .from(reportEvents)
                .where(eq(reportEvents.reportId, report.id))
                .orderBy(desc(reportEvents.createdAt))
                .all();

            const categories: Record<string, number> = {};
            for (const e of events) categories[e.category] = (categories[e.category] ?? 0) + 1;
            if (!events.length) categories[report.reportType] = report.reportCount ?? 1;

            return {
                known: known ?? null,
                reports: {
                    count: Math.max(report.reportCount ?? 0, events.length),
                    lastReportedAt: iso(events[0]?.createdAt ?? report.updatedAt),
                    categories,
                    recent: events.slice(0, 5).map((e) => ({
                        category: e.category,
                        description: e.description,
                        createdAt: e.createdAt.toISOString(),
                    })),
                },
            };
        },

        /**
         * Records a report. One report per reporter per target: a repeat
         * submission updates nothing and returns `duplicate: true`.
         */
        submit(input: {
            type: TargetType;
            value: string;
            category: ReportCategory;
            description?: string;
            reporterHash: string;
        }): { id: number; duplicate: boolean; count: number } {
            return db.transaction((tx) => {
                const now = new Date();
                let report = tx
                    .select()
                    .from(scamReports)
                    .where(and(eq(scamReports.contentType, input.type), eq(scamReports.content, input.value)))
                    .get();

                if (!report) {
                    report = tx
                        .insert(scamReports)
                        .values({
                            contentType: input.type,
                            content: input.value,
                            reportType: input.category,
                            description: input.description,
                            reportCount: 0,
                            createdAt: now,
                            updatedAt: now,
                        })
                        .returning()
                        .get();
                }

                const inserted = tx
                    .insert(reportEvents)
                    .values({
                        reportId: report.id,
                        category: input.category,
                        description: input.description,
                        reporterHash: input.reporterHash,
                        createdAt: now,
                    })
                    .onConflictDoNothing()
                    .returning()
                    .all();

                if (!inserted.length) {
                    return { id: report.id, duplicate: true, count: report.reportCount ?? 0 };
                }

                const updated = tx
                    .update(scamReports)
                    .set({
                        reportCount: sql`${scamReports.reportCount} + 1`,
                        reportType: input.category,
                        description: input.description ?? report.description,
                        updatedAt: now,
                    })
                    .where(eq(scamReports.id, report.id))
                    .returning({ count: scamReports.reportCount })
                    .get();

                bumpStat(tx as unknown as DB, "total_reports");
                return { id: report.id, duplicate: false, count: updated?.count ?? 1 };
            });
        },

        stats(): DashboardStats {
            const metric = (name: string) =>
                db.select({ value: statistics.value }).from(statistics).where(eq(statistics.metric, name)).get()?.value ??
                0;
            const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const reportsLast24h =
                db.select({ n: count() }).from(reportEvents).where(gte(reportEvents.createdAt, since)).get()?.n ?? 0;
            const totalReports =
                db
                    .select({ n: sql<number>`coalesce(sum(${scamReports.reportCount}), 0)` })
                    .from(scamReports)
                    .get()?.n ?? 0;
            const knownScams = db.select({ n: count() }).from(commonScams).get()?.n ?? 0;
            const topCategories = db
                .select({ category: reportEvents.category, count: count() })
                .from(reportEvents)
                .groupBy(reportEvents.category)
                .orderBy(desc(count()))
                .limit(5)
                .all();
            return {
                totalLookups: metric("total_lookups"),
                totalReports: Number(totalReports),
                reportsLast24h,
                knownScams,
                topCategories,
            };
        },

        bumpStat(name: string) {
            bumpStat(db, name);
        },
    };
    return store;
}

export type CommunityService = ReturnType<typeof createCommunityStore>;

function bumpStat(db: DB, name: string) {
    db.insert(statistics)
        .values({ metric: name, value: 1, updatedAt: new Date() })
        .onConflictDoUpdate({
            target: statistics.metric,
            set: { value: sql`${statistics.value} + 1`, updatedAt: new Date() },
        })
        .run();
}
