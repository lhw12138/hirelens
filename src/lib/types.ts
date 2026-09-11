export type EvidenceStatus = "grounded" | "review" | "missing" | "conflict";
export type ReviewStatus = "pending" | "confirmed";

export interface Competency {
  id: string;
  name: string;
  weight: number;
  description: string;
  mustHave: boolean;
}

export interface EvidenceCitation {
  id: string;
  competencyId: string;
  sourceType: "resume" | "interview";
  sourceLabel: string;
  locator: string;
  quote: string;
  relevance: number;
  status: EvidenceStatus;
}

export interface CompetencyScore {
  competencyId: string;
  aiScore: number;
  hrAdjustment: number;
  evidenceCount: number;
  status: EvidenceStatus;
  claim: string;
}

export interface Candidate {
  id: string;
  name: string;
  years: number;
  currentCompany: string;
  currentTitle: string;
  education: string;
  overallScore: number;
  status: ReviewStatus;
  scores: CompetencyScore[];
  citations: EvidenceCitation[];
}

export interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  skillPackId: string;
  status: "draft" | "active" | "closed";
  candidateCount: number;
  competencies: Competency[];
  createdAt: string;
}

export interface SkillPack {
  id: string;
  name: string;
  version: string;
  description: string;
  competencyDictionary: string[];
  interviewPolicy: {
    maxFollowUps: number;
    targetMinutes: number;
    requiredEvidencePerCompetency: number;
  };
  toolAllowlist: string[];
  rubricVersion: string;
}

export interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  object: string;
  detail: string;
  occurredAt: string;
  level: "info" | "review" | "success";
}

export interface EvalMetric {
  id: string;
  label: string;
  value: string;
  target: string;
  state: "met" | "review" | "baseline";
  note: string;
}
