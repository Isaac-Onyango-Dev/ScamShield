import type { CheckCategory } from "@shared/types";

/** Display order of result groups on the results and Sources pages. */
export const CATEGORY_ORDER: CheckCategory[] = ["community", "reputation", "content", "identity", "exposure", "infrastructure", "pivots"];

export const CATEGORY_LABELS: Record<CheckCategory, { title: string; blurb: string }> = {
    community: { title: "Community intelligence", blurb: "What other people have reported" },
    reputation: { title: "Threat reputation", blurb: "Blocklists, threat feeds and impersonation analysis" },
    content: { title: "Content analysis", blurb: "What the link or message itself reveals" },
    identity: { title: "Identity & footprint", blurb: "Public profiles and ownership signals" },
    exposure: { title: "Breach & leak exposure", blurb: "Data breaches and malware logs" },
    infrastructure: { title: "Infrastructure", blurb: "DNS, registration, certificates and networks" },
    pivots: { title: "Investigate further", blurb: "Deep links to specialist tools" },
};
