import type { CheckDefinition } from "../engine/types";
import { emailIdentityCheck, gravatarCheck, githubCheck, hibpCheck, infostealerCheck, pgpCheck, xposedOrNotCheck } from "./email";
import { dnsCheck, lookalikeCheck, rdapDomainCheck, tlsCheck } from "./domain";
import { abuseIpDbCheck, ipNetworkCheck } from "./ip";
import { domainBlocklistCheck, ipBlocklistCheck, safeBrowsingCheck, urlhausCheck } from "./reputation";
import { urlStructureCheck } from "./url";
import { phoneCheck } from "./phone";
import { messageCheck } from "./text";
import { communityCheck } from "./community";
import { pivotsCheck } from "./pivots";

/** Every data source ScamShield can consult, in display order. */
export const ALL_CHECKS: CheckDefinition[] = [
    communityCheck,
    // identity
    emailIdentityCheck,
    phoneCheck,
    gravatarCheck,
    githubCheck,
    pgpCheck,
    // content
    messageCheck,
    urlStructureCheck,
    // reputation
    lookalikeCheck,
    safeBrowsingCheck,
    urlhausCheck,
    domainBlocklistCheck,
    ipBlocklistCheck,
    abuseIpDbCheck,
    // exposure
    xposedOrNotCheck,
    hibpCheck,
    infostealerCheck,
    // infrastructure
    dnsCheck,
    rdapDomainCheck,
    tlsCheck,
    ipNetworkCheck,
    pivotsCheck,
];
