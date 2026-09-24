import { useState } from "react";
import type { LookupReport, Signal } from "@shared/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SignalList } from "./SignalList";
import { VerdictMeter } from "./VerdictMeter";

const TOP = 5;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="flex flex-col gap-2 border-t border-line pt-4">
            <h3 className="text-footnote font-semibold text-fg">{title}</h3>
            {children}
        </section>
    );
}

/** Links a verdict signal to the source card that produced it. */
function cardHref(report: LookupReport) {
    return (signal: Signal) => {
        const check = report.checks.find((c) => c.signals.some((s) => s.id === signal.id && s.label === signal.label));
        return check ? `#source-${check.id}` : undefined;
    };
}

export function VerdictPanel({ report, sources }: { report?: LookupReport; sources: number }) {
    const [allFlags, setAllFlags] = useState(false);
    const verdict = report?.verdict;
    const noData = verdict?.confidence === 0;
    const flags = verdict?.topSignals ?? [];
    return (
        <Card as="section" aria-label="Verdict" className="flex flex-col gap-4 p-5">
            {noData ? (
                <div className="flex flex-col gap-1">
                    <p className="text-footnote font-semibold text-fg-secondary">Risk score</p>
                    <p className="text-title-3 font-semibold text-fg">Not enough data</p>
                    <p className="text-footnote text-fg-secondary">No source answered. Try again later.</p>
                </div>
            ) : (
                <VerdictMeter score={verdict ? verdict.score : null} level={verdict?.level ?? "low"} label={verdict?.label ?? ""} />
            )}
            {verdict && (
                <p className="text-caption text-fg-tertiary">
                    Confidence {Math.round(verdict.confidence * 100)}% · {sources} sources
                </p>
            )}

            {report && (
                <>
                    <Section title="Summary">
                        <p className="text-caption text-fg-tertiary">
                            {report.summary.generatedBy === "ai" ? "Written by AI · the score is rule-based" : "Generated from rules"}
                        </p>
                        <p className="text-footnote text-fg-secondary">{report.summary.text}</p>
                    </Section>
                    {flags.length > 0 && (
                        <Section title={`Red flags (${flags.length})`}>
                            <SignalList signals={allFlags ? flags : flags.slice(0, TOP)} hrefFor={cardHref(report)} />
                            {flags.length > TOP && (
                                <Button variant="plain" size="sm" className="self-start" onClick={() => setAllFlags(!allFlags)} aria-expanded={allFlags}>
                                    {allFlags ? "Show fewer" : `Show all ${flags.length}`}
                                </Button>
                            )}
                        </Section>
                    )}
                    {verdict!.trustSignals.length > 0 && (
                        <Section title="Trust signals">
                            <SignalList signals={verdict!.trustSignals} hrefFor={cardHref(report)} />
                        </Section>
                    )}
                    <Section title="What to do">
                        <ol className="flex list-decimal flex-col gap-1 pl-5 text-footnote text-fg-secondary marker:text-fg-tertiary">
                            {report.summary.recommendations.map((r) => (
                                <li key={r}>{r}</li>
                            ))}
                        </ol>
                    </Section>
                </>
            )}
        </Card>
    );
}
