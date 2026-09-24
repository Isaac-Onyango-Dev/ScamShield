import type { RiskLevel } from "@shared/types";
import { LEVEL_STYLES } from "@/lib/ui";

/** Semi-circular gauge; `score` is null while sources are still answering. */
export function RiskGauge({ score, level }: { score: number | null; level: RiskLevel }) {
    const r = 70;
    const circumference = Math.PI * r;
    const pct = score === null ? 0 : score / 100;
    const style = LEVEL_STYLES[level];
    return (
        <div className="relative mx-auto w-[200px]" role="img" aria-label={score === null ? "Scoring in progress" : `Risk score ${score} out of 100`}>
            <svg viewBox="0 0 180 100" className="w-full">
                <path d="M 20 90 A 70 70 0 0 1 160 90" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="12" strokeLinecap="round" />
                <path
                    d="M 20 90 A 70 70 0 0 1 160 90"
                    fill="none"
                    stroke={score === null ? "rgba(255,255,255,0.15)" : style.stroke}
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={`${circumference}`}
                    strokeDashoffset={`${circumference * (1 - pct)}`}
                    style={{ transition: "stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1), stroke .3s" }}
                />
            </svg>
            <div className="absolute inset-x-0 bottom-0 text-center">
                <div className={`text-4xl font-bold tabular-nums ${score === null ? "text-slate-500" : style.text}`}>
                    {score === null ? "··" : score}
                </div>
                <div className="text-[11px] uppercase tracking-widest text-slate-500">risk score</div>
            </div>
        </div>
    );
}
