import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import path from "node:path";
import { createApp } from "../server/app";
import { openDatabase, runMigrations } from "../server/lib/db";
import { createCommunityStore } from "../server/lib/community";
import { createReportCache } from "../server/lib/reportCache";
import { createLookupService } from "../server/engine/lookup";
import { rulesSummary } from "../server/engine/summary";
import { seed } from "../server/seed";
import { communityCheck } from "../server/checks/community";
import { emailIdentityCheck } from "../server/checks/email";
import { phoneCheck } from "../server/checks/phone";
import type { CheckDefinition } from "../server/engine/types";
import { fakeDns, fakeFetch, testConfig } from "./helpers";

let runs = 0;
const countingCheck: CheckDefinition = {
    id: "counter",
    name: "Counter",
    category: "infrastructure",
    appliesTo: ["email", "domain", "url", "ip", "phone", "text"],
    run: async () => {
        runs++;
        return { status: "clean", summary: "counted" };
    },
};

function build() {
    const { db } = openDatabase(":memory:");
    runMigrations(db, path.resolve(import.meta.dirname, "../migrations"));
    seed(db);
    const community = createCommunityStore(db);
    const cache = createReportCache(db);
    const checks = [communityCheck, emailIdentityCheck, phoneCheck, countingCheck];
    const lookup = createLookupService({
        config: testConfig,
        checks,
        fetch: fakeFetch({}),
        dns: fakeDns({}),
        community,
        cache,
        summarize: async (t, v, c) => rulesSummary(t, v, c),
        onLookup: () => community.bumpStat("total_lookups"),
    });
    return createApp({ config: testConfig, lookup, community, cache, checks });
}

describe("API", () => {
    let app: ReturnType<typeof build>;
    beforeEach(() => {
        app = build();
        runs = 0;
    });

    it("health", async () => {
        const res = await request(app).get("/api/health");
        expect(res.status).toBe(200);
        expect(res.headers["content-security-policy"]).toContain("default-src 'self'");
    });

    it("validates input", async () => {
        expect((await request(app).get("/api/lookup")).status).toBe(400);
        const bad = await request(app).get("/api/lookup").query({ q: "not an email", type: "email" });
        expect(bad.status).toBe(400);
        expect(bad.body.error).toMatch(/valid email/);
        expect((await request(app).get("/api/lookup").query({ q: "x.com", type: "nope" })).status).toBe(400);
    });

    it("runs a lookup, flags seeded scams, and caches", async () => {
        const first = await request(app).get("/api/lookup").query({ q: "1-888-123-4567" });
        expect(first.status).toBe(200);
        expect(first.body.target).toMatchObject({ type: "phone", normalized: "+18881234567" });
        expect(first.body.verdict.level).toBe("critical");
        expect(first.body.cached).toBe(false);

        const second = await request(app).get("/api/lookup").query({ q: "+1 (888) 123-4567" });
        expect(second.body.cached).toBe(true);
        expect(runs).toBe(1);

        await request(app).get("/api/lookup").query({ q: "+18881234567", fresh: "1" });
        expect(runs).toBe(2);
    });

    it("streams results over SSE", async () => {
        const res = await request(app).get("/api/lookup/stream").query({ q: "someone@example.org" }).buffer(true).parse((r, cb) => {
            let data = "";
            r.on("data", (c: Buffer) => (data += c.toString()));
            r.on("end", () => cb(null, data));
        });
        expect(res.headers["content-type"]).toMatch(/text\/event-stream/);
        const events = (res.body as string)
            .split("\n\n")
            .filter((l) => l.startsWith("data: "))
            .map((l) => JSON.parse(l.slice(6)));
        expect(events[0].type).toBe("start");
        expect(events.filter((e) => e.type === "check")).toHaveLength(3);
        expect(events.at(-1).type).toBe("done");
    });

    it("accepts reports, dedupes per reporter, invalidates cache and updates stats", async () => {
        await request(app).get("/api/lookup").query({ q: "scammer@evil-shop.biz" });
        const r1 = await request(app).post("/api/reports").send({ query: "Scammer@evil-shop.biz", category: "fraud", description: "Took my deposit" });
        expect(r1.status).toBe(201);
        const dup = await request(app).post("/api/reports").send({ query: "scammer@evil-shop.biz", category: "fraud" });
        expect(dup.status).toBe(200);
        expect(dup.body.duplicate).toBe(true);

        const after = await request(app).get("/api/lookup").query({ q: "scammer@evil-shop.biz" });
        expect(after.body.cached).toBe(false);
        const community = after.body.checks.find((c: { id: string }) => c.id === "community");
        expect(community.summary).toMatch(/1 community report/);

        const stats = await request(app).get("/api/stats");
        expect(stats.body).toMatchObject({ totalReports: 1, reportsLast24h: 1, totalLookups: 2, knownScams: 6 });
        expect(stats.body.topCategories).toEqual([{ category: "fraud", count: 1 }]);
    });

    it("rejects invalid reports and malformed JSON", async () => {
        expect((await request(app).post("/api/reports").send({ query: "x.com", category: "bogus" })).status).toBe(400);
        const res = await request(app).post("/api/reports").set("content-type", "application/json").send("{bad");
        expect(res.status).toBe(400);
    });

    it("lists sources with enablement state", async () => {
        const res = await request(app).get("/api/sources");
        expect(res.body.sources.map((s: { id: string }) => s.id)).toContain("community");
    });

    it("404s unknown API routes as JSON", async () => {
        const res = await request(app).get("/api/nope");
        expect(res.status).toBe(404);
        expect(res.body.error).toBe("Not found");
    });
});
