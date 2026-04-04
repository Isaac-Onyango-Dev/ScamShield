import { AlertCircle, CheckCircle2, AlertTriangle, Info } from "lucide-react";

interface ResultsProps {
    content: string;
    type: string;
    analysis: {
        riskScore: number;
        riskLevel: "safe" | "low" | "medium" | "high" | "critical";
        isScam: boolean;
        reasoning: string;
        recommendations: string[];
        details: Record<string, unknown>;
    };
    communityReports: {
        count: number;
        isKnownScam: boolean;
    };
}

export function SearchResults({ content, type, analysis, communityReports }: ResultsProps) {
    const getRiskColor = (level: string) => {
        switch (level) {
            case "critical":
                return { bg: "bg-red-50", border: "border-red-200", text: "text-red-600", label: "Critical Risk" };
            case "high":
                return { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-600", label: "High Risk" };
            case "medium":
                return { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-600", label: "Medium Risk" };
            case "low":
                return { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-600", label: "Low Risk" };
            case "safe":
                return { bg: "bg-green-50", border: "border-green-200", text: "text-green-600", label: "Safe" };
            default:
                return { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-600", label: "Unknown" };
        }
    };

    const riskColor = getRiskColor(analysis.riskLevel);

    const getIcon = (level: string) => {
        switch (level) {
            case "critical":
            case "high":
                return <AlertTriangle className="w-8 h-8" />;
            case "safe":
                return <CheckCircle2 className="w-8 h-8" />;
            default:
                return <AlertCircle className="w-8 h-8" />;
        }
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            {/* Main Risk Card */}
            <div className={`${riskColor.bg} ${riskColor.border} border-2 rounded-lg p-8 mb-8`}>
                <div className="flex items-start gap-6">
                    <div className={`${riskColor.text}`}>
                        {getIcon(analysis.riskLevel)}
                    </div>
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold mb-2">
                            {analysis.isScam ? "⚠️ Potential Scam Detected" : "✅ No Known Issues"}
                        </h2>
                        <div className="flex items-center gap-4 mb-4">
                            <div>
                                <span className={`text-3xl font-bold ${riskColor.text}`}>
                                    {analysis.riskScore}%
                                </span>
                                <p className="text-sm text-gray-600">Risk Score</p>
                            </div>
                            <div className="text-sm text-gray-700">
                                <p className="font-semibold">{content}</p>
                                <p className="capitalize text-gray-500">{type}</p>
                            </div>
                        </div>

                        {/* Community Info */}
                        {communityReports.count > 0 && (
                            <div className="bg-white bg-opacity-50 rounded p-3 mb-4">
                                <p className="text-sm font-semibold">
                                    👥 {communityReports.count} community report{communityReports.count !== 1 ? "s" : ""}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Analysis Details */}
            <div className="bg-white rounded-lg border border-gray-200 p-8 mb-8">
                <h3 className="text-xl font-bold mb-4">Analysis Details</h3>

                <div className="mb-6">
                    <h4 className="font-semibold text-gray-900 mb-2">Reasoning</h4>
                    <p className="text-gray-700">{analysis.reasoning}</p>
                </div>

                {analysis.recommendations.length > 0 && (
                    <div>
                        <h4 className="font-semibold text-gray-900 mb-3">Recommendations</h4>
                        <ul className="space-y-2">
                            {analysis.recommendations.map((rec, idx) => (
                                <li key={idx} className="flex items-start gap-3 text-gray-700">
                                    <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                    <span>{rec}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Additional Info */}
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-8">
                <h3 className="text-xl font-bold mb-4">Additional Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="text-gray-600">Content Type:</span>
                        <p className="font-semibold capitalize">{type}</p>
                    </div>
                    <div>
                        <span className="text-gray-600">Risk Level:</span>
                        <p className={`font-semibold ${riskColor.text}`}>{riskColor.label}</p>
                    </div>
                    <div>
                        <span className="text-gray-600">Community Reports:</span>
                        <p className="font-semibold">{communityReports.count}</p>
                    </div>
                    <div>
                        <span className="text-gray-600">Known Scam:</span>
                        <p className="font-semibold">{communityReports.isKnownScam ? "Yes ⚠️" : "No ✅"}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
