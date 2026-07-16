import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

export async function renderPdfBufferFromHtml(html: string) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ locale: "zh-TW" });
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.emulateMedia({ media: "print" });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
    });
  } finally {
    await browser.close();
  }
}

export async function renderPdfFromHtml(html: string, outputPath: string) {
  const resolved = path.resolve(outputPath);
  await mkdir(path.dirname(resolved), { recursive: true });
  await writeFile(resolved, await renderPdfBufferFromHtml(html));
  return resolved;
}
