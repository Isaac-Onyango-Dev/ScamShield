import type { Target, TargetType } from "./types";

/**
 * Isomorphic (browser + Node) target detection and normalization.
 * The server re-validates everything; the client uses this for the live type badge.
 */

// Domain part accepts internationalized labels; they are converted to punycode during normalization.
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@([\p{L}\p{N}-]{1,63}\.)+[\p{L}\p{N}-]{2,63}$/iu;
const DOTTED_QUAD_RE = /^\d{1,3}(\.\d{1,3}){3}$/;
const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
// Accepts full, compressed and IPv4-mapped IPv6 forms.
const IPV6_RE =
    /^(([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}|([0-9a-f]{1,4}:){1,7}:|([0-9a-f]{1,4}:){1,6}:[0-9a-f]{1,4}|([0-9a-f]{1,4}:){1,5}(:[0-9a-f]{1,4}){1,2}|([0-9a-f]{1,4}:){1,4}(:[0-9a-f]{1,4}){1,3}|([0-9a-f]{1,4}:){1,3}(:[0-9a-f]{1,4}){1,4}|([0-9a-f]{1,4}:){1,2}(:[0-9a-f]{1,4}){1,5}|[0-9a-f]{1,4}:(:[0-9a-f]{1,4}){1,6}|:((:[0-9a-f]{1,4}){1,7}|:)|::ffff:(\d{1,3}\.){3}\d{1,3})$/i;
const HOST_RE = /^(?=.{1,253}$)((?!-)[a-z0-9-]{1,63}(?<!-)\.)+(xn--[a-z0-9-]{2,59}|[a-z]{2,63})$/i;
const PHONE_CHARS_RE = /^\+?[\d\s().\-/]{6,24}$/;

export const MAX_INPUT_LENGTH = 4000;

export function isIPv4(value: string): boolean {
    return IPV4_RE.test(value);
}

export function isIPv6(value: string): boolean {
    return IPV6_RE.test(value);
}

export function isIP(value: string): boolean {
    return isIPv4(value) || isIPv6(value);
}

/** Converts an (optionally unicode) hostname to lowercase ASCII/punycode. */
export function toAsciiHost(host: string): string | null {
    try {
        const h = new URL(`http://${host.trim().replace(/\.$/, "")}`).hostname.toLowerCase();
        return h || null;
    } catch {
        return null;
    }
}

function looksLikeUrl(value: string): boolean {
    return /^(https?|hxxps?):\/\//i.test(value) || (/^[^\s/]+\.[a-z]{2,}\/\S*/i.test(value) && !value.includes("@"));
}

/** Undo common "defanging" used when sharing indicators: hxxp://, [.], (dot). */
export function refang(value: string): string {
    return value
        .replace(/^hxxp/i, "http")
        .replace(/\[\.\]|\(\.\)|\{\.\}|\[dot\]|\(dot\)/gi, ".")
        .replace(/\[@\]|\[at\]|\(at\)/gi, "@")
        .replace(/\[:\]/g, ":");
}

export function detectType(raw: string): TargetType {
    const value = refang(raw.trim());
    if (!value) return "text";
    if (/\s/.test(value.trim()) && !PHONE_CHARS_RE.test(value)) return "text";
    if (value.startsWith("mailto:")) return detectType(value.slice(7));
    if (isIP(value) || isIP(value.replace(/^\[|\]$/g, "")) || DOTTED_QUAD_RE.test(value)) return "ip";
    if (EMAIL_RE.test(value)) return "email";
    if (looksLikeUrl(value)) return "url";
    if (PHONE_CHARS_RE.test(value)) {
        const digits = value.replace(/\D/g, "");
        if (digits.length >= 6 && digits.length <= 15) return "phone";
    }
    if (/[@/\\]/.test(value)) return "text";
    const host = toAsciiHost(value);
    if (host && HOST_RE.test(host) && !/^\d+(\.\d+)*$/.test(host)) return "domain";
    return "text";
}

export type TargetParseResult = { ok: true; target: Target } | { ok: false; error: string };

/**
 * Parses user input into a normalized target. Phone numbers are only lightly
 * normalized here; the server upgrades them to E.164 with libphonenumber.
 */
export function parseTarget(raw: string, forcedType?: TargetType): TargetParseResult {
    const input = raw.trim();
    if (!input) return { ok: false, error: "Enter something to look up." };
    if (input.length > MAX_INPUT_LENGTH) {
        return { ok: false, error: `Input is too long (max ${MAX_INPUT_LENGTH} characters).` };
    }
    const type = forcedType ?? detectType(input);
    const value = type === "text" ? input : refang(input).replace(/^mailto:/i, "");

    switch (type) {
        case "email": {
            if (!EMAIL_RE.test(value)) return { ok: false, error: "That doesn't look like a valid email address." };
            const at = value.lastIndexOf("@");
            const host = toAsciiHost(value.slice(at + 1));
            if (!host) return { ok: false, error: "Invalid email domain." };
            const normalized = `${value.slice(0, at).toLowerCase()}@${host}`;
            return { ok: true, target: { type, input, normalized, host } };
        }
        case "url": {
            try {
                const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `http://${value}`);
                if (!/^https?:$/.test(url.protocol)) return { ok: false, error: "Only http(s) URLs are supported." };
                url.hash = "";
                const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
                return { ok: true, target: { type, input, normalized: url.href, host } };
            } catch {
                return { ok: false, error: "That doesn't look like a valid URL." };
            }
        }
        case "domain": {
            const host = toAsciiHost(value);
            if (!host || !HOST_RE.test(host)) return { ok: false, error: "That doesn't look like a valid domain." };
            return { ok: true, target: { type, input, normalized: host, host } };
        }
        case "ip": {
            const ip = value.replace(/^\[|\]$/g, "").toLowerCase();
            if (!isIP(ip)) return { ok: false, error: "That doesn't look like a valid IP address." };
            return { ok: true, target: { type, input, normalized: ip } };
        }
        case "phone": {
            const digits = value.replace(/\D/g, "");
            if (digits.length < 6 || digits.length > 15) return { ok: false, error: "Phone numbers need 6–15 digits." };
            const normalized = value.trim().startsWith("+") ? `+${digits}` : digits;
            return { ok: true, target: { type, input, normalized } };
        }
        case "text": {
            if (input.length < 8) return { ok: false, error: "Paste a longer message (at least 8 characters)." };
            return { ok: true, target: { type, input, normalized: input.replace(/\s+/g, " ") } };
        }
    }
}

export const TYPE_LABELS: Record<TargetType, string> = {
    email: "Email",
    domain: "Domain",
    url: "URL",
    ip: "IP address",
    phone: "Phone",
    text: "Message",
};
