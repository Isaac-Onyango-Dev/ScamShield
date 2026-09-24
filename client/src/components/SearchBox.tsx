import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Loader2, Search } from "lucide-react";
import { detectType, TYPE_LABELS } from "@shared/detect";
import { cn } from "@/lib/ui";

export const EXAMPLES = [
    { label: "Phishing domain", q: "paypal-secure-login.xyz" },
    { label: "Email", q: "support.paypal@gmail.com" },
    { label: "Short link", q: "https://bit.ly/3xYz" },
    { label: "Phone", q: "+1 888 123 4567" },
    { label: "IP", q: "185.220.101.1" },
    {
        label: "SMS",
        q: "URGENT: Your account has been suspended. Verify your identity within 24 hours at http://amaz0n-verify.top/login or it will be closed.",
    },
];

interface Props {
    initial?: string;
    size?: "lg" | "md";
    busy?: boolean;
    autoFocus?: boolean;
}

export function SearchBox({ initial = "", size = "lg", busy, autoFocus }: Props) {
    const [value, setValue] = useState(initial);
    const [, navigate] = useLocation();
    const ref = useRef<HTMLTextAreaElement>(null);
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
        if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
    }

    function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
        }
    }

    return (
        <form onSubmit={submit} className="w-full">
            <div
                className={cn(
                    "group relative flex items-start gap-3 rounded-2xl border border-white/10 bg-ink-850/90 shadow-2xl shadow-black/40 transition focus-within:border-brand-400/50 focus-within:shadow-brand-500/5",
                    size === "lg" ? "p-2.5 pl-5" : "p-1.5 pl-4",
                )}
            >
                <Search className={cn("shrink-0 text-slate-500", size === "lg" ? "mt-3.5 h-5 w-5" : "mt-2.5 h-4 w-4")} />
                <textarea
                    ref={ref}
                    rows={1}
                    value={value}
                    autoFocus={autoFocus}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Email, link, domain, IP, phone number — or paste a suspicious message"
                    aria-label="What do you want to investigate?"
                    spellCheck={false}
                    className={cn(
                        "min-w-0 flex-1 resize-none bg-transparent text-white placeholder:text-slate-500 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
                        size === "lg" ? "py-3 text-base sm:text-lg" : "py-2 text-sm",
                    )}
                />
                {detected && (
                    <span className={cn("chip shrink-0 border-brand-400/30 text-brand-300", size === "lg" ? "mt-3.5" : "mt-2")}>
                        {TYPE_LABELS[detected]}
                    </span>
                )}
                <button type="submit" disabled={!value.trim() || busy} className={cn("btn-primary shrink-0", size === "lg" ? "h-12 px-5" : "h-9 px-3")}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    <span className="hidden sm:inline">Investigate</span>
                </button>
            </div>
        </form>
    );
}
