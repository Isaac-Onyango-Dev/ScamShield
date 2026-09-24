import type { CheckResult } from "@shared/types";
import { cn } from "@/lib/cn";
import { ExternalLink } from "./ExternalLink";

/** Attribution for a result: upstream link, in-house source name, or built-in analysis. */
export function SourceLink({ source, className }: { source?: CheckResult["source"]; className?: string }) {
    const cls = cn("text-caption text-fg-tertiary", className);
    if (!source) return <span data-testid="source-attribution" className={cls}>ScamShield analysis</span>;
    if (source.url.startsWith("/")) return <span data-testid="source-attribution" className={cls}>Source: {source.name}</span>;
    return (
        <ExternalLink data-testid="source-attribution" href={source.url} icon className={cn(cls, "hover:text-fg-secondary hover:underline")}>
            Source: {source.name}
        </ExternalLink>
    );
}
