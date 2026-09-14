import { describe, expect, it } from 'vitest';
import { addCriterion, copyCriteria, createManualCriteria, MAX_CRITERIA } from './criteria-editor';
import { sampleCriteria, type Criterion } from './workflow';

describe('criteria editor transitions', () => {
  it('creates a valid three-item manual framework whose weights total 100', () => {
    const criteria = createManualCriteria();
    expect(criteria).toHaveLength(3);
    expect(criteria.reduce((total, item) => total + item.weight, 0)).toBe(100);
  });

  it('adds a dimension and redistributes integer weights to exactly 100', () => {
    const criteria = addCriterion(sampleCriteria, 'custom-new');
    expect(criteria).toHaveLength(sampleCriteria.length + 1);
    expect(criteria.reduce((total, item) => total + item.weight, 0)).toBe(100);
    expect(criteria.at(-1)?.id).toBe('custom-new');
  });

  it('does not add beyond the visible eight-item limit', () => {
    const criteria: Criterion[] = Array.from({ length: MAX_CRITERIA }, (_, index) => ({
      id: `criterion-${index}`,
      name: `维度 ${index + 1}`,
      description: '用于测试维度数量上限。',
      weight: index < 4 ? 13 : 12,
    }));
    expect(addCriterion(criteria, 'too-many')).toBe(criteria);
  });

  it('keeps a detached copy that can restore the pre-reset AI draft', () => {
    const backup = copyCriteria(sampleCriteria);
    const manual = createManualCriteria();
    manual[0].name = '已经修改';
    expect(backup).toEqual(sampleCriteria);
    expect(backup).not.toBe(sampleCriteria);
    expect(backup[0]).not.toBe(sampleCriteria[0]);
  });
});
