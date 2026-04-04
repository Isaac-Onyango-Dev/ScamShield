import OpenAI from "openai";

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "",
});

export interface AnalysisResult {
    riskScore: number; // 0-100
    riskLevel: "safe" | "low" | "medium" | "high" | "critical";
    isScam: boolean;
    reasoning: string;
    recommendations: string[];
    details: Record<string, unknown>;
}

export async function analyzeContent(
    content: string,
    type: "phone" | "email" | "domain" | "ip" | "text"
): Promise<AnalysisResult> {
    if (!process.env.OPENAI_API_KEY) {
        // Return mock analysis if no API key
        return getMockAnalysis(content, type);
    }

    const prompt = buildAnalysisPrompt(content, type);

    try {
        const response = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content:
                        "You are a fraud detection expert. Analyze the given content and provide a risk assessment. Return a JSON object with riskScore (0-100), riskLevel, isScam (boolean), reasoning, recommendations (array), and details (object).",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            response_format: { type: "json_object" },
            temperature: 0.3,
        });

        const content = response.choices[0].message.content;
        if (!content) throw new Error("No response from OpenAI");

        const result = JSON.parse(content);

        return {
            riskScore: Math.min(100, Math.max(0, result.riskScore || 0)),
            riskLevel: result.riskLevel || "medium",
            isScam: result.isScam || false,
            reasoning: result.reasoning || "",
            recommendations: result.recommendations || [],
            details: result.details || {},
        };
    } catch (error) {
        console.error("OpenAI analysis error:", error);
        // Fallback to mock analysis on error
        return getMockAnalysis(content, type);
    }
}

function buildAnalysisPrompt(content: string, type: string): string {
    const typeDescriptions = {
        phone: "phone number",
        email: "email address",
        domain: "domain/URL",
        ip: "IP address",
        text: "text content",
    };

    return `Analyze this ${typeDescriptions[type as keyof typeof typeDescriptions] || type} for fraud/scam indicators: "${content}"
  
  Consider patterns like:
  - Known scam number prefixes or patterns
  - Suspicious email domains or spoofing attempts
  - Phishing domains or lookalike URLs
  - Malicious IP addresses
  - Common scam language or urgency tactics
  
  Respond with JSON: {
    "riskScore": 0-100,
    "riskLevel": "safe|low|medium|high|critical",
    "isScam": boolean,
    "reasoning": "explanation",
    "recommendations": ["action1", "action2"],
    "details": {
      "indicators": [],
      "confidence": 0-100
    }
  }`;
}

function getMockAnalysis(content: string, type: string): AnalysisResult {
    // Simple heuristic-based mock analysis
    let riskScore = 20;
    const indicators: string[] = [];

    // Phone number patterns
    if (type === "phone") {
        if (/^1-?800|^1-?888|^1-?877/.test(content)) riskScore += 15; // Common spam prefixes
        if (/^0/.test(content)) riskScore += 10; // Potential international
        if (content.includes("0000") || content.includes("1111")) riskScore += 20;
    }

    // Email patterns
    if (type === "email") {
        if (content.includes("noreply")) riskScore += 5;
        if (content.includes("alert") || content.includes("urgent")) riskScore += 20;
        if (!content.includes("@")) riskScore += 30;
    }

    // Domain patterns
    if (type === "domain") {
        if (content.includes("-") && content.includes(".")) riskScore += 10; // Hyphenated domains
        if (content.length > 50) riskScore += 15; // Suspiciously long
        if (content.includes("bitly") || content.includes("tinyurl")) riskScore += 25;
    }

    // Determine risk level
    let riskLevel: "safe" | "low" | "medium" | "high" | "critical" = "safe";
    if (riskScore > 80) riskLevel = "critical";
    else if (riskScore > 60) riskLevel = "high";
    else if (riskScore > 40) riskLevel = "medium";
    else if (riskScore > 20) riskLevel = "low";

    return {
        riskScore,
        riskLevel,
        isScam: riskScore > 50,
        reasoning: `Analyzed ${type}. Risk indicators detected: ${indicators.length > 0 ? indicators.join(", ") : "baseline analysis"}`,
        recommendations: [
            riskScore > 50
                ? "Avoid interacting with this contact"
                : "Exercise caution",
            riskScore > 70 ? "Report to authorities if contacted" : "Monitor for updates",
            "Check with community reports for more information",
        ],
        details: {
            indicators,
            confidence: 65,
            method: "heuristic_analysis",
        },
    };
}
