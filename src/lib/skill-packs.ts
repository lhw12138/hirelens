import type { SkillPack } from "./types";

export const skillPacks: SkillPack[] = [
  {
    id: "pm-general",
    name: "通用产品经理",
    version: "1.0.0",
    description: "覆盖需求洞察、方案设计、数据决策、项目推进和沟通协作。",
    competencyDictionary: ["用户研究", "需求优先级", "产品方案", "数据分析", "跨团队协作"],
    interviewPolicy: { maxFollowUps: 2, targetMinutes: 35, requiredEvidencePerCompetency: 2 },
    toolAllowlist: ["get_job_rubric", "retrieve_resume_evidence", "retrieve_interview_evidence", "calculate_rule_score"],
    rubricVersion: "pm-rubric-v1",
  },
  {
    id: "ai-pm",
    name: "AI 产品经理",
    version: "1.1.0",
    description: "在产品基本功上增加模型选型、RAG、Agent、评测和成本质量权衡。",
    competencyDictionary: ["AI场景判断", "模型选型", "RAG设计", "Agent工作流", "评测体系", "工程协同"],
    interviewPolicy: { maxFollowUps: 2, targetMinutes: 40, requiredEvidencePerCompetency: 2 },
    toolAllowlist: ["get_job_rubric", "retrieve_resume_evidence", "retrieve_interview_evidence", "detect_conflicts", "calculate_rule_score"],
    rubricVersion: "ai-pm-rubric-v2",
  },
  {
    id: "finance-ai-pm",
    name: "财务 AI 产品经理",
    version: "1.4.0",
    description: "面向核算、资金、经营分析等场景，强调价值识别、AI落地与跨部门交付。",
    competencyDictionary: ["财务流程理解", "AI产品能力", "数据分析", "交付协同", "商业洞察", "合规意识"],
    interviewPolicy: { maxFollowUps: 2, targetMinutes: 45, requiredEvidencePerCompetency: 2 },
    toolAllowlist: ["get_job_rubric", "retrieve_resume_evidence", "retrieve_interview_evidence", "detect_conflicts", "calculate_rule_score", "draft_assessment"],
    rubricVersion: "finance-ai-pm-rubric-v1",
  },
];

export function getSkillPack(id: string): SkillPack {
  return skillPacks.find((pack) => pack.id === id) ?? skillPacks[1];
}
