import { describe, expect, it } from "vitest";
import { detectType, parseTarget, refang } from "../shared/detect";

describe("detectType", () => {
    it.each([
        ["john.doe+news@Example.COM", "email"],
        ["mailto:a@b.co", "email"],
        ["https://example.com/login?x=1", "url"],
        ["example.com/path", "url"],
        ["hxxp://evil[.]com/pay", "url"],
        ["sub.example.co.uk", "domain"],
        ["evil[.]com", "domain"],
        ["8.8.8.8", "ip"],
        ["2001:4860:4860::8888", "ip"],
        ["+1 (888) 123-4567", "phone"],
        ["0712 345 678", "phone"],
        ["Your parcel is held, pay the fee", "text"],
        ["999.1.1.1", "ip"], // so the user gets "not a valid IP" rather than a phone lookup
    ])("%s -> %s", (input, expected) => {
        expect(detectType(input)).toBe(expected);
    });
});

describe("parseTarget", () => {
    it("normalizes email domains to lowercase ASCII", () => {
        const r = parseTarget("User@BÜCHER.de");
        expect(r.ok && r.target).toMatchObject({ type: "email", normalized: "user@xn--bcher-kva.de", host: "xn--bcher-kva.de" });
    });

    it("strips URL fragments and extracts host", () => {
        const r = parseTarget("HTTPS://Example.com/a#frag");
        expect(r.ok && r.target).toMatchObject({ type: "url", normalized: "https://example.com/a", host: "example.com" });
    });

    it("refangs defanged indicators", () => {
        expect(refang("hxxps://bad[.]site[.]com")).toBe("https://bad.site.com");
        const r = parseTarget("bad[.]example[.]com");
        expect(r.ok && r.target.normalized).toBe("bad.example.com");
    });

    it("rejects invalid input with a helpful message", () => {
        expect(parseTarget("")).toEqual({ ok: false, error: expect.stringMatching(/Enter/) });
        expect(parseTarget("ftp://x.com", "url")).toEqual({ ok: false, error: expect.stringMatching(/http/) });
        expect(parseTarget("hi", "text").ok).toBe(false);
        expect(parseTarget("x".repeat(5000)).ok).toBe(false);
    });

    it("respects a forced type", () => {
        const r = parseTarget("example.com", "domain");
        expect(r.ok && r.target.type).toBe("domain");
    });
});
