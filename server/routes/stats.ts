import express, { Request, Response } from "express";
import { db } from "../lib/db";
import { scamReports, statistics } from "../../shared/schema";
import { avg, count, desc, sql } from "drizzle-orm";

const router = express.Router();

// GET /api/stats - Dashboard statistics
router.get("/stats", async (req: Request, res: Response) => {
    try {
        // Get aggregate stats
        const reportStats = await db
            .select({
                total: count(),
                avgRisk: avg(scamReports.riskScore),
            })
            .from(scamReports)
            .all();

        // Get stats from statistics table
        const statsData = await db.select().from(statistics).all();

        const statMap: Record<string, number> = {};
        for (const stat of statsData) {
            statMap[stat.metric] = stat.value;
        }

        // Get recent reports (last 24 hours)
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentReportsCount = await db
            .select({ count: count() })
            .from(scamReports)
            .all();

        const topReportTypes = await getTopReportTypes();

        res.json({
            totalReports: reportStats[0]?.total || 0,
            totalAnalyses: statMap["total_analyses"] || 0,
            avgRiskScore: Math.round(Number(reportStats[0]?.avgRisk) || 0),
            recentReports: recentReportsCount[0]?.count || 0,
            topReportTypes,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error("Stats error:", error);
        res.status(500).json({ error: "Failed to fetch statistics" });
    }
});

async function getTopReportTypes() {
    try {
        return await db
            .select({
                type: scamReports.reportType,
                count: count().as("count"),
            })
            .from(scamReports)
            .groupBy(scamReports.reportType)
            .orderBy(desc(count()))
            .limit(5)
            .all();
    } catch {
        return [];
    }
}

export default router;
