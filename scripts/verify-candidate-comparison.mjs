import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require("C:/Users/lhw/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const base = process.env.HIRELENS_TEST_URL || "http://localhost:3000";
const taskId = process.env.HIRELENS_COMPARE_TASK || "e6ad24a4-f327-4dc6-9e12-3ef0eca67374";
const browser = await chromium.launch({ headless: true, executablePath: process.env.HIRELENS_BROWSER_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const login = await context.request.post(`${base}/api/auth/login`, { data: { email: process.env.HR_ADMIN_EMAIL || "admin@hirelens.local", password: process.env.HR_ADMIN_PASSWORD || "hirelens-demo" } });
  assert.equal(login.status(), 200);
  const page = await context.newPage();
  await page.goto(`${base}/tasks/${taskId}/compare`);
  await page.locator("h1").waitFor();
  assert.equal(await page.getByText("分数辅助阅读，不代替招聘判断。").count(), 1);
  await page.screenshot({ path: ".impeccable/review/candidate-compare-desktop.png", fullPage: true });
  await page.getByRole("tab", { name: "综合评估" }).click();
  await page.getByText("证据不足", { exact: true }).first().waitFor();
  await page.screenshot({ path: ".impeccable/review/candidate-compare-combined-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.locator("h1").waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: ".impeccable/review/candidate-compare-mobile.png", fullPage: true });
  console.log(JSON.stringify({ status: "PASS", screenshots: [".impeccable/review/candidate-compare-desktop.png", ".impeccable/review/candidate-compare-combined-desktop.png", ".impeccable/review/candidate-compare-mobile.png"] }, null, 2));
} finally { await browser.close(); }
