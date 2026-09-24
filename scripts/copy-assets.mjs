// Copies runtime assets next to the bundled server (cross-platform replacement for cp/robocopy).
import { cp } from "node:fs/promises";

await cp(new URL("../migrations", import.meta.url), new URL("../dist/migrations", import.meta.url), {
    recursive: true,
});
console.log("Copied migrations -> dist/migrations");
