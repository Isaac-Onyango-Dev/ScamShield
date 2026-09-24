import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Github, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/ui";

const NAV = [
    { href: "/", label: "Lookup" },
    { href: "/sources", label: "Sources" },
    { href: "/api", label: "API" },
];

export function Layout({ children }: { children: ReactNode }) {
    const [location] = useLocation();
    return (
        <div className="flex min-h-screen flex-col">
            <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-ink-950/80 backdrop-blur-md">
                <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
                    <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight text-white">
                        <img src="/logo.png" alt="" className="h-7 w-7 rounded-lg" />
                        <span className="hidden sm:inline">ScamShield</span>
                    </Link>
                    <nav className="flex items-center gap-1 text-sm">
                        {NAV.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "rounded-lg px-2.5 py-1.5 transition sm:px-3",
                                    (item.href === "/" ? location === "/" || location.startsWith("/search") : location.startsWith(item.href))
                                        ? "bg-white/[0.07] text-white"
                                        : "text-slate-400 hover:text-white",
                                )}
                            >
                                {item.label}
                            </Link>
                        ))}
                        <a
                            href="https://github.com/isaac-onyango-dev/scamshield"
                            target="_blank"
                            rel="noreferrer"
                            className="ml-1 rounded-lg p-2 text-slate-400 transition hover:text-white"
                            aria-label="Source code on GitHub"
                        >
                            <Github className="h-4 w-4" />
                        </a>
                    </nav>
                </div>
            </header>
            <main className="flex-1">{children}</main>
            <footer className="border-t border-white/[0.06] py-8 text-sm text-slate-500">
                <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <p className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-brand-400" />
                        Open-source scam intelligence. Public sources only — the target is never contacted.
                    </p>
                    <p>For defensive and educational use. Results are indicators, not proof.</p>
                </div>
            </footer>
        </div>
    );
}
