import { cn } from "@/lib/cn";

/**
 * The single continuous animation in the app (lookup in progress). Under
 * prefers-reduced-motion base.css stops it; the adjacent status text carries the meaning.
 */
export function Spinner({ className }: { className?: string }) {
    return (
        <span
            aria-hidden
            className={cn("inline-block h-4 w-4 shrink-0 rounded-full border-2 border-line border-t-accent", className)}
            style={{ animation: "spin 1s linear infinite" }}
        />
    );
}
