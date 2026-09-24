/**
 * CSV encoding hardened against formula injection (OWASP "CSV Injection"; plan §4.3.1).
 * Pure: no DOM access, so it's unit-tested in Node (tests/csv.test.ts).
 *
 * - Cells starting with = + - @ tab or carriage return get a leading single quote, so
 *   spreadsheets treat them as text (attacker-controlled message text, WHOIS strings…).
 * - Every field is quoted and embedded quotes are doubled (RFC 4180), so commas and line
 *   breaks inside values are safe.
 * - Rows end with CRLF and the file starts with a UTF-8 BOM so Excel detects the encoding.
 */
const FORMULA_PREFIXES = new Set(["=", "+", "-", "@", "\t", "\r"]);

export type CsvValue = string | number | boolean | null | undefined;

export function escapeCell(value: CsvValue): string {
    const text = value === null || value === undefined ? "" : String(value);
    const neutralised = text.length > 0 && FORMULA_PREFIXES.has(text[0]) ? `'${text}` : text;
    return `"${neutralised.replace(/"/g, '""')}"`;
}

export function toCsv(rows: CsvValue[][]): string {
    return "﻿" + rows.map((row) => row.map(escapeCell).join(",") + "\r\n").join("");
}
