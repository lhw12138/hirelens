import type { Criterion } from './workflow';

export const MIN_CRITERIA = 3;
export const MAX_CRITERIA = 8;

export function createManualCriteria(): Criterion[] {
  return [
    { id: 'custom-1', name: '自定义维度 1', description: '写明要从简历核实的行动、产出或结果证据。', weight: 34 },
    { id: 'custom-2', name: '自定义维度 2', description: '写明相关经验与可迁移经验的判断边界。', weight: 33 },
    { id: 'custom-3', name: '自定义维度 3', description: '写明该维度的关键要求和不满足时的判断方式。', weight: 33 },
  ];
}

export function addCriterion(criteria: Criterion[], id: string): Criterion[] {
  if (criteria.length >= MAX_CRITERIA) return criteria;
  const next = [
    ...criteria,
    { id, name: '新评估维度', description: '写明要从材料中核实的具体行动、产出或结果。', weight: 1 },
  ];
  const base = Math.floor(100 / next.length);
  const remainder = 100 - base * next.length;
  return next.map((item, index) => ({ ...item, weight: base + (index < remainder ? 1 : 0) }));
}

export function copyCriteria(criteria: Criterion[]): Criterion[] {
  return criteria.map(item => ({ ...item }));
}
