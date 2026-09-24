import OpenAI from "openai";
import type { CheckResult, LookupSummary, Target, Verdict } from "../../shared/types";
import type { AppConfig } from "../config";
import { logger, errorMessage } from "../logger";

const TYPE_NOUN: Record<Target["type"], string> = {
    email: "email address",
    domain: "domain",
    url: "link",
    ip: "IP address",
    phone: "phone number",
    text: "message",
};

function recommendations(target: Target, verdict: Verdict, checks: CheckResult[]): string[] {
    const recs: string[] = [];
    const high = verdict.level === "high" || verdict.level === "critical";
    const noun = TYPE_NOUN[target.type];
    if (high) {
        if (target.type === "url" || target.type === "domain") recs.push("Do not open this site or enter any credentials or payment details.");
        if (target.type === "email") recs.push("Do not reply, click links or open attachments from this sender.");
        if (target.type === "phone") recs.push("Don't call back or share codes; block the number.");
        if (target.type === "text") recs.push("Do not follow instructions in this message, click its links, or send money.");
        recs.push(`Report the ${noun} to your provider and local fraud authority, and submit a ScamShield report to warn others.`);
    } else if (verdict.level === "medium") {
        recs.push(`Treat this ${noun} with caution and verify it through an official channel you find yourself.`);
    } else {
        recs.push(`No strong red flags — but still verify unexpected requests for money or credentials independently.`);
    }
    if (checks.some((c) => c.id === "email.infostealer" && c.status === "danger")) {
        recs.push("If this is your address: change passwords everywhere, enable 2FA and scan your devices for malware.");
    }
    if (checks.some((c) => (c.id === "email.breaches" || c.id === "email.hibp") && c.status === "found")) {
        recs.push("If this is your address: make sure none of the breached passwords are still in use.");
    }
    if (verdict.confidence < 0.6) recs.push("Several sources were unavailable — re-run the lookup later for a more complete picture.");
    return recs;
}

export function rulesSummary(target: Target, verdict: Verdict, checks: CheckResult[]): LookupSummary {
    const noun = TYPE_NOUN[target.type];
    const risks = verdict.topSignals.slice(0, 3).map((s) => s.label.replace(/\.$/, ""));
    const trusts = verdict.trustSignals.slice(0, 2).map((s) => s.label.replace(/\.$/, ""));
    const found = checks.filter((c) => c.status === "found").map((c) => c.name.toLowerCase());
    const parts: string[] = [];
    parts.push(`Risk score ${verdict.score}/100 — ${verdict.label.toLowerCase()} for this ${noun}.`);
    if (risks.length) parts.push(`Main concerns: ${risks.join("; ")}.`);
    if (trusts.length) parts.push(`In its favour: ${trusts.join("; ")}.`);
    if (found.length) parts.push(`Public footprint found in: ${found.join(", ")}.`);
    return { text: parts.join(" "), recommendations: recommendations(target, verdict, checks), generatedBy: "rules" };
}

export type Summarizer = (target: Target, verdict: Verdict, checks: CheckResult[]) => Promise<LookupSummary>;

/** Uses an LLM to explain the (deterministic) findings in plain language. The score is never changed by the model. */
export function createSummarizer(config: AppConfig): Summarizer {
    if (!config.OPENAI_API_KEY) return async (t, v, c) => rulesSummary(t, v, c);
    const client = new OpenAI({ apiKey: config.OPENAI_API_KEY, timeout: 15_000, maxRetries: 1 });

    return async (target, verdict, checks) => {
        const fallback = rulesSummary(target, verdict, checks);
        const evidence = checks
            .filter((c) => c.status !== "skipped" && c.category !== "pivots")
            .map((c) => ({ source: c.name, status: c.status, summary: c.summary, signals: c.signals.map((s) => `${s.kind}:${s.severity}:${s.label}`) }));
        try {
            const res = await client.chat.completions.create({
                model: config.OPENAI_MODEL,
                temperature: 0.2,
                response_format: { type: "json_object" },
                messages: [
                    {
                        role: "system",
                        content:
                            "You are a fraud analyst writing for non-technical people. Explain the evidence you are given; never invent findings, never contradict the risk score, and never speculate about a private person's identity. Reply as JSON: {\"summary\": string (3-5 sentences), \"recommendations\": string[] (2-4 concrete actions)}.",
                    },
                    {
                        role: "user",
                        content: JSON.stringify({
                            target: { type: target.type, value: target.type === "text" ? target.normalized.slice(0, 1500) : target.normalized },
                            riskScore: verdict.score,
                            verdict: verdict.label,
                            confidence: verdict.confidence,
                            evidence,
                        }),
                    },
                ],
            });
            const parsed = JSON.parse(res.choices[0]?.message?.content ?? "{}") as { summary?: unknown; recommendations?: unknown };
            if (typeof parsed.summary !== "string" || !parsed.summary.trim()) return fallback;
            const recs = Array.isArray(parsed.recommendations) ? parsed.recommendations.filter((r): r is string => typeof r === "string") : [];
            return { text: parsed.summary.trim(), recommendations: recs.length ? recs.slice(0, 4) : fallback.recommendations, generatedBy: "ai" };
        } catch (err) {
            logger.warn("AI summary failed, using rules summary", { error: errorMessage(err) });
            return fallback;
        }
    };
}
