import { parsePhoneNumberFromString, type CountryCode, type PhoneNumber } from "libphonenumber-js/max";
import type { CheckDefinition } from "../engine/types";
import type { Fact, Signal } from "../../shared/types";
import { INTERNATIONAL_NETWORK_PREFIXES } from "../data/lists";
import { risk, statusFromSignals } from "./util";

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

export function parsePhone(input: string, defaultRegion: string): PhoneNumber | undefined {
    const cleaned = input.replace(/^00/, "+");
    return parsePhoneNumberFromString(cleaned, { defaultCountry: defaultRegion as CountryCode, extract: false });
}

/** E.164 when the number is at least plausible, otherwise the digit string we were given. */
export function normalizePhone(input: string, defaultRegion: string): string {
    const pn = parsePhone(input, defaultRegion);
    return pn?.isPossible() ? pn.number : input.replace(/[^\d+]/g, "");
}

const TYPE_LABELS: Record<string, string> = {
    MOBILE: "Mobile",
    FIXED_LINE: "Landline",
    FIXED_LINE_OR_MOBILE: "Landline or mobile",
    TOLL_FREE: "Toll-free",
    PREMIUM_RATE: "Premium-rate",
    SHARED_COST: "Shared-cost",
    VOIP: "VoIP (internet telephony)",
    PERSONAL_NUMBER: "Personal / follow-me number",
    PAGER: "Pager",
    UAN: "Universal access number",
    VOICEMAIL: "Voicemail",
};

export const phoneCheck: CheckDefinition = {
    id: "phone.numbering",
    name: "Number intelligence",
    category: "identity",
    appliesTo: ["phone"],
    source: { name: "Google libphonenumber metadata", url: "https://github.com/google/libphonenumber" },
    async run({ target, config }) {
        const pn = parsePhone(target.input, config.DEFAULT_PHONE_REGION);
        if (!pn) {
            return {
                status: "warning",
                summary: "Not a parseable phone number",
                signals: [risk("phone.unparseable", "low", "Number could not be parsed in any numbering plan")],
            };
        }
        const valid = pn.isValid();
        const type = pn.getType();
        const signals: Signal[] = [];
        const facts: Fact[] = [
            { label: "E.164", value: pn.number, mono: true },
            { label: "International", value: pn.formatInternational(), mono: true },
            { label: "National", value: pn.formatNational(), mono: true },
            {
                label: "Country",
                value: pn.country ? `${regionNames.of(pn.country) ?? pn.country} (${pn.country})` : `+${pn.countryCallingCode} (non-geographic)`,
            },
            { label: "Line type", value: type ? TYPE_LABELS[type] ?? type : "Unknown" },
            { label: "Valid", value: valid ? "Yes — assignable number" : pn.isPossible() ? "Possible length, not assigned" : "No" },
        ];

        if (!valid) signals.push(risk("phone.invalid", "medium", "Not a valid number in its numbering plan — may be spoofed"));
        if (type === "PREMIUM_RATE") signals.push(risk("phone.premium", "high", "Premium-rate number — calling it can cost a lot"));
        if (type === "VOIP") signals.push(risk("phone.voip", "medium", "VoIP number — cheap to obtain and widely used by scam call centers"));
        if (type === "PERSONAL_NUMBER" || type === "UAN") signals.push(risk("phone.redirect", "low", "Redirecting/virtual number type"));
        if (type === "SHARED_COST") signals.push(risk("phone.shared-cost", "low", "Shared-cost number (caller pays extra)"));
        if (INTERNATIONAL_NETWORK_PREFIXES.some((p) => pn.number.startsWith(p))) {
            signals.push(risk("phone.intl-network", "high", "International satellite/global-network range — used in callback (Wangiri) fraud"));
        }
        if (/(\d)\1{5,}/.test(pn.nationalNumber)) signals.push(risk("phone.pattern", "low", "Repetitive digit pattern (often spoofed caller ID)"));

        const label = type ? TYPE_LABELS[type] ?? type : "Phone";
        return {
            status: statusFromSignals(signals, "info"),
            summary: `${label} number${pn.country ? ` in ${regionNames.of(pn.country)}` : ""}${valid ? "" : " (invalid)"}`,
            facts,
            signals,
        };
    },
};
