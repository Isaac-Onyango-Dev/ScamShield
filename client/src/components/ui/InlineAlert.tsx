import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from "lucide-react";
import { cn } from "@/lib/cn";
import { TONE_TINT } from "@/lib/status";

const ICONS = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: OctagonAlert };

export function InlineAlert({
    tone = "info",
    title,
    children,
    action,
    className,
    id,
}: {
    tone?: "info" | "success" | "warning" | "danger";
    title?: string;
    children?: ReactNode;
    action?: ReactNode;
    className?: string;
    id?: string;
}) {
    const Icon = ICONS[tone];
    return (
        <div
            id={id}
            role={tone === "danger" ? "alert" : "status"}
            data-tone={tone}
            className={cn("flex items-start gap-3 rounded-md px-4 py-3 text-footnote", TONE_TINT[tone === "info" ? "accent" : tone], className)}
        >
            <Icon className="mt-1 h-4 w-4 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1 text-fg">
                {title && <p className="font-semibold">{title}</p>}
                {children && <div className="text-fg-secondary">{children}</div>}
            </div>
            {action}
        </div>
    );
}
