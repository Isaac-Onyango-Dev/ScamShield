#!/usr/bin/env node
/**
 * Simple seed script to populate demo data into SQLite
 * Run: npx tsx server/seed.ts
 */

import { db } from "./lib/db";
import { commonScams, scamReports, statistics } from "../shared/schema";

export async function seed() {
    console.log("🌱 Seeding demo data...");

    // Common known scam numbers/emails
    const knownScams = [
        {
            content: "1-800-000-0001",
            contentType: "phone" as const,
            category: "IRS Scam",
            source: "FTC",
        },
        {
            content: "noreply@paypal-security.com",
            contentType: "email" as const,
            category: "Phishing",
            source: "Community",
        },
        {
            content: "amazon-verify.com",
            contentType: "domain" as const,
            category: "Phishing",
            source: "BBB",
        },
        {
            content: "1-888-123-4567",
            contentType: "phone" as const,
            category: "Tech Support Scam",
            source: "FTC",
        },


        {
            content: "verify.account@microsoft-security.net",
            contentType: "email" as const,
            category: "Account Verification Scam",
            source: "Community",
        },
    ];

    for (const scam of knownScams) {
        try {
            await db.insert(commonScams).values({
                ...scam,
                isKnownScam: 1,
            });
            console.log(`✅ Added ${scam.content}`);
        } catch (error) {
            if ((error as any).message.includes("UNIQUE")) {
                console.log(`⏭️  Skipped ${scam.content} (already exists)`);
            } else {
                throw error;
            }
        }
    }

    // Initialize statistics
    const stats = [
        { metric: "total_reports", value: knownScams.length },
        { metric: "total_analyses", value: 0 },
    ];

    for (const stat of stats) {
        try {
            await db.insert(statistics).values(stat);
            console.log(`📊 Initialized ${stat.metric}`);
        } catch (error) {
            if ((error as any).message.includes("UNIQUE")) {
                console.log(`⏭️  ${stat.metric} already initialized`);
            }
        }
    }

    console.log("✅ Seeding complete!");
}

// Root execution check
if (import.meta.url.endsWith(process.argv[1])) {
    seed().catch((error) => {
        console.error("❌ Seeding failed:", error);
        process.exit(1);
    });
}
