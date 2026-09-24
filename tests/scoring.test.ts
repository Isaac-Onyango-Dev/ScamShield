import { describe, expect, it } from "vitest";
import { computeVerdict, levelFor } from "../server/engine/scoring";
import type { CheckResult, Signal } from "../shared/types";

const result = (signals: Signal[], status: CheckResult["status"] = "info"): CheckResult => ({
    id: Math.random().toString(),
    name: "x",
    category: "reputation",
    status,
    summary: "",
    facts: [],
    signals,
    durationMs: 1,
});
const r = (severity: Signal["severity"], id = severity + Math.random()): Signal => ({ id, kind: "risk", severity, label: id });
const t = (severity: Signal["severity"], id = "t" + severity + Math.random()): Signal => ({ id, kind: "trust", severity, label: id });

describe("computeVerdict", () => {
    it("is 0 with no evidence", () => {
        expect(computeVerdict([result([])]).score).toBe(0);
    });

    it("combines independent risks without exceeding 100", () => {
        const v = computeVerdict([result([r("high"), r("high"), r("high"), r("critical")])]);
        expect(v.score).toBeLessThanOrEqual(100);
        expect(v.level).toBe("critical");
    });

    it("trust dampens moderate risk", () => {
        const without = computeVerdict([result([r("medium"), r("low")])]).score;
        const withTrust = computeVerdict([result([r("medium"), r("low"), t("high")])]).score;
        expect(withTrust).toBeLessThan(without);
    });

    it("never lets trust hide a critical finding", () => {
        const v = computeVerdict([result([r("critical"), t("high"), t("high"), t("medium")])]);
        expect(v.score).toBeGreaterThanOrEqual(80);
    });

    it("two independent high signals floor at 60", () => {
        const v = computeVerdict([result([r("high"), r("high"), t("high")])]);
        expect(v.score).toBeGreaterThanOrEqual(60);
    });

    it("deduplicates identical signal ids keeping the most severe", () => {
        const v = computeVerdict([result([r("low", "dup")]), result([r("high", "dup")])]);
        expect(v.topSignals).toHaveLength(1);
        expect(v.topSignals[0].severity).toBe("high");
    });

    it("confidence reflects failed sources and ignores skipped ones", () => {
        const v = computeVerdict([result([], "clean"), result([], "error"), result([], "skipped")]);
        expect(v.confidence).toBe(0.5);
    });

    it("levels", () => {
        expect([0, 20, 40, 60, 80].map(levelFor)).toEqual(["safe", "low", "medium", "high", "critical"]);
    });
});
