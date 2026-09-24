import type { Signal } from "@shared/types";
import { cn } from "@/lib/cn";
import { TONE_TEXT, signalPresentation } from "@/lib/status";

/**
 * Evidence list used by the verdict and every source card. Severity is shown as a word and an
 * icon shape, not just a colour (WCAG 1.4.1). `hrefFor` links a signal to the card it came from.
 */
export function SignalList({ signals, hrefFor, className }: { signals: Signal[]; hrefFor?: (signal: Signal) => string | undefined; className?: string }) {
    return (
        <ul className={cn("flex flex-col gap-2", className)}>
            {signals.map((signal) => {
                const p = signalPresentation(signal);
                const Icon = p.icon;
                const href = hrefFor?.(signal);
                return (
                    <li key={`${signal.id}:${signal.label}`} data-severity={signal.kind === "trust" ? "trust" : signal.severity} className="flex items-start gap-2 text-footnote">
                        <Icon className={cn("mt-1 h-3 w-3 shrink-0", TONE_TEXT[p.tone])} strokeWidth={2.25} aria-hidden />
                        <span className="min-w-0">
                            <span className={cn("mr-1 font-semibold", TONE_TEXT[p.tone])}>{p.label}</span>
                            {href ? (
                                <a href={href} className="text-fg hover:underline">
                                    {signal.label}
                                </a>
                            ) : (
                                <span className="text-fg">{signal.label}</span>
                            )}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}
