export type ContentType = "phone" | "email" | "domain" | "ip" | "text";
export type ReportType = "scam" | "spam" | "phishing" | "fraud" | "malware" | "other";
export type RiskLevel = "safe" | "low" | "medium" | "high" | "critical";

export interface AnalysisResult {
    riskScore: number;
    riskLevel: RiskLevel;
    isScam: boolean;
    reasoning: string;
    recommendations: string[];
    details: Record<string, unknown>;
}

export interface SearchResult {
    id: number;
    content: string;
    contentType: ContentType;
    reportCount: number;
    riskScore: number;
    riskLevel: RiskLevel;
    category?: string;
    lastReported: Date;
    verified: boolean;
}

export interface DashboardStats {
    totalReports: number;
    totalAnalyses: number;
    avgRiskScore: number;
    recentReports: number; // Last 24 hours
}
