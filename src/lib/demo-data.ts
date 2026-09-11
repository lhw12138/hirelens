import type { AuditEvent, Candidate, EvalMetric, Job } from "./types";

export const financeCompetencies = [
  { id: "finance", name: "财务专业能力", weight: 20, description: "理解核算、资金、经营分析与财务数据治理。", mustHave: true },
  { id: "product", name: "产品规划能力", weight: 20, description: "将业务问题转化为可交付的产品方案。", mustHave: true },
  { id: "ai", name: "AI / 数据素养", weight: 20, description: "理解模型、RAG、Agent、评测及数据分析工具。", mustHave: true },
  { id: "delivery", name: "项目管理能力", weight: 15, description: "推动跨部门项目按时保质落地。", mustHave: true },
  { id: "business", name: "商业洞察与影响力", weight: 15, description: "识别高价值场景并推动业务采纳。", mustHave: false },
  { id: "communication", name: "沟通表达与协作", weight: 10, description: "清晰表达并协调财务、技术与管理者。", mustHave: false },
] as const;

export const activeJob: Job = {
  id: "job-fin-ai-pm",
  title: "财务 AI 产品经理",
  department: "财务数字化",
  location: "上海 · 混合办公",
  skillPackId: "finance-ai-pm",
  status: "active",
  candidateCount: 8,
  competencies: [...financeCompetencies],
  createdAt: "2026-08-28",
};

const baseCitations = (candidateId: string, name: string) => [
  {
    id: `${candidateId}-finance-resume`, competencyId: "finance", sourceType: "resume" as const,
    sourceLabel: `${name}-简历.pdf`, locator: "第 2 页 / 工作经历 / 第 3 段",
    quote: "主导财务共享平台 2.0 产品建设，协同财务、IT、风控与法务团队完成需求评审、方案对齐和上线落地。",
    relevance: 0.94, status: "grounded" as const,
  },
  {
    id: `${candidateId}-ai-interview`, competencyId: "ai", sourceType: "interview" as const,
    sourceLabel: "终面访谈记录", locator: "问题 4 / 18:21–18:42",
    quote: "我会先建立无 RAG 的基线，再比较关键词、向量和混合检索；上线门槛看引用准确率与无依据结论率。",
    relevance: 0.91, status: "grounded" as const,
  },
  {
    id: `${candidateId}-delivery-conflict`, competencyId: "delivery", sourceType: "interview" as const,
    sourceLabel: "终面访谈记录", locator: "问题 6 / 24:10–24:34",
    quote: "这个项目的集中交付期是 2022 年 7 月到 2023 年 3 月，我负责跨部门节奏和风险升级。",
    relevance: 0.88, status: "conflict" as const,
  },
];

function candidate(id: string, name: string, score: number, years: number, company: string, title: string, values: number[]): Candidate {
  const statuses = ["grounded", "grounded", "review", "conflict", "grounded", "grounded"] as const;
  return {
    id, name, years, currentCompany: company, currentTitle: title, education: years >= 6 ? "硕士" : "本科",
    overallScore: score, status: id === "c-005" ? "confirmed" : "pending",
    scores: financeCompetencies.map((competency, index) => ({
      competencyId: competency.id,
      aiScore: values[index],
      hrAdjustment: id === "c-002" && index === 0 ? 2 : id === "c-002" && index === 2 ? -2 : 0,
      evidenceCount: Math.max(1, 6 - index),
      status: id === "c-002" ? statuses[index] : index === 2 ? "review" : "grounded",
      claim: [
        "具备财务系统与指标治理经验，能够把流程问题转化为产品需求。",
        "完成过从需求研究、方案设计到上线复盘的完整产品闭环。",
        "能够解释 RAG、模型选型与评测指标之间的权衡。",
        "有跨财务、IT 与业务团队推进项目的可核验证据。",
        "能够从业务目标识别高价值 AI 应用场景。",
        "表达结构清晰，能主动暴露假设和风险。",
      ][index],
    })),
    citations: baseCitations(id, name),
  };
}

export const candidates: Candidate[] = [
  candidate("c-001", "刘思远", 84.6, 8, "某金融科技公司", "高级产品经理", [88, 86, 84, 82, 86, 80]),
  candidate("c-002", "陈子墨", 82.4, 6, "某大型制造集团", "财务产品经理", [86, 82, 85, 78, 79, 81]),
  candidate("c-003", "周皓然", 79.8, 5, "某咨询公司", "数字化咨询顾问", [81, 78, 83, 80, 79, 76]),
  candidate("c-004", "吴若曦", 76.3, 4, "某互联网公司", "产品经理", [70, 82, 80, 76, 78, 74]),
  candidate("c-005", "沈清妍", 74.9, 5, "某企业服务公司", "解决方案经理", [75, 72, 78, 77, 76, 70]),
  candidate("c-006", "陆承宇", 72.9, 3, "某软件公司", "AI 产品经理", [66, 75, 82, 70, 71, 73]),
  candidate("c-007", "何明轩", 71.2, 4, "某零售集团", "经营分析师", [82, 68, 69, 70, 72, 69]),
  candidate("c-008", "许知微", 69.8, 3, "某 SaaS 公司", "产品专员", [65, 73, 72, 68, 70, 71]),
];

export const auditEvents: AuditEvent[] = [
  { id: "a1", actor: "系统", action: "完成简历索引", object: "陈子墨-简历.pdf", detail: "生成 18 个脱敏片段，未发现未处理的联系方式。", occurredAt: "今天 10:12", level: "success" },
  { id: "a2", actor: "AI 评估 Agent", action: "标记证据冲突", object: "陈子墨 / 项目管理能力", detail: "简历与面试回答的项目时间不一致，已阻止自动确认。", occurredAt: "今天 10:06", level: "review" },
  { id: "a3", actor: "HR_张敏", action: "修订评分", object: "陈子墨 / 财务专业能力", detail: "AI 原分 86，人工调整 +2；补充跨部门协作证据。", occurredAt: "今天 09:58", level: "info" },
  { id: "a4", actor: "候选人", action: "完成异步面试", object: "陈子墨", detail: "完成 6 个主问题与 2 次追问，语音转写已确认。", occurredAt: "昨天 18:42", level: "success" },
];

export const evalMetrics: EvalMetric[] = [
  { id: "citation", label: "引用准确率", value: "92.0%", target: "目标 ≥ 90%", state: "met", note: "人工复核 25 / 100 个合成案例" },
  { id: "unsupported", label: "无依据结论率", value: "4.0%", target: "目标 ≤ 5%", state: "met", note: "4 条结论未充分绑定证据" },
  { id: "coverage", label: "证据覆盖率", value: "86.5%", target: "观察基线", state: "baseline", note: "必须项能力平均覆盖 2.3 条证据" },
  { id: "correction", label: "HR 修改率", value: "18.0%", target: "观察基线", state: "baseline", note: "仅统计已完成人工复核的样本" },
  { id: "latency", label: "P95 评估耗时", value: "12.8s", target: "目标 ≤ 15s", state: "met", note: "本地合成集，非线上 SLA" },
  { id: "cost", label: "单次评估成本", value: "¥0.15", target: "观察基线", state: "baseline", note: "按当前模型价目估算" },
];
