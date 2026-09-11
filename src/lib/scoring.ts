import type { Competency, CompetencyScore } from "./types";

export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

export function finalCompetencyScore(score: CompetencyScore): number {
  return clampScore(score.aiScore + score.hrAdjustment);
}

export function calculateWeightedScore(
  competencies: readonly Competency[],
  scores: CompetencyScore[],
): number {
  const byId = new Map(scores.map((score) => [score.competencyId, score]));
  const totalWeight = competencies.reduce((sum, competency) => sum + competency.weight, 0);
  if (totalWeight === 0) return 0;

  const total = competencies.reduce((sum, competency) => {
    const score = byId.get(competency.id);
    return sum + (score ? finalCompetencyScore(score) : 0) * competency.weight;
  }, 0);
  return Math.round((total / totalWeight) * 10) / 10;
}

export function canConfirmAssessment(scores: CompetencyScore[]): boolean {
  return scores.every((score) => score.status !== "conflict");
}
