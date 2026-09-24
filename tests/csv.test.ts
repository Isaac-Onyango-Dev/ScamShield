import { describe, expect, it } from "vitest";
import { escapeCell, toCsv } from "../client/src/lib/csv";

/** Minimal RFC 4180 parser used to prove the output round-trips. */
function parse(csv: string): string[][] {
    const text = csv.replace(/^﻿/, "");
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
            if (c === '"' && text[i + 1] === '"') (field += '"'), i++;
            else if (c === '"') quoted = false;
            else field += c;
        } else if (c === '"') quoted = true;
        else if (c === ",") row.push(field), (field = "");
        else if (c === "\r" && text[i + 1] === "\n") row.push(field), rows.push(row), (row = []), (field = ""), i++;
        else field += c;
    }
    return rows;
}

describe("CSV export", () => {
    it('neutralises leading "="', () => expect(escapeCell("=1+1")).toBe(`"'=1+1"`));
    it('neutralises leading "+"', () => expect(escapeCell("+1")).toBe(`"'+1"`));
    it('neutralises leading "-"', () => expect(escapeCell("-2+3")).toBe(`"'-2+3"`));
    it('neutralises leading "@"', () => expect(escapeCell("@SUM(A1)")).toBe(`"'@SUM(A1)"`));
    it("neutralises leading tab", () => expect(escapeCell("\t=1")).toBe(`"'\t=1"`));
    it("neutralises leading carriage return", () => expect(escapeCell("\r=1")).toBe(`"'\r=1"`));

    it("does not prefix a dangerous character that is not leading", () => expect(escapeCell("a=b")).toBe(`"a=b"`));
    it("does not prefix safe values", () => expect(escapeCell("example.com")).toBe(`"example.com"`));
    it("quotes fields containing commas", () => expect(escapeCell("a,b")).toBe(`"a,b"`));
    it("doubles embedded double quotes", () => expect(escapeCell('say "hi"')).toBe(`"say ""hi"""`));

    it("keeps LF newlines inside quoted fields", () => {
        expect(escapeCell("a\nb")).toBe(`"a\nb"`);
        expect(parse(toCsv([["a\nb", "c"]]))).toEqual([["a\nb", "c"]]);
    });

    it("keeps CRLF newlines inside quoted fields", () => {
        expect(escapeCell("a\r\nb")).toBe(`"a\r\nb"`);
        expect(parse(toCsv([["a\r\nb"]]))).toEqual([["a\r\nb"]]);
    });

    it("quotes every field", () => {
        const out = toCsv([
            ["x", 1, true],
            ["", null, "y"],
        ]).replace(/^﻿/, "");
        for (const line of out.split("\r\n").filter(Boolean)) for (const field of line.split(",")) expect(field).toMatch(/^".*"$/s);
    });

    it("renders null and undefined as empty quoted fields", () => {
        expect(escapeCell(null)).toBe('""');
        expect(escapeCell(undefined)).toBe('""');
    });

    it("terminates rows with CRLF", () => {
        expect(toCsv([["a"], ["b"]])).toBe('﻿"a"\r\n"b"\r\n');
    });

    it("starts with a UTF-8 BOM", () => {
        expect(toCsv([["a"]]).charCodeAt(0)).toBe(0xfeff);
    });

    it("round-trips through a CSV parser", () => {
        const rows = [
            ["plain", "with,comma", 'with "quotes"', "multi\nline"],
            ["=HYPERLINK(\"http://x\",\"y\")", "@cmd", "-1", "ok"],
        ];
        expect(parse(toCsv(rows))).toEqual([rows[0], ["'=HYPERLINK(\"http://x\",\"y\")", "'@cmd", "'-1", "ok"]]);
    });
});
