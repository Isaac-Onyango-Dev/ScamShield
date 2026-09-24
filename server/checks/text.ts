import type { CheckDefinition } from "../engine/types";
import type { Item, Severity, Signal } from "../../shared/types";
import { parseTarget } from "../../shared/detect";
import { analyzeHost } from "./lookalike";
import { risk, statusFromSignals } from "./util";

interface Pattern {
    id: string;
    label: string;
    severity: Severity;
    re: RegExp;
}

/** Social-engineering patterns drawn from FTC / Action Fraud / CA scam typologies. */
const PATTERNS: Pattern[] = [
    { id: "credentials", label: "Asks for passwords, PINs or verification codes", severity: "high",
      re: /\b((verify|confirm|update|validate)\s+(your\s+)?(account|identity|details|information|password|card)|(enter|share|send|provide|give|tell|forward|read out)\s+(me\s+|us\s+)?(your\s+|the\s+)?(password|pin|otp|one[- ]time (code|pin|password)|verification code|security code|cvv|card (number|details)|ssn|social security))/i },
    { id: "otp", label: "Requests a one-time code (account takeover tactic)", severity: "high",
      re: /\b(share|send|give|tell|forward|read)\b[^.!?\n]{0,40}\b(otp|code|pin)\b/i },
    { id: "payment-method", label: "Demands untraceable payment (gift cards, crypto, wire)", severity: "medium",
      re: /\b(gift ?cards?|itunes cards?|google play cards?|steam (gift )?cards?|apple (gift )?cards?|bitcoin|btc|usdt|tether|crypto(currency)?|wire transfer|western union|moneygram|zelle|cash ?app|venmo|m-?pesa|paybill|till (number|no))\b/i },
    { id: "advance-fee", label: "Upfront fee required to release money or goods", severity: "high",
      re: /\b(processing|clearance|release|activation|registration|delivery|customs|transfer|handling|unlock(ing)?|verification)\s+fee\b|\bpay (a |the )?(small |one[- ]time )?fee\b/i },
    { id: "prize", label: "Unexpected prize, lottery or reward", severity: "high",
      re: /\b(you('ve| have)? (won|been selected)|winner|lottery|jackpot|claim your (reward|prize|gift|refund)|congratulations[!,.]? you)\b/i },
    { id: "advance-419", label: "Inheritance / large fund transfer story", severity: "high",
      re: /\b(inheritance|next of kin|beneficiary|deceased (client|customer)|(\d+(\.\d+)?\s?)?million (usd|dollars|euros|pounds)|transfer of (the )?funds|barrister|diplomat(ic)? (bag|courier)|consignment box)\b/i },
    { id: "urgency", label: "Artificial urgency or deadline", severity: "medium",
      re: /\b(urgent(ly)?|immediately|act now|right away|asap|within (the next )?(\d+|twenty[- ]four|forty[- ]eight) (hours|hrs|minutes)|final (notice|warning|reminder)|last (chance|warning)|expires? (today|tonight|soon)|limited time|before it'?s too late)\b/i },
    { id: "account-threat", label: "Threatens account suspension or unusual activity", severity: "medium",
      re: /\b(suspend(ed)?|locked|deactivat(ed|ion)|disabled|restricted|unusual (sign[- ]?in|activity|login)|unauthori[sz]ed (access|transaction|login|charge)|compromised)\b/i },
    { id: "legal-threat", label: "Threatens arrest, lawsuits or penalties", severity: "high",
      re: /\b(arrest(ed)?|warrant|legal action|lawsuit|prosecut(e|ion)|jail|prison|deport(ed|ation)?|penalt(y|ies)|court (case|summons))\b/i },
    { id: "authority", label: "Claims to be a government agency or police", severity: "medium",
      re: /\b(irs|hmrc|kra|police|fbi|interpol|customs (office|department)|immigration|tax (refund|office|department)|social security administration|ministry of|central bank|efcc|dci)\b/i },
    { id: "delivery", label: "Fake parcel / delivery problem", severity: "medium",
      re: /\b(parcel|package|shipment|delivery|courier)\b[^.!?\n]{0,60}\b(held|pending|failed|on hold|reschedul|unpaid|awaiting payment|customs|address)\b/i },
    { id: "investment", label: "Guaranteed returns or easy-money pitch", severity: "medium",
      re: /\b(guaranteed (returns?|profits?|income)|double your (money|investment|bitcoin)|investment opportunity|risk[- ]free (investment|profit)|forex (signals|trading)|trading signals?|passive income|earn \$?\d[\d,]*\s?(k|usd|ksh|dollars)? (per|a|every) (day|week|hour))\b/i },
    { id: "job", label: "Too-good-to-be-true job offer", severity: "medium",
      re: /\b(work from home|no experience (needed|required)|hiring (now|immediately)|part[- ]time job|daily pay|like (videos|posts) (and|to) earn|task[- ]based (job|earning))\b/i },
    { id: "remote-access", label: "Asks to install remote-access software", severity: "high",
      re: /\b(anydesk|teamviewer|ultraviewer|quick ?support|rustdesk|remote (access|desktop|support app))\b/i },
    { id: "secrecy", label: "Asks you to keep it secret", severity: "medium",
      re: /\b(don'?t tell (anyone|anybody)|keep (this|it) (secret|confidential|between us)|between (us|you and me)|do not (share|discuss) this)\b/i },
    { id: "wrong-number", label: "\"Wrong number\" opener used in pig-butchering scams", severity: "low",
      re: /^\s*(hi|hello|hey)[,!. ]+(is this|are you|this is)\b/i },
    { id: "refund", label: "Unsolicited refund or overpayment", severity: "medium",
      re: /\b(refund (of|for|is)|overpaid|overpayment|sent (you )?(too much|extra)|accidentally sent)\b/i },
];

const URL_RE = /\b((?:https?|hxxps?):\/\/[^\s<>"')]+|(?:www\.)[^\s<>"')]+|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|info|xyz|top|online|site|shop|live|link|click|io|co|me|ly|app|cc|ru|cn|tk|ml|ga|cf|gq|ke|ng|uk|us|de)\/[^\s<>"')]*)/gi;
const EMAIL_RE = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi;
const PHONE_RE = /(?<![\w/])\+?\d[\d\s().-]{7,}\d(?![\w/])/g;

export function extractIndicators(text: string) {
    const urls = [...new Set((text.match(URL_RE) ?? []).map((u) => u.replace(/[.,;:!?]+$/, "")))];
    const emails = [...new Set(text.match(EMAIL_RE) ?? [])];
    const phones = [...new Set((text.match(PHONE_RE) ?? []).map((p) => p.trim()))].filter(
        (p) => p.replace(/\D/g, "").length >= 7 && p.replace(/\D/g, "").length <= 15,
    );
    return { urls, emails, phones };
}

export const messageCheck: CheckDefinition = {
    id: "text.patterns",
    name: "Scam language analysis",
    category: "content",
    appliesTo: ["text"],
    async run({ target }) {
        const text = target.input;
        const signals: Signal[] = [];
        for (const p of PATTERNS) {
            if (p.re.test(text)) signals.push(risk(`text.${p.id}`, p.severity, p.label));
        }
        const matched = new Set(signals.map((s) => s.id));
        // Tactic combinations are far stronger evidence than any one phrase.
        if (matched.has("text.payment-method") && (matched.has("text.urgency") || matched.has("text.legal-threat") || matched.has("text.authority"))) {
            signals.push(risk("text.combo-pressure-pay", "high", "Pressure + untraceable payment — classic scam combination"));
        }
        if (matched.has("text.account-threat") && (matched.has("text.credentials") || matched.has("text.otp"))) {
            signals.push(risk("text.combo-phish", "high", "Account threat + credential request — phishing pattern"));
        }
        const letters = text.replace(/[^a-z]/gi, "");
        if (letters.length > 40 && letters.replace(/[^A-Z]/g, "").length / letters.length > 0.5) {
            signals.push(risk("text.shouting", "low", "Excessive capital letters"));
        }

        const { urls, emails, phones } = extractIndicators(text);
        const items: Item[] = [];
        for (const raw of urls.slice(0, 10)) {
            const parsed = parseTarget(raw, "url");
            if (!parsed.ok || !parsed.target.host) continue;
            const hostSignals = analyzeHost(parsed.target.host).signals.filter((s) => s.kind === "risk");
            for (const s of hostSignals) signals.push({ ...s, id: `text.link.${s.id}`, label: `Link ${parsed.target.host}: ${s.label}` });
            items.push({
                title: parsed.target.host,
                subtitle: raw.length > 80 ? `${raw.slice(0, 80)}…` : raw,
                href: `/search?q=${encodeURIComponent(raw)}`,
                tags: ["link", ...(analyzeHost(parsed.target.host).shortener ? ["shortened"] : [])],
            });
        }
        for (const e of emails.slice(0, 5)) items.push({ title: e, href: `/search?q=${encodeURIComponent(e)}`, tags: ["email"] });
        for (const p of phones.slice(0, 5)) items.push({ title: p, href: `/search?q=${encodeURIComponent(p)}`, tags: ["phone"] });

        const tactics = signals.filter((s) => !s.id.startsWith("text.link.")).length;
        return {
            status: statusFromSignals(signals),
            summary: tactics
                ? `${tactics} manipulation tactic${tactics > 1 ? "s" : ""} detected${items.length ? `, ${items.length} indicator(s) extracted` : ""}`
                : items.length
                  ? `No scam phrasing; ${items.length} indicator(s) extracted — investigate them individually`
                  : "No known scam phrasing detected",
            facts: [
                { label: "Length", value: `${text.length} characters` },
                { label: "Links found", value: String(urls.length) },
                { label: "Emails / phones", value: `${emails.length} / ${phones.length}` },
            ],
            items,
            signals,
        };
    },
};
