#!/usr/bin/env node
// Copies the latin-subset variable fonts (and their OFL licences) from the pinned
// @fontsource-variable devDependencies into client/public/fonts with versioned names,
// so index.html can preload a stable URL (docs/REDESIGN_PLAN.md §3.2.1).
import { copyFile, mkdir, readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

const OUT = "client/public/fonts";
const FONTS = [
    { pkg: "@fontsource-variable/inter", file: "inter-latin-wght-normal.woff2", name: "inter-latin-wght", licence: "OFL-Inter.txt" },
    { pkg: "@fontsource-variable/jetbrains-mono", file: "jetbrains-mono-latin-wght-normal.woff2", name: "jetbrains-mono-latin-wght", licence: "OFL-JetBrainsMono.txt" },
];

await mkdir(OUT, { recursive: true });
for (const f of await readdir(OUT)) await rm(path.join(OUT, f));
for (const font of FONTS) {
    const dir = path.join("node_modules", font.pkg);
    const { version } = JSON.parse(await readFile(path.join(dir, "package.json"), "utf8"));
    const target = `${font.name}-${version}.woff2`;
    await copyFile(path.join(dir, "files", font.file), path.join(OUT, target));
    await copyFile(path.join(dir, "LICENSE"), path.join(OUT, font.licence));
    console.log(`${font.pkg}@${version} -> ${OUT}/${target}, ${OUT}/${font.licence}`);
}
