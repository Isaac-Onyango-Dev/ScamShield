import { describe, expect, it } from "vitest";
import { classifyIp, isPublicIp } from "../server/lib/netguard";
import { reverseIp } from "../server/checks/reputation";

describe("SSRF guard", () => {
    it.each(["127.0.0.1", "10.1.2.3", "172.16.5.5", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "fe80::1", "fd00::1", "::ffff:127.0.0.1", "2001:db8::1"])(
        "blocks %s",
        (ip) => expect(isPublicIp(ip)).toBe(false),
    );
    it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])("allows %s", (ip) => expect(isPublicIp(ip)).toBe(true));
    it("classifies metadata endpoint as link-local", () => expect(classifyIp("169.254.169.254")).toBe("link-local"));
    it("rejects non-IPs", () => expect(isPublicIp("example.com")).toBe(false));
});

describe("reverseIp", () => {
    it("reverses IPv4 octets", () => expect(reverseIp("1.2.3.4")).toBe("4.3.2.1"));
    it("reverses expanded IPv6 nibbles", () => {
        const r = reverseIp("2001:db8::1");
        expect(r.split(".")).toHaveLength(32);
        expect(r.startsWith("1.0.0.0.")).toBe(true);
        expect(r.endsWith(".8.b.d.0.1.0.0.2")).toBe(true);
    });
});
