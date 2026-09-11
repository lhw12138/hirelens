import type { EvalCaseFixture, EvalStatus } from "./eval-fixtures";

export type BlindReviewAnswer = {
  status: EvalStatus;
  score: number | null;
  sourceIds: string[];
  reason: string;
  savedAt: string;
};

export type BlindReviewAiResult = {
  caseId: string;
  status: EvalStatus;
  score: number | null;
  sourceIds: string[];
  claim: string;
};

const ratio = (value: number, total: number) => total ? Math.round(value / total * 1000) / 10 : 0;
const sameSet = (left: string[], right: string[]) => left.length === right.length && left.every((id) => right.includes(id));

export function compareBlindReview(caseIds: string[], answers: Record<string, BlindReviewAnswer>, aiResults: BlindReviewAiResult[]) {
  const ai = new Map(aiResults.map((item) => [item.caseId, item]));
  const comparable = caseIds.flatMap((caseId) => {
    const answer = answers[caseId], prediction = ai.get(caseId);
    return answer && prediction ? [{ caseId, answer, prediction }] : [];
  });
  const scorePairs = comparable.filter(({ answer, prediction }) => typeof answer.score === "number" && typeof prediction.score === "number");
  const disagreements = comparable.filter(({ answer, prediction }) => answer.status !== prediction.status || (typeof answer.score === "number" && typeof prediction.score === "number" && Math.abs(answer.score - prediction.score) > 10) || !sameSet(answer.sourceIds, prediction.sourceIds)).map(({ caseId }) => caseId);
  return {
    comparedCases: comparable.length,
    statusAgreement: ratio(comparable.filter(({ answer, prediction }) => answer.status === prediction.status).length, comparable.length),
    citationAgreement: ratio(comparable.filter(({ answer, prediction }) => sameSet(answer.sourceIds, prediction.sourceIds)).length, comparable.length),
    averageScoreDifference: scorePairs.length ? Math.round(scorePairs.reduce((sum, { answer, prediction }) => sum + Math.abs((answer.score as number) - (prediction.score as number)), 0) / scorePairs.length * 10) / 10 : null,
    disagreementCaseIds: disagreements,
  };
}

export function chooseBlindReviewCases(fixtures: EvalCaseFixture[], size = 20, random = Math.random) {
  const groups = new Map<string, EvalCaseFixture[]>();
  for (const item of fixtures) { const list = groups.get(item.title) || []; list.push(item); groups.set(item.title, list); }
  const roleCounts = new Map<string, number>(), selected: EvalCaseFixture[] = [];
  const shuffled = <T,>(items:T[]) => [...items].sort(() => random() - .5);
  while (selected.length < Math.min(size, fixtures.length) && [...groups.values()].some((items) => items.length)) {
    for (const [, items] of shuffled([...groups.entries()])) {
      if (selected.length >= size || !items.length) continue;
      const candidates = shuffled(items).sort((left, right) => (roleCounts.get(left.role) || 0) - (roleCounts.get(right.role) || 0));
      const chosen = candidates[0]; items.splice(items.findIndex((item) => item.id === chosen.id), 1); selected.push(chosen); roleCounts.set(chosen.role, (roleCounts.get(chosen.role) || 0) + 1);
    }
  }
  return shuffled(selected).map((item) => item.id);
}
