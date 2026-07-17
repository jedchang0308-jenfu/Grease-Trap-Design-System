import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";

async function assertViewportSafe(page: Page) {
  await expect(
    page.locator(".runtime-error:visible, .inline-error:visible"),
  ).toHaveCount(0);
  const dimensions = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
}

async function saveEvidence(page: Page, project: string, name: string) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const directory = path.join(
    tmpdir(),
    "grease-trap-e2e-evidence",
    String(process.pid),
    project,
  );
  await mkdir(directory, { recursive: true });
  await page.screenshot({
    path: path.join(directory, `${name}.png`),
    fullPage: true,
  });
}

async function saveReportPdfEvidence(
  browser: Browser,
  page: Page,
  project: string,
) {
  if (project !== "desktop-1440") return;

  const iframe = page.locator('iframe[title="客戶設計計算報告草稿預覽"]');
  const source = await iframe.getAttribute("srcdoc");
  expect(source).not.toBeNull();

  const baseUrl = "http://127.0.0.1:3210";
  const evidenceUrl = `${baseUrl}/__report-evidence.html`;
  const directory = path.join(tmpdir(), "grease-trap-pdf-evidence");
  await mkdir(directory, { recursive: true });

  const context = await browser.newContext();
  await context.route(evidenceUrl, (route) =>
    route.fulfill({ contentType: "text/html; charset=utf-8", body: source! }),
  );
  const reportPage = await context.newPage();
  try {
    await reportPage.goto(evidenceUrl, { waitUntil: "networkidle" });
    const assets = await reportPage.evaluate(async () => {
      const query = '400 12px "Jenfu Report Sans"';
      const probe = "鉦富機械油脂截留器報告草稿 0123456789";
      const loadedFonts = await document.fonts.load(query, probe);
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.images, (image) =>
          typeof image.decode === "function" ? image.decode() : undefined,
        ),
      );
      return {
        font: loadedFonts.length > 0 && document.fonts.check(query, probe),
        failedImages: Array.from(document.images)
          .filter((image) => image.naturalWidth === 0)
          .map((image) => image.src),
      };
    });
    expect(assets.font).toBe(true);
    expect(assets.failedImages).toEqual([]);

    await reportPage.emulateMedia({ media: "print" });
    await reportPage.pdf({
      path: path.join(directory, `report-draft-a4-${process.pid}.pdf`),
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
    });
  } finally {
    await context.close();
  }
}

test("anonymous shared SPA completes the dual-track report-draft workflow", async ({
  browser,
  page,
}, testInfo) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    const expectedSandboxBlock = text.includes(
      "Blocked script execution in 'about:srcdoc'",
    );
    if (message.type() === "error" && !expectedSandboxBlock) {
      consoleErrors.push(text);
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/cases");
  await expect(page.getByRole("heading", { name: "案件清單" })).toBeVisible({
    timeout: 30_000,
  });
  await assertViewportSafe(page);
  await saveEvidence(page, testInfo.project.name, "01-cases");

  await page.getByRole("link", { name: "建立案件" }).first().click();
  await expect(page.getByTestId("new-case-wizard-ready")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.getByRole("button", { name: "下一步：選擇模式" }).click();
  await page.getByText("不同計算依據對照", { exact: true }).click();
  await page.getByRole("button", { name: "下一步：填寫資料" }).click();

  const title = `E2E 共享雙軌案件 ${testInfo.project.name} ${Date.now()}`;
  await page.getByLabel("客戶名稱（選填）").fill("E2E 測試客戶");
  await page.getByLabel("案件地點（選填）").fill("臺灣測試地點");
  await page.getByLabel("案件名稱（選填）").fill(title);
  await page
    .getByLabel("用途／情境（選填）")
    .fill("驗證匿名登入、雙軌計算與報告草稿");
  await page.getByLabel("資料提供者或證據（選填）").fill("Playwright fixture");
  await assertViewportSafe(page);
  await saveEvidence(page, testInfo.project.name, "02-new-case");

  await page.getByRole("button", { name: "建立案件並填寫計算資料" }).click();
  await page.waitForURL(/\/cases\/[0-9a-f-]+$/i, { timeout: 30_000 });
  const caseId = page.url().split("/").at(-1);
  expect(caseId).toMatch(/^[0-9a-f-]{36}$/i);

  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await page.getByLabel("餐飲類型", { exact: true }).selectOption("CHINESE");
  await page.getByRole("spinbutton", { name: "每日用餐人數" }).fill("120");
  await page.getByRole("button", { name: "開始計算" }).click();
  await expect(
    page.getByText(/計算已完成；下一步預覽並匯出報告草稿。/),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByRole("heading", { name: "本次設計結果" }),
  ).toBeVisible();
  await assertViewportSafe(page);
  await saveEvidence(page, testInfo.project.name, "03-calculated");

  await page.reload();
  await expect(page.getByRole("heading", { name: title })).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByRole("spinbutton", { name: "每日用餐人數" }),
  ).toHaveValue("120");

  await page.getByRole("link", { name: "預覽報告草稿" }).click();
  await expect(page.getByRole("heading", { name: "報告草稿預覽" })).toBeVisible(
    { timeout: 30_000 },
  );
  const reportFrame = page.frameLocator(
    'iframe[title="客戶設計計算報告草稿預覽"]',
  );
  await expect(
    reportFrame.getByRole("heading", {
      name: "油脂截留器設計計算報告草稿",
      exact: true,
    }),
  ).toBeVisible();
  await assertViewportSafe(page);
  await saveEvidence(page, testInfo.project.name, "04-report-preview");

  await page.getByRole("button", { name: "匯出報告草稿" }).click();
  await expect(page.getByText("報告草稿已保存於共享案件。")).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByText(/瀏覽器列印引擎仍可能造成細微差異/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "列印／另存 PDF" }),
  ).toBeEnabled();

  await page.evaluate(() => {
    const parentWindow = window as typeof window & {
      __reportPrintCalled: boolean;
    };
    parentWindow.__reportPrintCalled = false;
    const frame = document.querySelector<HTMLIFrameElement>("iframe");
    if (frame?.contentWindow) {
      frame.contentWindow.print = () => {
        parentWindow.__reportPrintCalled = true;
      };
    }
  });
  await page.getByRole("button", { name: "列印／另存 PDF" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { __reportPrintCalled?: boolean })
            .__reportPrintCalled,
      ),
    )
    .toBe(true);
  await saveReportPdfEvidence(browser, page, testInfo.project.name);

  await page.goto(`/cases/${caseId}/report`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "報告草稿預覽" })).toBeVisible(
    {
      timeout: 30_000,
    },
  );
  await expect(
    page.getByRole("button", { name: "列印／另存 PDF" }),
  ).toBeEnabled();
  await expect(
    reportFrame.getByRole("heading", {
      name: "油脂截留器設計計算報告草稿",
      exact: true,
    }),
  ).toBeVisible({ timeout: 30_000 });
  await assertViewportSafe(page);
  await saveEvidence(page, testInfo.project.name, "05-exported-draft");

  const secondContext = await browser.newContext();
  const secondPage = await secondContext.newPage();
  await secondPage.goto(`/cases/${caseId}`);
  await expect(secondPage.getByRole("heading", { name: title })).toBeVisible({
    timeout: 30_000,
  });
  await secondPage.reload();
  await expect(secondPage.getByRole("heading", { name: title })).toBeVisible();
  await secondPage.goto(`/cases/${caseId}/report`);
  await expect(
    secondPage.getByRole("heading", { name: "報告草稿預覽" }),
  ).toBeVisible({ timeout: 30_000 });
  const secondReportFrame = secondPage.frameLocator(
    'iframe[title="客戶設計計算報告草稿預覽"]',
  );
  await secondReportFrame.locator("body").evaluate(async (body) => {
    const reportDocument = body.ownerDocument;
    await reportDocument.fonts.load(
      '400 12px "Jenfu Report Sans"',
      "鉦富機械油脂截留器報告草稿 0123456789",
    );
    await reportDocument.fonts.ready;
    await Promise.all(
      Array.from(reportDocument.images, (image) =>
        typeof image.decode === "function" ? image.decode() : undefined,
      ),
    );
  });
  await secondContext.close();

  await page.getByRole("link", { name: "返回案件" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "建立新修訂版" }).click();
  await expect(page.getByText(/修訂 2/).first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByText("先填完任一可用軌的必要資料，即可開始計算。"),
  ).toBeVisible();
  await assertViewportSafe(page);

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
