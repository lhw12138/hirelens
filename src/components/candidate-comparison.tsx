"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, FileText, Printer, ShieldCheck, TriangleAlert } from "lucide-react";
import { assessmentFor, comparisonReport, comparisonScores, comparisonTotal, evidenceStatusLabel, hardRequirementLabel, hardRequirementResult, rankCandidates, type ComparisonStage } from "@/lib/candidate-comparison";
import type { Criterion, TaskRecord } from "@/lib/workflow";

const decisionLabel = { advance: "进入下一轮", hold: "补充信息后再判断", reject: "不推进" } as const;

export function CandidateComparison({ id }: { id: string }) {
  const [row, setRow] = useState<TaskRecord | null>(null);
  const [stage, setStage] = useState<ComparisonStage>("screening");
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/tasks/${id}`, { signal: controller.signal }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setRow(data);
      if (!data.data.candidates.some((person: { screening?: unknown }) => person.screening) && data.data.candidates.some((person: { assessment?: unknown }) => person.assessment)) setStage("combined");
    }).catch((reason) => { if (reason.name !== "AbortError") setError(reason.message); });
    return () => controller.abort();
  }, [id]);

  const task = row?.data;
  const criteria = useMemo<Criterion[]>(() => task ? (stage === "screening" ? task.criteria : task.evaluationCriteria || task.criteria) : [], [task, stage]);
  const people = useMemo(() => task ? rankCandidates(task.candidates.filter((person) => assessmentFor(person, stage)), criteria, stage) : [], [task, criteria, stage]);

  function download() {
    if (!task) return;
    const report = comparisonReport(task, stage);
    const url = URL.createObjectURL(new Blob([report.text], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = report.filename; link.click(); URL.revokeObjectURL(url);
  }

  if (!task) return <div className="hl-empty">{error ? <div><h1>暂时无法打开对比页</h1><p>{error}</p><Link href={`/tasks/${id}`}>返回招聘任务</Link></div> : <p>正在整理候选人结果…</p>}</div>;
  return <div className="hl-compare-page">
    <Link href={`/tasks/${id}`} className="hl-back"><ArrowLeft size={15}/>返回招聘任务</Link>
    <header className="hl-compare-header">
      <div><span className="hl-eyebrow">候选人对比</span><h1>{task.title}</h1><p>先看整体差异，再进入个人页核对原文。分数辅助阅读，不代替招聘判断。</p></div>
      <div className="hl-compare-actions"><button className="hl-secondary" onClick={download} disabled={!people.length}><Download size={16}/>导出对比报告</button><button className="hl-secondary" onClick={() => window.print()} disabled={!people.length}><Printer size={16}/>打印 / 另存 PDF</button></div>
    </header>
    {task.synthetic && <div className="hl-synthetic-note"><ShieldCheck size={17}/><span><strong>合成测试资料</strong>：候选人、公司和经历均为虚构，仅用于验证系统区分度。</span></div>}
    <div className="hl-stage-tabs" role="tablist" aria-label="选择对比阶段"><button role="tab" aria-selected={stage === "screening"} onClick={() => setStage("screening")}>简历初筛</button><button role="tab" aria-selected={stage === "combined"} onClick={() => setStage("combined")}>综合评估</button></div>
    {!people.length ? <section className="hl-compare-empty"><FileText size={24}/><h2>这个阶段还没有可对比的结果</h2><p>返回任务完成至少一位候选人的{stage === "screening" ? "简历评分" : "综合评估"}后，再来横向查看。</p><Link className="hl-primary" href={`/tasks/${id}`}>返回继续处理</Link></section> : <>
      <section className="hl-compare-summary" aria-label="候选人概览">{people.map((person, index) => {
        const assessment = assessmentFor(person, stage)!;
        const total = comparisonTotal(person, criteria, stage);
        const warnings = assessment.scores.filter((score) => score.status === "conflict" || score.status === "insufficient");
        const gate = hardRequirementResult(person, criteria, stage);
        return <article key={person.id}><div className="hl-compare-rank"><span>{total === null ? "—" : `#${index + 1}`}</span><strong>{total === null ? "待核实" : total.toFixed(1)}</strong><small>{total === null ? "有冲突项" : "/ 100"}</small></div><div><h2>{person.name}</h2><p>{warnings.length ? `${warnings.length} 项需要留意` : "各项均有可核对证据"}</p>{gate.state !== "none" && <span className={`hl-hard-badge is-${gate.state}`}>{hardRequirementLabel[gate.state]}</span>}{person.review && stage === "combined" ? <span className="hl-decision">HR：{decisionLabel[person.review.decision]}</span> : <span>待人工确认</span>}</div><Link href={`/tasks/${id}?candidate=${person.id}`}>查看原文</Link></article>;
      })}</section>
      <section className="hl-compare-matrix" aria-label="评分维度横向对比"><div className="hl-compare-grid hl-compare-grid-head" style={{ "--candidate-count": people.length } as React.CSSProperties}><div>评估维度</div>{people.map((person) => <div key={person.id}>{person.name}</div>)}</div>{criteria.map((criterion) => <div className="hl-compare-grid" style={{ "--candidate-count": people.length } as React.CSSProperties} key={criterion.id}><div><strong>{criterion.name}</strong><small>权重 {criterion.weight}%</small>{criterion.mustHave&&<em>硬性 · ≥{criterion.minimumScore||60}分</em>}</div>{people.map((person) => {
        const assessment = assessmentFor(person, stage)!;
        const item = assessment.scores.find((score) => score.criterionId === criterion.id);
        const score = comparisonScores(person, stage)[criterion.id];
        return <div className={`hl-compare-cell is-${item?.status || "empty"}`} key={person.id}><strong>{score ?? "—"}</strong><span>{item ? evidenceStatusLabel[item.status] : "未生成"}</span><p>{item?.claim || "暂无判断。"}</p>{item?.status === "conflict" && <TriangleAlert size={15}/>}</div>;
      })}</div>)}</section>
      <section className="hl-compare-mobile" aria-label="候选人逐项对比">{people.map((person, index) => {
        const assessment = assessmentFor(person, stage)!;
        const gate = hardRequirementResult(person, criteria, stage);
        return <article key={person.id}><header><div><span>{comparisonTotal(person, criteria, stage) === null ? "待核实" : `排名 ${index + 1}`}</span><h2>{person.name}</h2>{gate.state !== "none" && <em className={`hl-hard-badge is-${gate.state}`}>{hardRequirementLabel[gate.state]}</em>}</div><strong>{comparisonTotal(person, criteria, stage)?.toFixed(1) ?? "—"}<small>/100</small></strong></header><dl>{criteria.map((criterion) => { const item = assessment.scores.find((score) => score.criterionId === criterion.id); return <div key={criterion.id}><dt>{criterion.name}{criterion.mustHave && <b>硬性 · ≥{criterion.minimumScore || 60}</b>}<small>{item ? evidenceStatusLabel[item.status] : "未生成"}</small></dt><dd>{comparisonScores(person, stage)[criterion.id] ?? "—"}</dd><p>{item?.claim || "暂无判断。"}</p></div>; })}</dl><Link className="hl-secondary" href={`/tasks/${id}?candidate=${person.id}`}>查看评分依据</Link></article>;
      })}</section>
      <footer className="hl-compare-footnote"><TriangleAlert size={16}/><p>排名先按硬性条件状态分组，再在组内比较加权总分。“待核实”和“未满足”仅用于提示风险，不会自动淘汰；最终决定仍由 HR 作出。</p></footer>
    </>}
  </div>;
}
