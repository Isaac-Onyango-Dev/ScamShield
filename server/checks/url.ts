import type { CheckDefinition } from "../engine/types";
import type { Fact, Signal } from "../../shared/types";
import { isIP } from "../../shared/detect";
import { analyzeHost } from "./lookalike";
import { risk, statusFromSignals } from "./util";

const DANGEROUS_EXT = /\.(exe|scr|msi|bat|cmd|com|pif|vbs|vbe|js|jse|wsf|hta|jar|apk|xapk|dmg|pkg|iso|img|lnk|ps1|reg|zip|rar|7z|cab)$/i;
const FREE_HOSTING =
    /(\.|^)(web\.app|firebaseapp\.com|pages\.dev|workers\.dev|r2\.dev|netlify\.app|vercel\.app|github\.io|glitch\.me|weebly\.com|wixsite\.com|blogspot\.com|000webhostapp\.com|ngrok(-free)?\.(io|app|dev)|trycloudflare\.com|herokuapp\.com|onrender\.com|repl\.co|replit\.dev|square\.site|webflow\.io|godaddysites\.com|mystrikingly\.com|framer\.website|carrd\.co|sites\.google\.com|forms\.gle|ipfs\.io|dweb\.link|cloudflare-ipfs\.com|azurewebsites\.net|blob\.core\.windows\.net|storage\.googleapis\.com|s3\.amazonaws\.com)$/i;
const CRED_PATH = /(log-?in|sign-?in|verify|verification|account|secure|update|password|wallet|unlock|webscr|cmd=|auth|sso|mfa|otp)/i;

export const urlStructureCheck: CheckDefinition = {
    id: "url.structure",
    name: "URL anatomy",
    category: "content",
    appliesTo: ["url"],
    async run({ target }) {
        const url = new URL(target.normalized);
        const host = url.hostname.replace(/^\[|\]$/g, "");
        const signals: Signal[] = [];
        const facts: Fact[] = [
            { label: "Scheme", value: url.protocol.replace(":", "") },
            { label: "Host", value: host, mono: true },
            { label: "Path", value: decodeURIComponent(url.pathname).slice(0, 120) || "/", mono: true },
        ];
        if (url.search) facts.push({ label: "Query", value: `${url.searchParams.size} parameter(s)`, mono: true });

        if (url.protocol === "http:") signals.push(risk("url.http", "low", "Unencrypted http:// link"));
        if (isIP(host)) signals.push(risk("url.ip-host", "high", "Link points to a raw IP address instead of a domain"));
        if (url.username || url.password) {
            signals.push(risk("url.userinfo", "high", `Link hides its destination with "@" (real host: ${host})`));
        }
        if (url.port && !["80", "443"].includes(url.port)) signals.push(risk("url.port", "medium", `Non-standard port :${url.port}`));
        if (!isIP(host) && analyzeHost(host).shortener) {
            signals.push(risk("url.shortener", "medium", "Shortened link hides its final destination"));
        }
        if (DANGEROUS_EXT.test(url.pathname)) {
            signals.push(risk("url.download", "high", `Direct download of a ${url.pathname.split(".").pop()!.toUpperCase()} file`));
        }
        if (FREE_HOSTING.test(host)) signals.push(risk("url.free-hosting", "low", "Hosted on a free platform often abused for phishing pages"));
        if (CRED_PATH.test(url.pathname + url.search)) signals.push(risk("url.cred-path", "low", "Path suggests a login / verification page"));
        if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(decodeURIComponent(url.search + url.hash))) {
            signals.push(risk("url.email-param", "medium", "Link is personalized with an email address (typical of phishing kits)"));
        }
        if (/%25[0-9a-f]{2}/i.test(url.href) || (url.href.match(/%[0-9a-f]{2}/gi) ?? []).length > 12) {
            signals.push(risk("url.encoding", "low", "Heavy URL encoding used to obscure content"));
        }
        if (url.href.length > 200) signals.push(risk("url.long", "low", `Very long URL (${url.href.length} chars)`));
        if (/redirect|url=|next=|continue=|dest=|goto=/i.test(url.search) && /https?%3a|https?:\/\//i.test(url.search)) {
            signals.push(risk("url.open-redirect", "medium", "Contains an embedded redirect to another URL"));
        }

        return {
            status: statusFromSignals(signals, "clean"),
            summary: signals.length ? `${signals.length} structural warning${signals.length > 1 ? "s" : ""}` : "Nothing unusual in the link structure",
            facts,
            signals,
        };
    },
};
