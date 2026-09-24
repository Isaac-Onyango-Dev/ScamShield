/**
 * Public origin and deployment facts injected into index.html at runtime
 * (docs/REDESIGN_PLAN.md §4.1.1 and §4.8). Pure functions, shared by the server and the
 * Vite dev plugin.
 */

export interface SiteUrlEnv {
    SITE_URL?: string;
    RENDER_EXTERNAL_URL?: string;
    NODE_ENV: string;
    PORT: number;
}

export type StorageMode = "ephemeral" | "persistent";

export const SITE_URL_REQUIRED =
    "SITE_URL is required in production (the public origin, e.g. https://scamshield.example). On Render, RENDER_EXTERNAL_URL is used automatically when SITE_URL is unset.";

function normalize(raw: string, name: string, production: boolean): string {
    let url: URL;
    try {
        url = new URL(raw.trim());
    } catch {
        throw new Error(`${name} must be an absolute URL, got "${raw}"`);
    }
    if (url.protocol !== "https:" && !(url.protocol === "http:" && !production)) {
        throw new Error(`${name} must use https${production ? "" : " or http"}, got "${url.protocol}"`);
    }
    if ((url.pathname !== "/" && url.pathname !== "") || url.search || url.hash || url.username || url.password) {
        throw new Error(`${name} must be an origin only (no path, query or credentials), got "${raw}"`);
    }
    return url.origin;
}

/** SITE_URL → RENDER_EXTERNAL_URL → (outside production) http://localhost:PORT. */
export function resolveSiteUrl(env: SiteUrlEnv): string {
    const production = env.NODE_ENV === "production";
    const site = env.SITE_URL?.trim();
    if (site) return normalize(site, "SITE_URL", production);
    const render = env.RENDER_EXTERNAL_URL?.trim();
    if (render) return normalize(render, "RENDER_EXTERNAL_URL", production);
    if (production) throw new Error(SITE_URL_REQUIRED);
    return `http://localhost:${env.PORT}`;
}

export function storageModeFrom(persistent: boolean): StorageMode {
    return persistent ? "persistent" : "ephemeral";
}

export function escapeAttr(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Fills the index.html placeholders. `path` must be the URL path only: the query string is
 * never included because lookups carry emails and phone numbers.
 */
export function renderIndexHtml(html: string, opts: { siteUrl: string; path: string; storageMode: StorageMode }): string {
    const path = opts.path.split(/[?#]/)[0] || "/";
    return html
        .replaceAll("%SITE_URL%", escapeAttr(opts.siteUrl))
        .replaceAll("%PATH%", escapeAttr(path))
        .replaceAll("%STORAGE_MODE%", opts.storageMode);
}
