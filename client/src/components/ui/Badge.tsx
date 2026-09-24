import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { TONE_TINT, type Tone } from "@/lib/status";

export function Badge({ tone = "neutral", className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
    return <span className={cn("inline-flex items-center gap-1 rounded-sm px-2 text-caption font-medium", TONE_TINT[tone], className)} {...props} />;
}
