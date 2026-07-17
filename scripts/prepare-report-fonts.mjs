import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const packageRoot = path.join(
  projectRoot,
  "node_modules",
  "@fontsource-variable",
  "noto-sans-tc",
);
const outputRoot = path.join(projectRoot, "public", "report-fonts");

await mkdir(outputRoot, { recursive: true });
await mkdir(path.join(outputRoot, "files"), { recursive: true });

const sourceCss = await readFile(path.join(packageRoot, "wght.css"), "utf8");
const reportCss = sourceCss
  .replaceAll("'Noto Sans TC Variable'", "'Jenfu Report Sans'")
  .replaceAll("font-display: swap", "font-display: block");

await Promise.all([
  writeFile(
    path.join(outputRoot, "report-font.css"),
    `/* Generated from @fontsource-variable/noto-sans-tc. */\n${reportCss}`,
  ),
  cp(path.join(packageRoot, "files"), path.join(outputRoot, "files"), {
    recursive: true,
    force: true,
  }),
  cp(path.join(packageRoot, "LICENSE"), path.join(outputRoot, "LICENSE.txt")),
]);
