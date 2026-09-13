import { describe, expect, it } from 'vitest';
import { prepareMatchInput, resumeSources, validateMatchReport } from './candidate-match';

describe('candidate match boundary', () => {
  it('redacts contact data before matching', () => {
    const input = prepareMatchInput({ requestId: crypto.randomUUID(), title: 'AI 产品经理', jd: '负责 AI 产品设计与上线验证。'.repeat(5), resume: '邮箱 a@example.com，电话 13800138000。负责产品上线和验收。'.repeat(5), consent: true });
    expect(input.resume).not.toContain('a@example.com');
    expect(input.resume).not.toContain('13800138000');
  });
  it('does not aggregate when a weighted criterion lacks evidence', () => {
    const sources = resumeSources('负责产品上线并记录验收结果。'.repeat(8));
    const report = validateMatchReport({
      criteria: [{ id: 'product', name: '产品交付', description: '核对产品交付证据。', weight: 60 }, { id: 'ai', name: 'AI 评测', description: '核对模型评测证据。', weight: 20 }, { id: 'data', name: '数据分析', description: '核对数据分析证据。', weight: 20 }],
      assessment: { summary: '这是当前材料匹配情况，不代表录用概率。', scores: [{ criterionId: 'product', score: 80, claim: '有上线证据。', sourceIds: [sources[0].id], status: 'supported' }, { criterionId: 'ai', score: null, claim: '缺少证据。', sourceIds: [], status: 'insufficient' }, { criterionId: 'data', score: 30, claim: '只有相邻经历。', sourceIds: [sources[0].id], status: 'partial_match' }], conflicts: [] },
      improvements: [{ criterionId: 'ai', suggestion: '补充真实的模型评测过程、本人行动与验证结果。' }],
    }, sources, 'test-model');
    expect(report.overall).toBeNull();
    expect(report.coverage).toBe(80);
  });
});
