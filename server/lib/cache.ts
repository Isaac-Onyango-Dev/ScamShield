import crypto from "crypto";
import { db } from "./db";
import { analysisCache } from "../../shared/schema";
import { eq } from "drizzle-orm";

export function hashContent(content: string): string {
    return crypto.createHash("md5").update(content).digest("hex");
}

export async function getCachedAnalysis(content: string) {
    const hash = hashContent(content);

    try {
        const cached = await db.query.analysisCache.findFirst({
            where: eq(analysisCache.contentHash, hash),
        });

        if (cached && (!cached.expiresAt || cached.expiresAt > new Date())) {
            return JSON.parse(cached.analysis);
        }

        // Delete expired cache
        if (cached?.expiresAt && cached.expiresAt < new Date()) {
            // Delete would go here
        }
    } catch (error) {
        console.error("Cache retrieval error:", error);
    }

    return null;
}

export async function cacheAnalysis(
    content: string,
    contentType: string,
    analysis: any,
    expirationDays: number = 30
) {
    const hash = hashContent(content);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expirationDays);

    try {
        await db.insert(analysisCache).values({
            contentHash: hash,
            content,
            contentType: contentType as any,
            riskScore: analysis.riskScore,
            riskLevel: analysis.riskLevel,
            analysis: JSON.stringify(analysis),
            reasoning: analysis.reasoning,
            expiresAt,
        });
    } catch (error) {
        console.error("Cache storage error:", error);
    }
}
