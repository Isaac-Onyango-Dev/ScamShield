import type { ReactNode } from "react";

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
    return (
        <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <p className="text-headline font-semibold text-fg">{title}</p>
            {children && <div className="text-footnote text-fg-secondary">{children}</div>}
        </div>
    );
}
