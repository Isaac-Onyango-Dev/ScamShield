export type Fetcher = typeof fetch;

const USER_AGENT = "ScamShield/2.0 (+https://github.com/isaac-onyango-dev/scamshield)";

export class HttpError extends Error {
    constructor(
        public status: number,
        message: string,
    ) {
        super(message);
        this.name = "HttpError";
    }
}

interface RequestOptions {
    signal?: AbortSignal;
    headers?: Record<string, string>;
    method?: string;
    body?: string | URLSearchParams;
    /** Status codes that mean "nothing found" rather than failure. Returns null for them. */
    notFound?: number[];
}

/** JSON request with a descriptive UA, abort support and friendly errors. */
export async function requestJson<T>(fetcher: Fetcher, url: string, opts: RequestOptions = {}): Promise<T | null> {
    const res = await fetcher(url, {
        method: opts.method ?? "GET",
        body: opts.body,
        signal: opts.signal,
        redirect: "follow",
        headers: { accept: "application/json", "user-agent": USER_AGENT, ...opts.headers },
    });
    if (opts.notFound?.includes(res.status)) return null;
    if (res.status === 429) throw new HttpError(429, "Rate limited by upstream source — try again shortly");
    if (!res.ok) throw new HttpError(res.status, `Upstream responded ${res.status}`);
    const text = await res.text();
    if (!text) return null;
    try {
        return JSON.parse(text) as T;
    } catch {
        throw new HttpError(res.status, "Upstream returned invalid JSON");
    }
}

/** Plain status probe (used for sources that answer 200/404 with non-JSON bodies). */
export async function requestStatus(fetcher: Fetcher, url: string, opts: RequestOptions = {}): Promise<number> {
    const res = await fetcher(url, {
        method: opts.method ?? "GET",
        signal: opts.signal,
        redirect: "follow",
        headers: { "user-agent": USER_AGENT, ...opts.headers },
    });
    await res.body?.cancel().catch(() => undefined);
    if (res.status === 429) throw new HttpError(429, "Rate limited by upstream source — try again shortly");
    return res.status;
}
