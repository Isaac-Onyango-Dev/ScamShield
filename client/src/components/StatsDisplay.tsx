import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, AlertTriangle, TrendingUp } from "lucide-react";

export function StatsDisplay() {
    const { data, isLoading } = useQuery({
        queryKey: ["stats"],
        queryFn: async () => {
            const res = await fetch("/api/stats/stats");
            return res.json();
        },
        refetchInterval: 30000, // Refresh every 30 seconds
    });

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-slate-100 animate-pulse h-24 rounded-lg" />
                ))}
            </div>
        );
    }

    const stats = [
        {
            label: "Total Reports",
            value: data?.totalReports || 0,
            icon: TrendingUp,
            color: "bg-blue-50 text-blue-600",
        },
        {
            label: "Avg Risk Score",
            value: `${data?.avgRiskScore || 0}%`,
            icon: AlertTriangle,
            color: "bg-orange-50 text-orange-600",
        },
        {
            label: "Recent (24h)",
            value: data?.recentReports || 0,
            icon: AlertCircle,
            color: "bg-red-50 text-red-600",
        },
        {
            label: "AI Analyses",
            value: data?.totalAnalyses || 0,
            icon: CheckCircle2,
            color: "bg-green-50 text-green-600",
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                    <div
                        key={stat.label}
                        className={`${stat.color} p-4 rounded-lg border border-opacity-20 border-current`}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium opacity-75">{stat.label}</p>
                                <p className="text-2xl font-bold mt-1">{stat.value}</p>
                            </div>
                            <Icon className="w-8 h-8 opacity-50" />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
