import { mkdir, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { homedir } from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";
import type { Plugin, PreviewServer, ViteDevServer } from "vite";

const maximumPayloadBytes = 4 * 1024 * 1024;
const localHostPattern = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maximumPayloadBytes) throw new Error("PAYLOAD_TOO_LARGE");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function safeFileName(value: unknown): string {
  const fallback = "report.pdf";
  if (typeof value !== "string") return fallback;
  const withoutControlCharacters = Array.from(value, (character) =>
    character.charCodeAt(0) < 32 ? "-" : character,
  ).join("");
  const cleaned = withoutControlCharacters.replace(/[<>:"/\\|?*]/g, "-").trim();
  if (!cleaned) return fallback;
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned}.pdf`;
}

async function savePdf(pdf: Buffer, fileName: string): Promise<string> {
  const outputDirectory =
    process.env.REPORT_PDF_OUTPUT_DIR ?? path.join(homedir(), "Downloads");
  await mkdir(outputDirectory, { recursive: true });
  const extension = path.extname(fileName);
  const stem = path.basename(fileName, extension);
  for (let sequence = 0; sequence < 10_000; sequence += 1) {
    const suffix = sequence === 0 ? "" : ` (${sequence})`;
    const candidate = path.join(
      outputDirectory,
      `${stem}${suffix}${extension}`,
    );
    try {
      await writeFile(candidate, pdf, { flag: "wx" });
      return candidate;
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "EEXIST"
      ) {
        continue;
      }
      throw error;
    }
  }
  throw new Error("REPORT_FILE_NAME_EXHAUSTED");
}

async function createPdf(html: string, origin: string): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(async () => {
      const query = '400 12px "Jenfu Report Sans"';
      const probe = "鉦富機械油脂截留器報告草稿 0123456789";
      const loadedFonts = await document.fonts.load(query, probe);
      await document.fonts.ready;
      if (loadedFonts.length === 0 || !document.fonts.check(query, probe)) {
        throw new Error("Bundled report font is unavailable");
      }
      await Promise.all(
        Array.from(document.images, async (image) => {
          if (!image.complete) {
            await new Promise<void>((resolve, reject) => {
              image.addEventListener("load", () => resolve(), { once: true });
              image.addEventListener("error", () => reject(), { once: true });
            });
          }
          if (image.naturalWidth === 0) {
            throw new Error("Report image unavailable");
          }
          if (typeof image.decode === "function") await image.decode();
        }),
      );
    });
    return Buffer.from(
      await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: false,
      }),
    );
  } finally {
    await browser.close();
  }
}

function registerMiddleware(server: ViteDevServer | PreviewServer) {
  server.middlewares.use(
    "/api/report-pdf",
    async (request: IncomingMessage, response: ServerResponse) => {
      if (request.method !== "POST") {
        response.statusCode = 405;
        response.setHeader("Allow", "POST");
        response.end();
        return;
      }

      try {
        const host = request.headers.host ?? "";
        if (!localHostPattern.test(host)) throw new Error("INVALID_HOST");
        const origin = request.headers.origin;
        if (origin && origin !== `http://${host}`) {
          throw new Error("INVALID_ORIGIN");
        }
        const body = await readBody(request);
        const contentType = request.headers["content-type"] ?? "";
        if (!contentType.includes("application/json")) {
          throw new Error("UNSUPPORTED_MEDIA_TYPE");
        }
        const payload = JSON.parse(body) as {
          html?: unknown;
          fileName?: unknown;
        };
        if (typeof payload.html !== "string" || payload.html.length === 0) {
          throw new Error("INVALID_REPORT");
        }
        const fileName = safeFileName(payload.fileName);
        const pdf = await createPdf(payload.html, `http://${host}`);
        const savedPath = await savePdf(pdf, fileName);
        response.statusCode = 200;
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.end(JSON.stringify({ fileName, savedPath }));
      } catch (error) {
        response.statusCode =
          error instanceof Error && error.message === "PAYLOAD_TOO_LARGE"
            ? 413
            : error instanceof Error &&
                error.message === "UNSUPPORTED_MEDIA_TYPE"
              ? 415
              : 500;
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.end(JSON.stringify({ error: "REPORT_PDF_FAILED" }));
      }
    },
  );
}

export function reportPdfPlugin(): Plugin {
  return {
    name: "report-pdf",
    configureServer(server) {
      registerMiddleware(server);
    },
    configurePreviewServer(server) {
      registerMiddleware(server);
    },
  };
}
