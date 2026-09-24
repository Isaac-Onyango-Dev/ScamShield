import { commonScams } from "../shared/schema";
import type { DB } from "./lib/db";
import { normalizePhone } from "./checks/phone";

/**
 * Curated demo indicators. Idempotent: safe to run on every boot.
 * Phone numbers are stored in E.164 so they match normalized lookups.
 */
const KNOWN_SCAMS = [
    { content: "1-800-000-0001", contentType: "phone", category: "IRS impersonation", source: "Demo seed" },
    { content: "1-888-123-4567", contentType: "phone", category: "Tech support scam", source: "Demo seed" },
    { content: "noreply@paypal-security.com", contentType: "email", category: "Phishing", source: "Demo seed" },
    { content: "verify.account@microsoft-security.net", contentType: "email", category: "Account verification phishing", source: "Demo seed" },
    { content: "amazon-verify.com", contentType: "domain", category: "Phishing", source: "Demo seed" },
    { content: "paypal-security.com", contentType: "domain", category: "Phishing", source: "Demo seed" },
] as const;

export function seed(db: DB) {
    const rows = KNOWN_SCAMS.map((s) => ({
        ...s,
        content: s.contentType === "phone" ? normalizePhone(s.content, "US") : s.content,
        isKnownScam: 1,
    }));
    const inserted = db.insert(commonScams).values(rows).onConflictDoNothing().returning().all();
    return inserted.length;
}
