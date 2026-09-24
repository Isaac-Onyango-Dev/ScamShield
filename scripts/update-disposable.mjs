// Refreshes the bundled disposable-email domain list from the community-maintained source.
// Usage: npm run data:disposable
import { writeFile } from "node:fs/promises";

const SOURCE =
    "https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf";

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`Download failed: ${res.status}`);
const domains = [
    ...new Set(
        (await res.text())
            .split("\n")
            .map((l) => l.trim().toLowerCase())
            .filter((l) => l && !l.startsWith("#")),
    ),
].sort();
if (domains.length < 1000) throw new Error(`Suspiciously small list (${domains.length}); refusing to overwrite`);
await writeFile(new URL("../server/data/disposable-domains.json", import.meta.url), JSON.stringify(domains));
console.log(`Wrote ${domains.length} disposable domains`);
