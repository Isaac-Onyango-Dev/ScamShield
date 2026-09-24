import type { AnchorHTMLAttributes } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Every link that leaves ScamShield. One policy: new tab, no referrer, no opener, and
 * `nofollow` because targets are user-supplied indicators (ARCHITECTURE.md, Security).
 */
export function ExternalLink({ className, children, icon = false, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; icon?: boolean }) {
    return (
        <a target="_blank" rel="noopener noreferrer nofollow" className={cn(icon && "inline-flex items-center gap-1", className)} {...props}>
            {children}
            {icon && <ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden />}
        </a>
    );
}
