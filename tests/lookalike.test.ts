import { describe, expect, it } from "vitest";
import { analyzeHost, isFiller, levenshtein, skeleton } from "../server/checks/lookalike";
import { toAsciiHost } from "../shared/detect";

const ids = (host: string) => analyzeHost(host).signals.map((s) => `${s.kind}:${s.id}:${s.severity}`);

describe("analyzeHost", () => {
    it("trusts official brand domains and their subdomains", () => {
        expect(analyzeHost("www.paypal.com").official?.name).toBe("PayPal");
        expect(ids("login.microsoftonline.com")).toContain("trust:host.official-brand:high");
    });

    it("flags brand names glued to phishing words", () => {
        const a = analyzeHost("paypal-secure-login.xyz");
        expect(a.impersonates?.name).toBe("PayPal");
        expect(ids("paypal-secure-login.xyz")).toEqual(
            expect.arrayContaining(["risk:host.brand-embedded:high", "risk:host.phish-keywords:medium", "risk:host.abused-tld:low"]),
        );
        expect(analyzeHost("appleidverify.com").impersonates?.name).toBe("Apple");
    });

    it("does not flag brand names that are just part of another word", () => {
        expect(analyzeHost("pineapplefarm.com").impersonates).toBeUndefined();
        expect(analyzeHost("businessoutlook.org").impersonates).toBeUndefined();
        expect(analyzeHost("startups.io").impersonates).toBeUndefined();
    });

    it("detects digit homoglyphs", () => {
        expect(ids("paypa1.com")).toContain("risk:host.homoglyph:high");
        expect(ids("g00gle-login.net")).toContain("risk:host.homoglyph:high");
    });

    it("rates short-brand typos as medium (dictionary words collide) and long ones high", () => {
        expect(ids("applle.com")).toContain("risk:host.typosquat:medium");
        expect(ids("microsfot.com")).toContain("risk:host.typosquat:high");
    });

    it("catches brand names on the wrong TLD", () => {
        expect(ids("paypal.co")).toContain("risk:host.brand-wrong-tld:high");
    });

    it("detects mixed-script IDN homograph attacks", () => {
        const host = toAsciiHost("аpple.com")!; // Cyrillic "а"
        expect(host.startsWith("xn--")).toBe(true);
        const found = ids(host);
        expect(found).toContain("risk:host.mixed-script:high");
        expect(found).toContain("risk:host.homoglyph:high");
    });

    it("flags brand in subdomain, higher when the real domain is spelled out", () => {
        expect(ids("paypal.com.account-check.ru")).toContain("risk:host.brand-subdomain:high");
    });

    it("recognizes URL shorteners", () => {
        expect(analyzeHost("bit.ly").shortener).toBe(true);
    });
});

describe("helpers", () => {
    it("levenshtein", () => {
        expect(levenshtein("kitten", "sitting")).toBe(3);
        expect(levenshtein("same", "same")).toBe(0);
    });
    it("skeleton folds confusables", () => {
        expect(skeleton("rnicr0s0ft")).toBe("microsoft");
    });
    it("isFiller segments phishing vocabulary", () => {
        expect(isFiller("securelogin")).toBe(true);
        expect(isFiller("farm")).toBe(false);
    });
});
