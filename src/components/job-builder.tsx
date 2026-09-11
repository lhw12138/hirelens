"use client";
import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { financeCompetencies } from "@/lib/demo-data";

const sampleJd = `参与核算、资产、资金、进出口、经营分析等财务相关场景，识别高价值 AI 应用需求，评估技术可行性和实施路线；负责需求调研、流程梳理、功能定义和产品需求文档；协同技术研发、IT 运维与财务业务团队推动上线。`;
export function JobBuilder() {
  const [step, setStep] = useState<"input" | "review" | "done">("input");
  return <div><div className="page-heading"><div><h1>先定义“什么叫合适”</h1><p>AI 只负责起草，胜任力模型必须由 HR 确认。</p></div></div>
    <div className="builder-steps">{["输入 JD", "审核能力模型", "确认并开始招聘"].map((label, index) => <div className={(step === "input" ? 0 : step === "review" ? 1 : 2) >= index ? "active" : ""} key={label}><span>{index + 1}</span>{label}</div>)}</div>
    {step === "input" ? <section className="builder-card"><label><span>岗位名称</span><input defaultValue="财务 AI 产品经理" /></label><label><span>岗位描述</span><textarea defaultValue={sampleJd} /></label><div className="builder-footer"><span className="privacy-hint">不会把未确认的 JD 条件直接用于候选人排序。</span><button className="primary-button" onClick={() => setStep("review")}><Sparkles size={16} /> 解析胜任力模型</button></div></section> : null}
    {step === "review" ? <section className="builder-card"><div className="model-review-head"><div><strong>AI 起草了 6 项能力</strong><p>请检查名称、权重和必须项。权重合计 100%。</p></div><span className="demo-badge">Finance-PM v1.4.0</span></div><div className="competency-list editable">{financeCompetencies.map((item, index) => <article key={item.id}><span>{index + 1}</span><div><strong>{item.name}</strong><p>{item.description}</p></div><input aria-label={`${item.name}权重`} defaultValue={item.weight} /><b>%</b></article>)}</div><div className="builder-footer"><button className="secondary-button" onClick={() => setStep("input")}>返回修改 JD</button><button className="primary-button" onClick={() => setStep("done")}><Check size={16} /> 确认能力模型</button></div></section> : null}
    {step === "done" ? <section className="success-state"><span><Check size={28} /></span><h2>岗位模型已确认</h2><p>现在可以上传简历。后续每次模型、Prompt 或 Skill Pack 变更都会保留版本。</p><a className="primary-button" href="/candidates">进入候选人管理</a></section> : null}
  </div>;
}

