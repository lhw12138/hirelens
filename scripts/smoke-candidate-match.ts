import assert from 'node:assert/strict';
import { generateCandidateMatch } from '@/server/candidate/service';
import { sampleJd, sampleResume } from '@/lib/workflow';

const report = await generateCandidateMatch(sampleJd, sampleResume);

assert.ok(report.criteria.length >= 3 && report.criteria.length <= 8, '岗位维度数量不正确');
assert.equal(report.criteria.reduce((sum, item) => sum + item.weight, 0), 100, '岗位维度权重不是 100');
assert.equal(report.assessment.scores.length, report.criteria.length, '评分维度不完整');
assert.ok(report.assessment.summary.length >= 10, '候选人摘要缺失');
assert.ok(report.improvements.length === report.criteria.length, '改进建议不完整');
const sourceIds = new Set(report.sources.map(source => source.id));
assert.ok(report.assessment.scores.every(score => score.sourceIds.every(id => sourceIds.has(id))), '评分引用了未知证据');

console.log(JSON.stringify({
  status: 'passed',
  model: report.model,
  criteria: report.criteria.length,
  coverage: report.coverage,
  overall: report.overall,
  sources: report.sources.length,
}));
