import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const reportFontRoot = path.resolve("public", "report-fonts");

describe("report font assets", () => {
  it("prepares the bundled Traditional Chinese variable font and its license", async () => {
    const [css, license, files] = await Promise.all([
      readFile(path.join(reportFontRoot, "report-font.css"), "utf8"),
      readFile(path.join(reportFontRoot, "LICENSE.txt"), "utf8"),
      readdir(path.join(reportFontRoot, "files")),
    ]);

    expect(css).toContain("font-family: 'Jenfu Report Sans'");
    expect(css).toContain("font-display: block");
    expect(css).toContain("unicode-range:");
    expect(css).not.toContain("font-display: swap");
    expect(
      files.filter((file) => file.endsWith(".woff2")).length,
    ).toBeGreaterThan(100);
    expect(license).toContain("SIL OPEN FONT LICENSE Version 1.1");
  });
});
