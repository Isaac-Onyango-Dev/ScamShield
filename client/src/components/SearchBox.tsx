import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Search } from "lucide-react";
import { detectType, TYPE_LABELS } from "@shared/detect";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

interface Props {
    initial?: string;
    size?: "lg" | "md";
    busy?: boolean;
    /** Disables submitting, e.g. while a rate limit counts down. */
    disabled?: boolean;
    /** Validation message from the server, shown under the field. */
    error?: string;
    helper?: ReactNode;
}

export const SEARCH_LABEL = "Email, link, domain, IP, phone number or message";

export function SearchBox({ initial = "", size = "lg", busy, disabled, error, helper }: Props) {
    const [value, setValue] = useState(initial);
    const [, navigate] = useLocation();
    const ref = useRef<HTMLTextAreaElement>(null);
    const ids = { input: useId(), helper: useId(), error: useId() };
    const detected = value.trim() ? detectType(value) : null;

    useEffect(() => setValue(initial), [initial]);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
    }, [value]);

    function submit(e?: FormEvent) {
        e?.preventDefault();
        const q = value.trim();
        if (q && !disabled) navigate(`/search?q=${encodeURIComponent(q)}`);
    }

    function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
        }
    }

    const describedBy = [helper ? ids.helper : null, error ? ids.error : null].filter(Boolean).join(" ") || undefined;
    return (
        <form onSubmit={submit} className="flex w-full flex-col gap-2" role="search">
            <label htmlFor={ids.input} className="sr-only">
                {SEARCH_LABEL}
            </label>
            <div className={cn("search-field flex items-start gap-3 rounded-lg border bg-surface", error ? "border-danger" : "border-line-strong", size === "lg" ? "p-2 pl-4" : "p-1 pl-3")}>
                <Search className={cn("shrink-0 text-fg-tertiary", size === "lg" ? "mt-3 h-5 w-5" : "mt-2 h-4 w-4")} aria-hidden />
                <textarea
                    ref={ref}
                    id={ids.input}
                    rows={1}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={SEARCH_LABEL}
                    aria-describedby={describedBy}
                    aria-invalid={error ? true : undefined}
                    spellCheck={false}
                    className={cn("min-w-0 flex-1 resize-none bg-transparent text-fg placeholder:text-fg-tertiary", size === "lg" ? "py-2 text-headline" : "py-1 text-body")}
                />
                {detected && (
                    <Badge tone="accent" className={size === "lg" ? "mt-3" : "mt-2"}>
                        {TYPE_LABELS[detected]}
                    </Badge>
                )}
                <Button type="submit" variant="primary" size={size === "lg" ? "lg" : "md"} disabled={!value.trim() || busy || disabled}>
                    {busy && <Spinner tone="on-accent" />}
                    Look up
                </Button>
            </div>
            {error && (
                <p id={ids.error} className="text-footnote text-danger">
                    {error}
                </p>
            )}
            {helper && (
                <p id={ids.helper} className="text-footnote text-fg-tertiary">
                    {helper}
                </p>
            )}
        </form>
    );
}
