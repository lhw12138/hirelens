export interface RetrievalCandidate {
  id: string;
  keywordScore: number;
  vectorScore: number;
  rerankScore?: number;
}

export function reciprocalRankFusion(
  keywordResults: RetrievalCandidate[],
  vectorResults: RetrievalCandidate[],
  k = 60,
): Array<RetrievalCandidate & { fusedScore: number }> {
  const merged = new Map<string, RetrievalCandidate & { fusedScore: number }>();
  const add = (items: RetrievalCandidate[]) => {
    items.forEach((item, index) => {
      const current = merged.get(item.id) ?? { ...item, fusedScore: 0 };
      current.keywordScore = Math.max(current.keywordScore ?? 0, item.keywordScore ?? 0);
      current.vectorScore = Math.max(current.vectorScore ?? 0, item.vectorScore ?? 0);
      current.fusedScore += 1 / (k + index + 1);
      merged.set(item.id, current);
    });
  };
  add(keywordResults);
  add(vectorResults);
  return [...merged.values()].sort((a, b) => (b.rerankScore ?? b.fusedScore) - (a.rerankScore ?? a.fusedScore));
}

export function evidenceCoverage(requiredCompetencies: string[], evidenceCompetencyIds: string[]): number {
  if (requiredCompetencies.length === 0) return 1;
  const covered = new Set(evidenceCompetencyIds);
  return requiredCompetencies.filter((id) => covered.has(id)).length / requiredCompetencies.length;
}
