import net from "node:net";

/**
 * SSRF guard. Any check that opens a socket to a user-supplied host must only
 * connect to public unicast addresses — never loopback, RFC1918, link-local
 * (cloud metadata at 169.254.169.254), CGNAT, multicast or reserved ranges.
 */
const V4_BLOCKS: [string, number][] = [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.88.99.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
];

function v4ToInt(ip: string): number {
    return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function inV4Block(ip: string, base: string, bits: number): boolean {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (v4ToInt(ip) & mask) === (v4ToInt(base) & mask);
}

export type IpClass = "public" | "private" | "loopback" | "link-local" | "reserved" | "multicast" | "cgnat";

export function classifyIp(ip: string): IpClass {
    const family = net.isIP(ip);
    if (family === 4) {
        if (inV4Block(ip, "127.0.0.0", 8)) return "loopback";
        if (inV4Block(ip, "169.254.0.0", 16)) return "link-local";
        if (inV4Block(ip, "100.64.0.0", 10)) return "cgnat";
        if (inV4Block(ip, "224.0.0.0", 4)) return "multicast";
        if (inV4Block(ip, "10.0.0.0", 8) || inV4Block(ip, "172.16.0.0", 12) || inV4Block(ip, "192.168.0.0", 16)) {
            return "private";
        }
        return V4_BLOCKS.some(([b, m]) => inV4Block(ip, b, m)) ? "reserved" : "public";
    }
    if (family === 6) {
        const lower = ip.toLowerCase();
        const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
        if (mapped) return classifyIp(mapped[1]);
        if (lower === "::1") return "loopback";
        if (lower === "::") return "reserved";
        if (/^fe[89ab]/.test(lower)) return "link-local";
        if (/^f[cd]/.test(lower)) return "private";
        if (/^ff/.test(lower)) return "multicast";
        if (/^2001:0?db8:/.test(lower) || /^64:ff9b:/.test(lower) || /^2002:/.test(lower)) return "reserved";
        return /^[23]/.test(lower) ? "public" : "reserved";
    }
    return "reserved";
}

export function isPublicIp(ip: string): boolean {
    return classifyIp(ip) === "public";
}
