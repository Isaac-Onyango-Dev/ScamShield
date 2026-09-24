export function timeAgo(iso: string, now = Date.now()): string {
    const s = Math.round((now - new Date(iso).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    return `${Math.round(s / 86400)} d ago`;
}

/** Absolute local date and time, e.g. "24 Sep 2026, 14:02". */
export function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatUtc(iso: string): string {
    return `${new Date(iso).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function formatSeconds(ms: number): string {
    return `${(ms / 1000).toFixed(1)} s`;
}

export function formatCount(n: number): string {
    return n.toLocaleString("en-US");
}
