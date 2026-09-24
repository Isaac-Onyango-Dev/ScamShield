import { cn } from "@/lib/cn";
import { TONE_TINT, type Presentation } from "@/lib/status";

/** A status written as a word, with an icon shape per tone; colour is only the third channel. */
export function StatusBadge({ presentation, kind = "status", value, className }: { presentation: Presentation; kind?: "status" | "level"; value: string; className?: string }) {
    const Icon = presentation.icon;
    return (
        <span
            {...{ [`data-${kind}`]: value }}
            className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-sm px-2 text-caption font-semibold",
                presentation.solid ? "bg-danger text-on-danger" : TONE_TINT[presentation.tone],
                className,
            )}
        >
            <Icon className="h-3 w-3" strokeWidth={2} aria-hidden />
            {presentation.label}
        </span>
    );
}
