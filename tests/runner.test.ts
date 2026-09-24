import { describe, expect, it } from "vitest";
import { applicableChecks, createMemo, runChecks } from "../server/engine/runner";
import type { CheckDefinition } from "../server/engine/types";
import { ctx, target, testConfig } from "./helpers";

const def = (over: Partial<CheckDefinition>): CheckDefinition => ({
    id: "t",
    name: "T",
    category: "reputation",
    appliesTo: ["domain"],
    run: async () => ({ status: "clean", summary: "ok" }),
    ...over,
});

describe("runner", () => {
    it("filters by target type and supports()", () => {
        const checks = [def({ id: "a" }), def({ id: "b", appliesTo: ["email"] }), def({ id: "c", supports: () => false })];
        expect(applicableChecks(checks, target("x.com")).map((c) => c.id)).toEqual(["a"]);
    });

    it("isolates failures, enforces timeouts and aborts slow sources", async () => {
        let aborted = false;
        const checks = [
            def({ id: "ok" }),
            def({ id: "boom", run: async () => { throw new Error("upstream exploded"); } }),
            def({
                id: "slow",
                timeoutMs: 50,
                run: ({ signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => { aborted = true; reject(new Error("aborted")); })),
            }),
            def({ id: "keyless", disabledReason: () => "Requires KEY" }),
        ];
        const streamed: string[] = [];
        const results = await runChecks(checks, ctx(target("x.com")), testConfig, (r) => streamed.push(r.id));
        const byId = Object.fromEntries(results.map((r) => [r.id, r]));
        expect(byId.ok.status).toBe("clean");
        expect(byId.boom).toMatchObject({ status: "error", error: "upstream exploded" });
        expect(byId.slow).toMatchObject({ status: "error", error: expect.stringMatching(/Timed out/) });
        expect(byId.keyless).toMatchObject({ status: "skipped", summary: "Requires KEY" });
        expect(aborted).toBe(true);
        expect(streamed.sort()).toEqual(["boom", "keyless", "ok", "slow"]);
    });

    it("memo shares in-flight work but retries after failure", async () => {
        const memo = createMemo();
        let calls = 0;
        const fn = () => Promise.resolve(++calls);
        await Promise.all([memo("k", fn), memo("k", fn)]);
        expect(calls).toBe(1);
        await expect(memo("bad", () => Promise.reject(new Error("x")))).rejects.toThrow();
        await expect(memo("bad", () => Promise.resolve(2))).resolves.toBe(2);
    });
});
