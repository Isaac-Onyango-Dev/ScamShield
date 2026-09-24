import { describe, expect, it } from "vitest";
import { ctx, fakeDns, fakeFetch, target } from "./helpers";
import { emailIdentityCheck, gravatarCheck, githubCheck, infostealerCheck, looksRandom, pgpCheck, xposedOrNotCheck } from "../server/checks/email";
import { dnsCheck, rdapDomainCheck, tlsCheck } from "../server/checks/domain";
import { domainBlocklistCheck, ipBlocklistCheck } from "../server/checks/reputation";
import { phoneCheck, normalizePhone } from "../server/checks/phone";
import { messageCheck, extractIndicators } from "../server/checks/text";
import { urlStructureCheck } from "../server/checks/url";
import { communityCheck } from "../server/checks/community";
import { pivotsCheck } from "../server/checks/pivots";
import type { CheckOutput } from "../server/engine/types";

const sigIds = (o: CheckOutput) => (o.signals ?? []).map((s) => s.id);

describe("email.identity", () => {
    it("flags free mailboxes impersonating brands", async () => {
        const out = await emailIdentityCheck.run(ctx(target("support.paypal@gmail.com")));
        expect(sigIds(out)).toContain("email.brand-on-free");
        expect(sigIds(out)).not.toContain("email.official-domain"); // gmail is not "official" for its users
        expect(out.status).toBe("danger");
    });

    it("flags disposable providers", async () => {
        const out = await emailIdentityCheck.run(ctx(target("abc@mailinator.com")));
        expect(sigIds(out)).toContain("email.disposable");
    });

    it("trusts addresses on an official brand domain", async () => {
        const out = await emailIdentityCheck.run(ctx(target("service@paypal.com")));
        expect(sigIds(out)).toEqual(["email.official-domain"]);
    });

    it("does not treat substrings as brands", async () => {
        const out = await emailIdentityCheck.run(ctx(target("pineapple.lover@gmail.com")));
        expect(sigIds(out)).not.toContain("email.brand-on-free");
    });

    it("looksRandom", () => {
        expect(looksRandom("xk2q9wzr81")).toBe(true);
        expect(looksRandom("john.smith")).toBe(false);
    });
});

describe("dns", () => {
    it("marks non-existent email domains as high risk", async () => {
        const out = await dnsCheck.run(ctx(target("a@nope-nope.com"), { dns: fakeDns({}) }));
        expect(sigIds(out)).toEqual(["dns.nxdomain"]);
        expect(out.signals![0].severity).toBe("high");
    });

    it("reads MX/SPF/DMARC and recognizes providers", async () => {
        const dns = fakeDns({
            "acme.com": {
                A: ["93.184.216.34"],
                MX: [{ exchange: "aspmx.l.google.com", priority: 1 }],
                TXT: [["v=spf1 include:_spf.google.com ~all"]],
            },
            "_dmarc.acme.com": { TXT: [["v=DMARC1; p=reject; rua=mailto:d@acme.com"]] },
        });
        const out = await dnsCheck.run(ctx(target("bob@acme.com"), { dns }));
        expect(out.facts).toEqual(expect.arrayContaining([{ label: "Mail provider", value: "Google Workspace / Gmail" }]));
        expect(sigIds(out)).toEqual(["dns.dmarc-enforced"]);
    });

    it("flags null MX and missing authentication", async () => {
        const dns = fakeDns({ "nomail.com": { A: ["1.2.3.4"], MX: [{ exchange: "", priority: 0 }] }, "_dmarc.nomail.com": {} });
        const out = await dnsCheck.run(ctx(target("x@nomail.com"), { dns }));
        expect(sigIds(out)).toEqual(expect.arrayContaining(["dns.null-mx", "dns.no-auth"]));
    });
});

describe("domain.rdap", () => {
    const rdap = (created: string, status: string[] = []) => ({
        events: [
            { eventAction: "registration", eventDate: created },
            { eventAction: "expiration", eventDate: "2030-01-01T00:00:00Z" },
        ],
        status,
        entities: [{ roles: ["registrar"], vcardArray: ["vcard", [["version", {}, "text", "4.0"], ["fn", {}, "text", "NameCheap, Inc."]]] }],
    });

    it("flags very new domains", async () => {
        const created = new Date(Date.now() - 5 * 86400_000).toISOString();
        const fetch = fakeFetch({ "https://rdap.org/domain/new-shop.com": { body: rdap(created) } });
        const out = await rdapDomainCheck.run(ctx(target("new-shop.com"), { fetch }));
        expect(out.signals![0]).toMatchObject({ id: "domain.age", severity: "high", kind: "risk" });
        expect(out.facts).toEqual(expect.arrayContaining([{ label: "Registrar", value: "NameCheap, Inc." }]));
    });

    it("trusts long-lived domains and flags holds", async () => {
        const fetch = fakeFetch({ "https://rdap.org/domain/old.com": { body: rdap("2001-01-01T00:00:00Z", ["client hold"]) } });
        const out = await rdapDomainCheck.run(ctx(target("www.old.com"), { fetch }));
        expect(out.signals!.map((s) => `${s.kind}:${s.id}`)).toEqual(["trust:domain.age", "risk:domain.hold"]);
    });

    it("is neutral on 404 and skips webmail domains", async () => {
        const fetch = fakeFetch({ "https://rdap.org/": { status: 404 } });
        expect((await rdapDomainCheck.run(ctx(target("x.ke"), { fetch }))).status).toBe("info");
        expect(rdapDomainCheck.supports!(target("a@gmail.com"))).toBe(false);
    });
});

describe("domain.tls SSRF protection", () => {
    it("never connects to private addresses", async () => {
        const dns = fakeDns({ "internal.example.com": { A: ["169.254.169.254"] } });
        const out = await tlsCheck.run(ctx(target("internal.example.com"), { dns }));
        expect(out.summary).toMatch(/not probed/);
        expect(sigIds(out)).toEqual(["tls.private-ip"]);
    });
});

describe("blocklists", () => {
    it("decodes Spamhaus DBL phishing listings as critical", async () => {
        const dns = fakeDns({ "evil.com.dbl.spamhaus.org": { A: ["127.0.1.4"] }, "evil.com.multi.uribl.com": { A: ["127.0.0.1"] } });
        const out = await domainBlocklistCheck.run(ctx(target("login.evil.com"), { dns }));
        expect(out.signals).toEqual([expect.objectContaining({ severity: "critical", label: expect.stringMatching(/phishing/) })]);
        expect(out.facts!.find((f) => f.label === "URIBL")!.value).toMatch(/unavailable/);
    });

    it("treats resolver-refused answers as unavailable, not listed", async () => {
        const dns = fakeDns({
            "x.com.dbl.spamhaus.org": { A: ["127.255.255.254"] },
            "x.com.multi.surbl.org": { A: ["127.0.0.1"] },
            "x.com.multi.uribl.com": { A: ["127.0.0.1"] },
        });
        await expect(domainBlocklistCheck.run(ctx(target("x.com"), { dns }))).rejects.toThrow(/No blocklist answered/);
    });

    it("ignores Spamhaus PBL (policy) listings for IPs", async () => {
        const dns = fakeDns({ "4.3.2.1.zen.spamhaus.org": { A: ["127.0.0.10"] }, "4.3.2.1.dnsbl.dronebl.org": { A: ["127.0.0.3"] } });
        const out = await ipBlocklistCheck.run(ctx(target("1.2.3.4"), { dns }));
        expect(out.signals!.map((s) => s.id)).toEqual(["dnsbl.dnsbl.dronebl.org"]);
    });
});

describe("email exposure sources", () => {
    const email = target("victim@example.com");

    it("parses XposedOrNot breach analytics", async () => {
        const fetch = fakeFetch({
            "https://api.xposedornot.com/v1/breach-analytics": {
                body: {
                    ExposedBreaches: {
                        breaches_details: [
                            { breach: "Adobe", domain: "adobe.com", xposed_date: "2013", xposed_data: "Email addresses;Passwords", xposed_records: 152000000, password_risk: "plaintext" },
                            { breach: "Canva", domain: "canva.com", xposed_date: "2019", xposed_data: "Names;Email addresses" },
                        ],
                    },
                },
            },
        });
        const out = await xposedOrNotCheck.run(ctx(email, { fetch }));
        expect(out.status).toBe("found");
        expect(out.summary).toMatch(/2 breaches \(2013–2019\)/);
        expect(out.items![0].title).toBe("Canva");
        expect(out.signals![0]).toMatchObject({ kind: "trust", id: "email.history" });
    });

    it("treats XposedOrNot 404 as clean", async () => {
        const fetch = fakeFetch({ "https://api.xposedornot.com/": { status: 404, body: { Error: "Not found" } } });
        expect((await xposedOrNotCheck.run(ctx(email, { fetch }))).status).toBe("clean");
    });

    it("surfaces rate limits as errors", async () => {
        const fetch = fakeFetch({ "https://api.xposedornot.com/": { status: 429 } });
        await expect(xposedOrNotCheck.run(ctx(email, { fetch }))).rejects.toThrow(/Rate limited/);
    });

    it("parses Hudson Rock infostealer hits without exposing passwords", async () => {
        const fetch = fakeFetch({
            "https://cavalier.hudsonrock.com/": {
                body: { stealers: [{ date_compromised: "2024-03-01T00:00:00.000Z", stealer_family: "RedLine", operating_system: "Windows 10", computer_name: "D****P", total_user_services: 41, top_passwords: ["h*****1"] }] },
            },
        });
        const out = await infostealerCheck.run(ctx(email, { fetch }));
        expect(out.status).toBe("danger");
        expect(JSON.stringify(out)).not.toContain("h*****1");
        expect(out.items![0]).toMatchObject({ title: "RedLine infostealer", date: "2024-03-01" });
    });

    it("gravatar: 404 is clean, profile is found", async () => {
        expect((await gravatarCheck.run(ctx(email, { fetch: fakeFetch({ "https://api.gravatar.com/": { status: 404 } }) }))).status).toBe("clean");
        const out = await gravatarCheck.run(
            ctx(email, {
                fetch: fakeFetch({
                    "https://api.gravatar.com/": {
                        body: { display_name: "Jane", profile_url: "https://gravatar.com/jane", verified_accounts: [{ service_label: "GitHub", url: "https://github.com/jane" }, { service_label: "X", url: "https://x.com/jane" }] },
                    },
                }),
            }),
        );
        expect(out.status).toBe("found");
        expect(out.signals![0].severity).toBe("medium");
    });

    it("pgp: detects published keys", async () => {
        const out = await pgpCheck.run(ctx(email, { fetch: fakeFetch({ "https://keys.openpgp.org/": { body: "-----BEGIN PGP" } }) }));
        expect(out.status).toBe("found");
    });

    it("github: summarizes commit authorship", async () => {
        const fetch = fakeFetch({
            "https://api.github.com/search/commits": {
                body: {
                    total_count: 3,
                    items: [
                        { html_url: "https://github.com/o/r/commit/1", repository: { full_name: "o/r", html_url: "" }, author: { login: "jane", html_url: "", avatar_url: "" }, commit: { author: { name: "Jane", date: "2020-01-01T00:00:00Z" }, message: "init" } },
                    ],
                },
            },
        });
        const out = await githubCheck.run(ctx(email, { fetch }));
        expect(out.facts).toEqual(expect.arrayContaining([{ label: "GitHub account", value: "@jane", href: "https://github.com/jane" }]));
    });
});

describe("phone", () => {
    it("normalizes to E.164 with the default region", () => {
        expect(normalizePhone("(888) 123-4567", "US")).toBe("+18881234567");
        expect(normalizePhone("0712 345 678", "KE")).toBe("+254712345678");
        expect(normalizePhone("00447911123456", "US")).toBe("+447911123456");
    });

    it("identifies line type and flags premium-rate numbers", async () => {
        const mobile = await phoneCheck.run(ctx(target("+254712345678")));
        expect(mobile.facts).toEqual(expect.arrayContaining([{ label: "Line type", value: "Mobile" }]));
        const premium = await phoneCheck.run(ctx(target("+1 900 555 0123")));
        expect(sigIds(premium)).toContain("phone.premium");
        const intl = await phoneCheck.run(ctx(target("+882 1234 5678")));
        expect(sigIds(intl)).toContain("phone.intl-network");
    });
});

describe("message analysis", () => {
    it("detects combined tactics and extracts indicators", async () => {
        const out = await messageCheck.run(
            ctx(target("URGENT: your account is suspended. Send the OTP code we texted you, then pay the release fee with gift cards. Visit http://amaz0n-verify.top/login or call +1 888 123 4567", "text")),
        );
        expect(sigIds(out)).toEqual(
            expect.arrayContaining(["text.urgency", "text.account-threat", "text.otp", "text.advance-fee", "text.payment-method", "text.combo-pressure-pay"]),
        );
        expect(sigIds(out).some((id) => id.startsWith("text.link."))).toBe(true);
        expect(out.items!.map((i) => i.tags![0])).toEqual(expect.arrayContaining(["link", "phone"]));
        expect(out.status).toBe("danger");
    });

    it("stays clean on ordinary messages", async () => {
        const out = await messageCheck.run(ctx(target("See you at lunch tomorrow, I'll bring the slides for the review.", "text")));
        expect(out.signals).toEqual([]);
        expect(out.status).toBe("clean");
    });

    it("extractIndicators", () => {
        const found = extractIndicators("mail bad@evil.com or go to www.evil.com/x, ref 2024-01-01");
        expect(found.emails).toEqual(["bad@evil.com"]);
        expect(found.urls).toEqual(["www.evil.com/x"]);
    });
});

describe("url.structure", () => {
    it("catches userinfo tricks, raw IPs and executable downloads", async () => {
        const at = await urlStructureCheck.run(ctx(target("http://paypal.com@203.0.113.9:8080/update.exe")));
        expect(sigIds(at)).toEqual(expect.arrayContaining(["url.userinfo", "url.ip-host", "url.port", "url.download", "url.http"]));
    });
    it("flags email-personalized phishing kit links", async () => {
        const out = await urlStructureCheck.run(ctx(target("https://docs-share.web.app/view?u=victim@corp.com")));
        expect(sigIds(out)).toEqual(expect.arrayContaining(["url.email-param", "url.free-hosting"]));
    });
});

describe("community & pivots", () => {
    it("inherits domain reports for emails", async () => {
        const community = {
            lookup: async (type: string, value: string) =>
                type === "domain" && value === "bad.com"
                    ? { known: { category: "Phishing", source: "test" }, reports: null }
                    : { known: null, reports: { count: 4, lastReportedAt: new Date().toISOString(), categories: { scam: 4 }, recent: [] } },
        };
        const out = await communityCheck.run(ctx(target("x@mail.bad.com"), { community }));
        expect(out.signals!.map((s) => s.severity).sort()).toEqual(["critical", "high"]);
    });

    it("produces deep links for every target type", async () => {
        for (const q of ["a@b.com", "b.com", "https://b.com/x", "1.1.1.1", "+18881234567"]) {
            const out = await pivotsCheck.run(ctx(target(q)));
            expect(out.items!.length).toBeGreaterThan(2);
            for (const i of out.items!) expect(i.href).toMatch(/^(https:\/\/|\/search\?q=)/);
        }
    });
});
