import { useEffect, useRef, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./Button";

type State = "idle" | "copied" | "failed";

/**
 * Copies `value` and says honestly whether that worked. The result is announced through a
 * polite live region so screen-reader users hear "Copied" or "Couldn't copy".
 */
export function CopyButton({ value, label, showLabel = false, size = "sm", className }: { value: string; label: string; showLabel?: boolean; size?: "sm" | "md"; className?: string }) {
    const [state, setState] = useState<State>("idle");
    const timer = useRef<ReturnType<typeof setTimeout>>();
    useEffect(() => () => clearTimeout(timer.current), []);

    async function copy() {
        try {
            await navigator.clipboard.writeText(value);
            setState("copied");
        } catch {
            setState("failed");
        }
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setState("idle"), 2000);
    }

    const Icon = state === "copied" ? Check : state === "failed" ? X : Copy;
    const text = state === "copied" ? "Copied" : state === "failed" ? "Couldn't copy" : label;
    return (
        <>
            <Button
                variant={showLabel ? "secondary" : "plain"}
                size={size}
                onClick={copy}
                aria-label={showLabel ? undefined : label}
                title={showLabel ? undefined : label}
                className={cn(!showLabel && "h-6 w-6 rounded-sm text-fg-tertiary hover:bg-surface-2 hover:text-fg hover:no-underline", className)}
            >
                <Icon className="h-4 w-4" aria-hidden />
                {showLabel && text}
            </Button>
            <span aria-live="polite" className="sr-only">
                {state === "copied" ? "Copied" : state === "failed" ? "Couldn't copy" : ""}
            </span>
        </>
    );
}
