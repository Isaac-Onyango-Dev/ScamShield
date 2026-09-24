import type { CheckDefinition } from "../engine/types";
import type { Fact, Item, Signal } from "../../shared/types";
import { hostInfo } from "../lib/domain";
import { formatDate, plural, risk, statusFromSignals } from "./util";

export const communityCheck: CheckDefinition = {
    id: "community",
    name: "Community reports",
    category: "community",
    appliesTo: ["email", "domain", "url", "ip", "phone", "text"],
    source: { name: "ScamShield community", url: "/sources" },
    async run({ target, community }) {
        const lookups: [string, typeof target.type, string][] = [["this " + target.type, target.type, target.normalized]];
        // Emails and URLs inherit reputation from their domain.
        if ((target.type === "email" || target.type === "url") && target.host) {
            const registrable = hostInfo(target.host).registrable;
            if (registrable) lookups.push([`domain ${registrable}`, "domain", registrable]);
        }

        const signals: Signal[] = [];
        const facts: Fact[] = [];
        const items: Item[] = [];
        let total = 0;

        for (const [label, type, value] of lookups) {
            const rec = await community.lookup(type, value);
            if (rec.known) {
                signals.push(
                    risk(`community.known.${type}`, "critical", `${label[0].toUpperCase()}${label.slice(1)} is a known scam indicator (${rec.known.category}${rec.known.source ? `, source: ${rec.known.source}` : ""})`),
                );
                facts.push({ label: `Known scam (${label})`, value: rec.known.category });
            }
            if (rec.reports) {
                const n = rec.reports.count;
                total += n;
                const cats = Object.entries(rec.reports.categories)
                    .sort((a, b) => b[1] - a[1])
                    .map(([c]) => c);
                const severity = n >= 10 ? "critical" : n >= 3 ? "high" : "medium";
                signals.push(risk(`community.reports.${type}`, severity, `Reported ${plural(n, "time")} for ${label} (${cats.slice(0, 3).join(", ")})`));
                facts.push({ label: `Reports (${label})`, value: String(n) });
                facts.push({ label: "Last reported", value: formatDate(rec.reports.lastReportedAt) });
                for (const r of rec.reports.recent) {
                    items.push({ title: r.category, subtitle: r.description ?? undefined, date: formatDate(r.createdAt) });
                }
            }
        }

        return {
            status: statusFromSignals(signals),
            summary: signals.length ? (total ? `${plural(total, "community report")}` : "Listed as a known scam") : "No community reports yet",
            facts,
            items,
            signals,
        };
    },
};
