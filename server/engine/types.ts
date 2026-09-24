import type { AppConfig } from "../config";
import type { Fetcher } from "../lib/http";
import type { DnsClient } from "../lib/dns";
import type { CommunityStore } from "../lib/community";
import type { CheckCategory, CheckResult, Fact, Item, Signal, Target, TargetType } from "../../shared/types";

export interface CheckContext {
    target: Target;
    signal: AbortSignal;
    config: AppConfig;
    fetch: Fetcher;
    dns: DnsClient;
    community: CommunityStore;
    /** Per-lookup memoization so several checks can share one DNS/RDAP call. */
    memo<T>(key: string, fn: () => Promise<T>): Promise<T>;
}

export interface CheckOutput {
    status: CheckResult["status"];
    summary: string;
    facts?: Fact[];
    items?: Item[];
    signals?: Signal[];
}

export interface CheckDefinition {
    id: string;
    name: string;
    category: CheckCategory;
    appliesTo: TargetType[];
    source?: { name: string; url: string };
    timeoutMs?: number;
    /** Return a reason string when the check cannot run (e.g. missing API key). */
    disabledReason?(config: AppConfig): string | undefined;
    /** Narrower applicability test on the concrete target (e.g. skip IP-host URLs). */
    supports?(target: Target): boolean;
    run(ctx: CheckContext): Promise<CheckOutput>;
}
