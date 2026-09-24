import type { LookupReport } from "@shared/types";
import { toCsv, type CsvValue } from "./csv";

export const CSV_COLUMNS = [
    "generated_at",
    "target_type",
    "target",
    "source_id",
    "source_name",
    "category",
    "status",
    "summary",
    "signal_kind",
    "signal_severity",
    "signal_label",
    "source_url",
    "duration_ms",
] as const;

/** One row per signal; a source without signals still gets one row with empty signal columns. */
export function reportRows(report: LookupReport): CsvValue[][] {
    const rows: CsvValue[][] = [[...CSV_COLUMNS]];
    for (const check of report.checks) {
        const base = [report.generatedAt, report.target.type, report.target.normalized, check.id, check.name, check.category, check.status, check.summary];
        const tail = [check.source?.url ?? "", check.durationMs];
        if (check.signals.length === 0) rows.push([...base, "", "", "", ...tail]);
        for (const s of check.signals) rows.push([...base, s.kind, s.severity, s.label, ...tail]);
    }
    return rows;
}

function download(filename: string, content: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    // Revoking synchronously can cancel the download in some browsers (audit #30).
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const filename = (report: LookupReport, ext: string) => `scamshield-${report.target.type}-${Date.now()}.${ext}`;

export function exportJson(report: LookupReport) {
    download(filename(report, "json"), JSON.stringify(report, null, 2), "application/json");
}

export function exportCsv(report: LookupReport) {
    download(filename(report, "csv"), toCsv(reportRows(report)), "text/csv;charset=utf-8");
}
