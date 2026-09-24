import { parse } from "tldts";
import disposableList from "../data/disposable-domains.json";
import { BRANDS, FREE_EMAIL_PROVIDERS, type Brand } from "../data/lists";

const DISPOSABLE = new Set<string>(disposableList as string[]);

interface HostInfo {
    host: string;
    /** eTLD+1, e.g. "example.co.uk" — null for IPs or bare suffixes. */
    registrable: string | null;
    /** Registrable domain without its public suffix, e.g. "example". */
    label: string | null;
    subdomain: string;
    suffix: string | null;
    tld: string | null;
    isIp: boolean;
}

export function hostInfo(host: string): HostInfo {
    const p = parse(host, { allowPrivateDomains: false });
    return {
        host,
        registrable: p.domain,
        label: p.domainWithoutSuffix,
        subdomain: p.subdomain ?? "",
        suffix: p.publicSuffix,
        tld: p.publicSuffix ? p.publicSuffix.split(".").pop()! : null,
        isIp: !!p.isIp,
    };
}

export function isDisposableDomain(domain: string): boolean {
    const info = hostInfo(domain);
    return DISPOSABLE.has(domain) || (!!info.registrable && DISPOSABLE.has(info.registrable));
}

export function isFreeProvider(domain: string): boolean {
    return FREE_EMAIL_PROVIDERS.has(domain);
}

/** The brand whose official domains include this host (exact or subdomain). */
export function officialBrandFor(host: string): Brand | undefined {
    const info = hostInfo(host);
    return BRANDS.find((b) =>
        b.domains.some((d) => host === d || host.endsWith(`.${d}`) || info.registrable === d),
    );
}

