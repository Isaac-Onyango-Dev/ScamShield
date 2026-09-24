import { cn } from "@/lib/cn";

/** Static placeholder: no shimmer, so nothing moves while data loads. */
export function Skeleton({ className }: { className?: string }) {
    return <span aria-hidden className={cn("block h-4 rounded-sm bg-surface-2", className)} />;
}
