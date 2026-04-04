import express, { Request, Response } from "express";
import { db } from "../lib/db";
import { scamReports, commonScams, statistics } from "../../shared/schema";
import { analyzeContent } from "../services/openai";
import { getCachedAnalysis, cacheAnalysis } from "../lib/cache";
import { desc, eq, or, sql } from "drizzle-orm";
import type { ContentType, ReportType } from "../../shared/types";

const router = express.Router();

// POST /api/search - Analyze and search content
router.post("/search", async (req: Request, res: Response) => {
    try {
        const { content, type } = req.body;

        if (!content || !type) {
            res.status(400).json({ error: "Content and type required" });
            return;
        }

        const contentType = type as ContentType;

        // Check cache first
        let cachedAnalysis = await getCachedAnalysis(content);

        let analysisResult = cachedAnalysis;
        if (!analysisResult) {
            // Run AI analysis
            analysisResult = await analyzeContent(content, contentType);

            // Cache the result
            await cacheAnalysis(
                content,
                contentType,
                analysisResult,
                30 // 30 day cache
            );
        }

        // Search community database
        const communityReports = await db
            .select()
            .from(scamReports)
            .where(eq(scamReports.content, content))
            .all();

        const commonScamRecord = await db
            .select()
            .from(commonScams)
            .where(eq(commonScams.content, content))
            .all();

        // Aggregate results
        const reportCount = communityReports.length;
        const aggregatedRiskScore =
            reportCount > 0
                ? Math.min(
                    100,
                    (analysisResult.riskScore * 0.6 + (reportCount / 10) * 40)
                )
                : analysisResult.riskScore;

        res.json({
            content,
            type: contentType,
            analysis: {
                ...analysisResult,
                riskScore: aggregatedRiskScore,
            },
            communityReports: {
                count: reportCount,
                reports: communityReports.slice(0, 5),
                isKnownScam: commonScamRecord.length > 0,
            },
            cached: !!cachedAnalysis,
        });
    } catch (error) {
        console.error("Search error:", error);
        res.status(500).json({ error: "Analysis failed" });
    }
});

// GET /api/search/:content - Quick lookup
router.get("/search/:content", async (req: Request, res: Response) => {
    try {
        const { content } = req.params;
        const { type } = req.query;

        if (!type) {
            res.status(400).json({ error: "Type parameter required" });
            return;
        }

        const reports = await db
            .select()
            .from(scamReports)
            .where(eq(scamReports.content, content))
            .all();

        res.json({
            content,
            type,
            reportCount: reports.length,
            reports: reports.slice(0, 10),
        });
    } catch (error) {
        console.error("Lookup error:", error);
        res.status(500).json({ error: "Lookup failed" });
    }
});

// POST /api/reports - Submit a scam report
router.post("/reports", async (req: Request, res: Response) => {
    try {
        const { content, contentType, reportType, description } = req.body;

        if (!content || !contentType || !reportType) {
            res.status(400).json({ error: "Missing required fields" });
            return;
        }

        // Check if already exists
        const existing = await db
            .select()
            .from(scamReports)
            .where(
                sql`${scamReports.content} = ${content} AND ${scamReports.contentType} = ${contentType}`
            )
            .all();

        if (existing.length > 0) {
            // Increment count
            await db
                .update(scamReports)
                .set({ reportCount: (existing[0].reportCount || 0) + 1 })
                .where(eq(scamReports.id, existing[0].id));

            res.json({
                id: existing[0].id,
                message: "Report count increased",
            });
        } else {
            // Create new report
            const analysis = await analyzeContent(
                content,
                contentType as ContentType
            );

            const result = await db
                .insert(scamReports)
                .values({
                    content,
                    contentType: contentType as ContentType,
                    reportType: reportType as ReportType,
                    description,
                    riskScore: analysis.riskScore,
                    reportCount: 1,
                    tags: JSON.stringify(analysis.details.indicators || []),
                    metadata: JSON.stringify(analysis.details),
                })
                .returning();

            // Update statistics
            updateStats("total_reports", 1);

            res.json({
                id: result[0]?.id,
                message: "Report submitted",
                analysis,
            });
        }
    } catch (error) {
        console.error("Report error:", error);
        res.status(500).json({ error: "Report submission failed" });
    }
});

// GET /api/top-reports - Get top reported scams
router.get("/top-reports", async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 20;

        const topReports = await db
            .select()
            .from(scamReports)
            .orderBy(desc(scamReports.reportCount))
            .limit(limit)
            .all();

        res.json(topReports);
    } catch (error) {
        console.error("Top reports error:", error);
        res.status(500).json({ error: "Failed to fetch top reports" });
    }
});

// Helper function to update statistics
async function updateStats(metric: string, increment: number = 1) {
    try {
        const existing = await db
            .select()
            .from(statistics)
            .where(eq(statistics.metric, metric))
            .all();

        if (existing.length > 0) {
            await db
                .update(statistics)
                .set({ value: existing[0].value + increment })
                .where(eq(statistics.metric, metric));
        } else {
            await db.insert(statistics).values({
                metric,
                value: increment,
            });
        }
    } catch (error) {
        console.error("Stats update error:", error);
    }
}

export default router;
