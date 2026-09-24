import { cn } from "@/lib/cn";

/**
 * ScamShield mark: a shield holding a lens (docs/REDESIGN_PLAN.md §8). Drawn on a 24-unit
 * grid in currentColor so it takes the surrounding text colour. `small` is the solid
 * optical size for ≤20px, with the lens knocked out.
 */
export function LogoMark({ variant = "regular", className }: { variant?: "regular" | "small"; className?: string }) {
    if (variant === "small") {
        return (
            <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
                <path
                    fillRule="evenodd"
                    d="M12 2.75 19.25 5.5V11c0 4.6-3 8.3-7.25 10.25C7.75 19.3 4.75 15.6 4.75 11V5.5ZM11.25 6.75a3.75 3.75 0 1 0 2.2 6.79l2.2 2.2 1.1-1.1-2.2-2.2a3.75 3.75 0 0 0-3.3-5.69Zm0 1.75a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z"
                />
            </svg>
        );
    }
    return (
        <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2.75 19.25 5.5V11c0 4.6-3 8.3-7.25 10.25C7.75 19.3 4.75 15.6 4.75 11V5.5Z" />
            <circle cx="11.25" cy="10.5" r="3.25" />
            <path d="m13.6 12.85 2.4 2.4" />
        </svg>
    );
}

/** Mark + wordmark lockup. The link around it carries the accessible name. */
export function Logo({ className }: { className?: string }) {
    return (
        <span className={cn("inline-flex items-center gap-2 text-fg", className)}>
            <LogoMark className="h-6 w-6" />
            <span className="text-headline font-semibold tracking-tight">ScamShield</span>
        </span>
    );
}
