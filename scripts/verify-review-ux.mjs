import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/lhw/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser = await chromium.launch({ channel: 'msedge', headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const base = 'http://localhost:3000';
  const login = await context.request.post(base + '/api/auth/login', {
    data: { email: process.env.HR_ADMIN_EMAIL || 'admin@hirelens.local', password: process.env.HR_ADMIN_PASSWORD || 'hirelens-demo' },
  });
  assert.equal(login.status(), 200);

  const id = '51111111-1111-4111-8111-111111111111';
  const candidateId = '52222222-2222-4222-8222-222222222222';
  const resumeId = candidateId + '-r0';
  const interviewId = candidateId + '-interview-0';
  const now = new Date().toISOString();
  const criteria = [
    { id: 'experience', name: '相关工作经验', description: '合成标准', weight: 50 },
    { id: 'skills', name: '专业能力', description: '合成标准', weight: 50 },
  ];
  const task = {
    id,
    version: 1,
    updatedAt: now,
    data: {
      id,
      title: '合成审核界面验收',
      jd: '仅用于界面验收的合成岗位说明，不包含任何真实招聘信息或真实候选人资料。',
      synthetic: true,
      confirmed: true,
      criteria,
      candidates: [{
        id: candidateId,
        name: '候选人 A（合成）',
        synthetic: true,
        filename: 'synthetic.txt',
        resume: '合成简历',
        resumeConfirmed: true,
        shortlisted: true,
        interviewComplete: true,
        interviewRecord: '合成面试记录',
        questions: [],
        answers: {},
        sources: [
          { id: resumeId, kind: 'resume', locator: '合成简历段落', text: '合成简历原文。' },
          { id: interviewId, kind: 'answer', locator: '合成面试记录', text: '合成面试原文。' },
        ],
        assessment: {
          model: 'test', latencyMs: 1, inputTokens: 1, outputTokens: 1, createdAt: now,
          summary: '这是只用于界面验收的合成评估。',
          conflicts: [{ topic: '项目经历不一致', description: '两份合成材料存在不一致。', sourceIds: [resumeId, interviewId] }],
          scores: [
            { criterionId: 'experience', score: null, claim: '需要人工核实。', sourceIds: [resumeId, interviewId], status: 'conflict' },
            { criterionId: 'skills', score: 60, claim: '存在部分证据。', sourceIds: [interviewId], status: 'supported' },
          ],
        },
      }],
      audit: [],
    },
  };

  await context.route(`**/api/tasks/${id}`, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(task) }));
  const page = await context.newPage();
  await page.goto(base + '/tasks/' + id);
  await page.getByRole('heading', { name: '核对原文，形成你的判断' }).waitFor();

  const submit = page.getByRole('button', { name: '确认并保存评估' });
  await page.getByText('AI 综合分').waitFor();
  await page.getByText('待核实', { exact: true }).waitFor();
  await page.getByText('1/2 项已有分数；未评分项不会按 0 分计算。').waitFor();
  assert.equal(await submit.isDisabled(), true);
  assert.equal(await page.locator('.hl-review-checks li').count(), 3);
  await page.locator('#conflict-note').fill('尚未核实，需要再次询问');
  await page.locator('#review-reason').fill('暂缓判断');
  await page.getByText('我已核对评分与引用，确认以上处理意见。').click();
  assert.equal(await submit.isEnabled(), true);

  await page.getByLabel('相关工作经验人工评分').fill('50');
  await page.getByText('人工评分草稿', { exact: true }).waitFor();
  await page.locator('.hl-score-overview strong').filter({ hasText: '55.0' }).waitFor();
  assert.equal(await submit.isDisabled(), true);
  await page.locator('#review-reason').fill('补充分数依据已核实');
  assert.equal(await submit.isEnabled(), true);

  await page.screenshot({ path: '.impeccable/review/review-submit-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: '.impeccable/review/review-submit-mobile.png', fullPage: true });
  console.log('PASS review requirements explain disabled state and enable submission when complete');
} finally {
  await browser.close();
}
