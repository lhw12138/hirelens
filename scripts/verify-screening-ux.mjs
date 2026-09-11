import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/lhw/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser = await chromium.launch({ channel: 'msedge', headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const base = 'http://localhost:3000';
  const login = await context.request.post(base + '/api/auth/login', {
    data: {
      email: process.env.HR_ADMIN_EMAIL || 'admin@hirelens.local',
      password: process.env.HR_ADMIN_PASSWORD || 'hirelens-demo',
    },
  });
  assert.equal(login.status(), 200);

  const id = '41111111-1111-4111-8111-111111111111';
  const now = new Date().toISOString();
  const candidate = (candidateId, name) => ({
    id: candidateId,
    name,
    synthetic: true,
    filename: name + '.pdf',
    resume: '合成简历正文，用于界面验收，不包含任何真实候选人资料。',
    resumeConfirmed: true,
    sources: [],
    questions: [],
    answers: {},
    interviewComplete: false,
    shortlisted: false,
  });
  let scoringJob;
  const record = () => ({
    id,
    version: 1,
    updatedAt: now,
    data: {
      id,
      title: '财务 AI 产品经理 · 合成界面验收',
      jd: '这是一段仅用于界面验收的合成岗位描述，不代表任何真实企业招聘需求。',
      synthetic: true,
      confirmed: true,
      criteria: [
        { id: 'a', name: '业务理解', description: '合成标准', weight: 34 },
        { id: 'b', name: '产品设计', description: '合成标准', weight: 33 },
        { id: 'c', name: 'AI 方案', description: '合成标准', weight: 33 },
      ],
      candidates: [
        candidate('42222222-2222-4222-8222-222222222221', '张三（合成）'),
        candidate('42222222-2222-4222-8222-222222222222', '李四（合成）'),
      ],
      scoringJob,
      audit: [],
    },
  });

  await context.route(`**/api/tasks/${id}`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(record()) }),
  );

  const page = await context.newPage();
  await page.goto(base + '/tasks/' + id);
  await page.getByRole('heading', { name: '先筛简历，再选择面试人选' }).waitFor();
  await page.getByText('一份文件代表一位候选人。').waitFor();
  assert.equal(await page.getByRole('button', { name: /移除.*合成/ }).count(), 2);
  await page.screenshot({ path: '.impeccable/review/screening-import-desktop.png', fullPage: true });

  scoringJob = {
    id: '43333333-3333-4333-8333-333333333333',
    candidateId: '42222222-2222-4222-8222-222222222221',
    action: 'screen',
    status: 'running',
    queuedAt: now,
    startedAt: now,
  };
  await page.reload();
  await page.getByText('正在检索简历证据并生成评分').waitFor();
  await page.getByText(/通常需要30–90秒.*可以离开本页面/).waitFor();
  await page.screenshot({ path: '.impeccable/review/screening-progress-desktop.png', fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByText('正在检索简历证据并生成评分').waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: '.impeccable/review/screening-progress-mobile.png', fullPage: true });

  console.log('PASS batch import meaning, independent removal, and scoring progress desktop/mobile UI');
} finally {
  await browser.close();
}
