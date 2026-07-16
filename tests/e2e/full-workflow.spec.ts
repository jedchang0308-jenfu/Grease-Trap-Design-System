import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

async function visibleErrorSweep(page: Page) {
  await expect(
    page.locator(".runtime-error:visible, .inline-error:visible"),
  ).toHaveCount(0);
  const visibleAlerts = await page
    .locator("[role=alert]:visible")
    .allInnerTexts();
  expect(
    visibleAlerts.filter((text) =>
      /錯誤|失敗|未完成|無法|請修正|HTTP\s+[45]\d\d|Not Found|Internal Server Error|\/api\//i.test(
        text,
      ),
    ),
  ).toEqual([]);
  const visibleText = await page.locator("body").innerText();
  expect(visibleText).not.toMatch(
    /HTTP\s+[45]\d\d|Internal Server Error|\/api\/\S+\s+(?:error|failed)/i,
  );
  const overflow = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(overflow.width).toBeLessThanOrEqual(overflow.viewport + 1);
}

async function evidence(page: Page, project: string, name: string) {
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);
  const directory = path.resolve("output", "playwright", "evidence", project);
  await mkdir(directory, { recursive: true });
  await page.screenshot({
    path: path.join(directory, `${name}.png`),
    fullPage: true,
  });
}

async function createDualTrackCase(page: Page, task: string) {
  await page.goto("/cases/new");
  await page.getByText(task, { exact: true }).click();
  await page.getByRole("button", { name: "下一步：選擇模式" }).click();
  await page.getByText("不同計算依據對照", { exact: true }).click();
  await page.getByRole("button", { name: "下一步：填寫資料" }).click();
  await page.getByRole("button", { name: "建立案件並填寫計算資料" }).click();
  await expect(page.getByRole("heading", { name: "計算資料" })).toBeVisible({
    timeout: 30_000,
  });
}

test("single actor completes a dual-track case through report issue", async ({
  page,
}, testInfo) => {
  const project = testInfo.project.name;
  const apiFailures: string[] = [];
  const consoleErrors: string[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/api/") && response.status() >= 400)
      apiFailures.push(`${response.status()} ${response.url()}`);
  });
  page.on("console", (message) => {
    const text = message.text();
    const expectedSandboxBlock = text.includes(
      "Blocked script execution in 'about:srcdoc'",
    );
    if (message.type() === "error" && !expectedSandboxBlock)
      consoleErrors.push(text);
  });

  await page.goto("/cases");
  await expect(page.getByRole("heading", { name: "案件清單" })).toBeVisible();
  await visibleErrorSweep(page);
  await evidence(page, project, "01-cases-list");

  await page.getByRole("link", { name: "建立案件" }).first().click();
  await expect(page.getByRole("heading", { name: "建立案件" })).toBeVisible();
  await visibleErrorSweep(page);
  await evidence(page, project, "02-new-case-task");

  await page.getByRole("button", { name: "下一步：選擇模式" }).click();
  await page.getByText("不同計算依據對照", { exact: true }).click();
  await page.getByRole("button", { name: "下一步：填寫資料" }).click();
  await expect(page.getByLabel("客戶名稱（選填）")).toBeVisible();
  await expect(page.getByLabel("餐飲類型")).toHaveCount(0);
  const title = `E2E 雙軌案件 ${project} ${Date.now()}`;
  await page.getByLabel("客戶名稱").fill("去識別 E2E 客戶");
  await page.getByLabel("案件地點").fill("臺灣測試地點");
  await page.getByLabel("案件名稱").fill(title);
  await page.getByLabel("用途／情境").fill("驗證雙軌計算、單人覆核與核發流程");
  await page.getByLabel("資料提供者或證據").fill("E2E fixture");
  await evidence(page, project, "03-new-case-data");
  await page.getByRole("button", { name: "建立案件並填寫計算資料" }).click();

  await expect(page.getByRole("heading", { name: title })).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByText("先填完任一可用軌的必要資料，即可開始計算。"),
  ).toBeVisible();
  await expect(page.getByLabel("餐飲類型", { exact: true })).toBeVisible();
  await expect(page.locator(".field-help-trigger:visible")).toHaveCount(12);
  const calculationPanel = page.locator("section.panel").filter({
    has: page.getByRole("heading", { name: "計算資料" }),
  });
  await expect(
    calculationPanel.getByRole("button", { name: "開始計算" }),
  ).toBeVisible();
  await expect(
    calculationPanel.getByRole("button", { name: "開始計算" }),
  ).toHaveClass("button primary");
  const diningTypeHelp = page.getByRole("button", {
    name: "餐飲類型說明",
  });
  await diningTypeHelp.click();
  const helpDialog = page.getByRole("dialog", { name: "餐飲類型說明" });
  await expect(helpDialog).toBeVisible();
  await expect(helpDialog).toContainText(
    "系統會依內政部給排水規範（附錄 5）選取用水、使用時間與油脂參數。",
  );
  await evidence(page, project, "04-field-help");
  await page.keyboard.press("Escape");
  await expect(helpDialog).not.toBeVisible();
  await expect(diningTypeHelp).toBeFocused();
  await page.getByLabel("餐飲類型", { exact: true }).selectOption("CHINESE");
  await visibleErrorSweep(page);
  await evidence(page, project, "04-workbench-inputs");

  await page.getByRole("button", { name: "開始計算" }).click();
  await expect(
    page.getByText("計算已完成；下一步先完成報告草稿。"),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("38.9", { exact: true })).toBeVisible();
  await expect(page.getByText("150", { exact: true })).toBeVisible();
  await expect(
    calculationPanel.getByRole("button", { name: "重新計算" }),
  ).toBeVisible();
  await expect(
    calculationPanel.getByRole("button", { name: "重新計算" }),
  ).toHaveClass("button primary");
  const resultPanel = page.locator("section.panel").filter({
    has: page.getByRole("heading", { name: "本次設計結果" }),
  });
  await expect(
    resultPanel.getByRole("button", { name: "重新計算" }),
  ).toHaveCount(0);
  await expect(
    resultPanel.getByRole("link", { name: "完成報告草稿" }),
  ).toHaveClass("button primary");
  await visibleErrorSweep(page);
  await evidence(page, project, "05-calculation-complete");

  await page.getByRole("link", { name: "完成報告草稿" }).click();
  await expect(page.getByRole("heading", { name: "報告預覽" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByRole("button", { name: "送出最終審核" }),
  ).toBeVisible();
  await expect(page.getByTitle("客戶設計計算報告預覽")).toBeVisible();
  await expect(
    page
      .frameLocator('iframe[title="客戶設計計算報告預覽"]')
      .getByText("油脂截留器設計計算報告", { exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  await visibleErrorSweep(page);
  await evidence(page, project, "06-report-draft");

  await page.getByRole("button", { name: "送出最終審核" }).click();
  await expect(page.getByRole("heading", { name: "工程覆核" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByText("送審報告已完成；請針對這份完整報告進行最後一次工程審核。"),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "查看送審報告" })).toBeVisible();
  await visibleErrorSweep(page);
  await evidence(page, project, "07-final-review");

  for (const label of [
    "已確認計算方法與案件任務一致。",
    "已確認所有輸入與結果單位。",
    "已確認規則版本、來源與參數選擇。",
    "已確認報告限制與未執行產品／證書符合性判定。",
    "已確認未完成軌標示；若為單軌完成，仍可放行。",
  ])
    await page.getByLabel(label).check();
  await page.getByLabel("覆核或退回說明").fill("E2E 覆核完成");
  await page.getByRole("button", { name: "完成覆核" }).click();

  await expect(page.getByRole("heading", { name: "報告預覽" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByTitle("客戶設計計算報告預覽")).toBeVisible();
  await expect(
    page
      .frameLocator('iframe[title="客戶設計計算報告預覽"]')
      .getByText("油脂截留器設計計算報告", { exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  await visibleErrorSweep(page);
  await evidence(page, project, "08-report-preview");
  await page.getByRole("button", { name: "核發此版本" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByText("核發後此版本內容固定。若內容變更，需建立新修訂版。"),
  ).toBeVisible();
  await evidence(page, project, "09-issue-confirmation");
  await page.getByRole("button", { name: "確認核發" }).click();
  await expect(
    page.getByText("報告已核發；如需變更內容，請建立新修訂版。"),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByRole("link", { name: "下載已核發報告" }).first(),
  ).toBeVisible();
  await expect(
    page
      .frameLocator('iframe[title="客戶設計計算報告預覽"]')
      .getByText("油脂截留器設計計算報告", { exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  await visibleErrorSweep(page);
  await evidence(page, project, "10-issued");

  await page.getByRole("link", { name: "規則" }).click();
  await expect(
    page.getByRole("heading", { name: "規則版本與來源" }),
  ).toBeVisible();
  await expect(page.getByText("RULE-CURRENT-QG")).toBeVisible();
  await expect(page.getByText("RULE-LEGACY-QV")).toBeVisible();
  await visibleErrorSweep(page);
  await evidence(page, project, "10-rules");

  expect(apiFailures).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test("area and reverse field groups expose help for every input", async ({
  page,
}, testInfo) => {
  await createDualTrackCase(page, "我知道廚房與用餐區面積，要換算流量。");
  await expect(page.locator(".field-help-trigger:visible")).toHaveCount(15);
  await expect(
    page.getByRole("button", { name: "廚房面積說明" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "人員密度說明" }),
  ).toBeVisible();
  await visibleErrorSweep(page);
  await evidence(page, testInfo.project.name, "11-area-field-help-matrix");

  await createDualTrackCase(
    page,
    "我知道設備能力／有效容積，要反推等效人數及面積。",
  );
  await expect(page.locator(".field-help-trigger:visible")).toHaveCount(16);
  await expect(
    page.getByRole("button", { name: "Q 設計能力說明" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "能力資料來源／證據說明" }),
  ).toBeVisible();
  const volumeHelp = page.getByRole("button", {
    name: "有效容積說明",
  });
  await volumeHelp.click();
  const dialog = page.getByRole("dialog", { name: "有效容積說明" });
  await expect(dialog).toContainText("請勿填外殼的名目容積。");
  await evidence(page, testInfo.project.name, "12-reverse-field-help-matrix");
  await dialog.getByRole("button", { name: "關閉說明" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(volumeHelp).toBeFocused();
  await visibleErrorSweep(page);
});

test("unauthenticated API access returns safe problem details", async ({
  request,
}) => {
  const response = await request.get("/api/cases", {
    headers: { "x-gtc-disable-seed-auth": "1" },
  });
  expect(response.status()).toBe(401);
  expect(response.headers()["content-type"]).toContain(
    "application/problem+json",
  );
  const body = await response.json();
  expect(body).toMatchObject({
    code: "AUTH_REQUIRED",
    status: 401,
    retryable: false,
  });
  expect(JSON.stringify(body)).not.toContain("calculation_cases");
});

test("unauthenticated UI shows a recoverable safe state", async ({
  page,
}, testInfo) => {
  await page.setExtraHTTPHeaders({ "x-gtc-disable-seed-auth": "1" });
  await page.goto("/cases");
  await expect(page.getByRole("heading", { name: "案件清單" })).toBeVisible();
  await expect(page.locator(".runtime-error")).toContainText(
    "請先登入內部帳號，再繼續處理案件。",
  );
  await page.getByText("技術資訊").click();
  await expect(page.getByText(/AUTH_REQUIRED/)).toBeVisible();
  await expect(page.getByRole("link", { name: "返回案件清單" })).toBeVisible();
  const overflow = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(overflow.width).toBeLessThanOrEqual(overflow.viewport + 1);
  await evidence(page, testInfo.project.name, "11-auth-required");
});
