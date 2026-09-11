import { z } from "zod";

export const competencyDraftSchema = z.object({
  name: z.string().min(2).max(30),
  description: z.string().min(8).max(240),
  weight: z.number().int().min(5).max(50),
  required: z.boolean(),
});

export const jobModelSchema = z.object({
  goal: z.string().min(10),
  responsibilities: z.array(z.string()).min(2).max(10),
  hardRequirements: z.array(z.string()).max(10),
  competencies: z.array(competencyDraftSchema).min(3).max(10),
});

export const assessmentDraftSchema = z.object({
  summary: z.string().min(20),
  recommendation: z.enum(["advance", "hold", "reject", "insufficient_evidence"]),
  scores: z.array(z.object({
    competencyId: z.string(),
    score: z.number().min(0).max(10),
    claim: z.string(),
    citationIds: z.array(z.string()),
    evidenceStatus: z.enum(["supported", "insufficient", "conflict"]),
  })),
  conflicts: z.array(z.object({ topic: z.string(), resumeClaim: z.string(), interviewClaim: z.string() })),
  questionsForHr: z.array(z.string()),
});

export const interviewTurnRequestSchema = z.object({
  sessionId: z.string().min(1),
  questionIndex: z.number().int().min(0).max(20),
  answer: z.string().min(2).max(6000),
  followUpRound: z.number().int().min(0).max(2),
});

export const humanReviewSchema = z.object({
  assessmentId: z.string().min(1),
  revisions: z.array(z.object({
    competencyKey: z.string(),
    previousScore: z.number().min(0).max(100),
    revisedScore: z.number().min(0).max(100),
    reason: z.string().min(4),
  })),
  conflictResolved: z.boolean(),
  finalDecision: z.enum(["advance", "hold", "reject"]),
});
