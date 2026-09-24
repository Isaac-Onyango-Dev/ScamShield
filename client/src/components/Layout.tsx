import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Github } from "lucide-react";
import { cn } from "@/lib/cn";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { Logo } from "@/components/Logo";

const REPO = "https://github.com/isaac-onyango-dev/scamshield";

const NAV = [
    { href: "/", label: "Lookup", active: (l: string) => l === "/" || l.startsWith("/search") },
    { href: "/sources", label: "Sources", active: (l: string) => l.startsWith("/sources") },
    { href: "/api-docs", label: "API", active: (l: string) => l.startsWith("/api-docs") },
];

export function Layout({ children }: { children: ReactNode }) {
    const [location] = useLocation();
    return (
        <div className="flex min-h-screen flex-col">
            <a
                href="#main"
                className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-footnote focus:font-semibold focus:text-fg focus:shadow-overlay"
            >
                Skip to content
            </a>
            <header className="header-material sticky top-0 z-30 border-b border-line">
                <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
                    <Link href="/" aria-label="ScamShield home" className="rounded-md">
                        <Logo />
                    </Link>
                    <nav aria-label="Main" className="flex items-center gap-1 text-footnote">
                        {NAV.map((item) => {
                            const active = item.active(location);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    aria-current={active ? "page" : undefined}
                                    className={cn(
                                        "rounded-md px-2 py-1 transition-colors duration-fast sm:px-3",
                                        active ? "font-semibold text-fg" : "text-fg-secondary hover:text-fg",
                                    )}
                                >
                                    {item.label}
                                </Link>
                            );
                        })}
                        <ExternalLink href={REPO} aria-label="Source code on GitHub" className="rounded-md p-2 text-fg-secondary transition-colors duration-fast hover:text-fg">
                            <Github className="h-4 w-4" aria-hidden />
                        </ExternalLink>
                    </nav>
                </div>
            </header>
            <main id="main" tabIndex={-1} className="flex-1 outline-none">
                {children}
            </main>
            <footer className="border-t border-line py-6">
                <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 text-caption text-fg-tertiary sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <p>Public sources only. The target is never contacted. Results are indicators, not proof.</p>
                    <p>
                        ScamShield 2.0 ·{" "}
                        <ExternalLink href={REPO} className="hover:text-fg-secondary hover:underline">
                            GitHub
                        </ExternalLink>
                    </p>
                </div>
            </footer>
        </div>
    );
}
