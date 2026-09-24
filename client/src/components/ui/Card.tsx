import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, as: Tag = "div", ...props }: HTMLAttributes<HTMLElement> & { as?: "div" | "section" | "article" | "aside" }) {
    return <Tag className={cn("rounded-lg border border-line bg-surface", className)} {...props} />;
}
