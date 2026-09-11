"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, ExternalLink, FileText, Link2, Minus, Plus, RotateCcw, Search, Sparkles } from "lucide-react";
import { activeJob, candidates } from "@/lib/demo-data";
import { calculateWeightedScore, finalCompetencyScore } from "@/lib/scoring";
import type { CompetencyScore, EvidenceStatus } from "@/lib/types";
import { StatusMark } from "./status-mark";

const stageRail = ["JD 解析", "简历索引", "面试完成", "AI 评估", "HR 待确认"];

export function CalibrationWorkspace() {
  const [selectedId, setSelectedId] = useState("c-002");
  const selected = candidates.find((item) => item.id === selectedId) ?? candidates[1];
  const [adjustments, setAdjustments] = useState<Record<string, number>>(
    Object.fromEntries(selected.scores.map((score) => [score.competencyId, score.hrAdjustment])),
  );
  const [resolved, setResolved] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [activeCompetency, setActiveCompetency] = useState("ai");

  const visibleScores = useMemo(() => selected.scores.map((score) => ({ ...score, hrAdjustment: adjustments[score.competencyId] ?? score.hrAdjustment })), [selected, adjustments]);
  const finalScore = calculateWeightedScore(activeJob.competencies, visibleScores);
  const activeScore = visibleScores.find((score) => score.competencyId === activeCompetency) ?? visibleScores[0];
  const citations = selected.citations.filter((citation) => citation.competencyId === activeCompetency || citation.status === "conflict");
  const hasConflict = selected.scores.some((score) => score.status === "conflict") && !resolved;

  function selectCandidate(id: string) {
    const next = candidates.find((item) => item.id === id);
    if (!next) return;
    setSelectedId(id);
    setAdjustments(Object.fromEntries(next.scores.map((score) => [score.competencyId, score.hrAdjustment])));
    setResolved(false);
    setConfirmed(false);
    setSaveError("");
  }

  function setAdjustment(score: CompetencyScore, delta: number) {
    setAdjustments((current) => ({ ...current, [score.competencyId]: Math.max(-20, Math.min(20, (current[score.competencyId] ?? 0) + delta)) }));
  }

  async function confirmAssessment() {
    if (selected.id !== "c-002") {
      setSaveError("当前可写演示底稿为陈子墨，请选择该候选人完成校准流程。");
      return;
    }
    setSaving(true);
    setSaveError("");
    const revisions = visibleScores
      .filter((score) => score.hrAdjustment !== 0)
      .map((score) => ({
        competencyKey: score.competencyId,
        previousScore: score.aiScore,
        revisedScore: finalCompetencyScore(score),
        reason: "基于合成证据核查结果进行人工校准。",
      }));
    const response = await fetch("/api/assessments/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        assessmentId: "00000000-0000-4000-8000-000000000090",
        revisions,
        conflictResolved: resolved,
        finalDecision: "hold",
      }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { message?: string };
      setSaveError(body.message || "保存失败，请稍后重试。");
      setSaving(false);
      return;
    }
    setConfirmed(true);
    setSaving(false);
  }

  return (
    <div className="calibration-page">
      <div className="page-heading compact-heading">
        <div><h1>候选人胜任力评估</h1><p>AI 提供可追溯建议，最终分数由 HR 审核确认。</p></div>
        <div className="heading-actions"><button className="secondary-button"><RotateCcw size={15} /> 重跑评估</button><button className="secondary-button">导出底稿</button></div>
      </div>

      <div className="calibration-grid">
        <section className="candidate-rail" aria-label="候选人排名">
          <div className="panel-heading"><div><strong>候选人</strong><span>共 {candidates.length} 人</span></div><button aria-label="搜索候选人"><Search size={16} /></button></div>
          <div className="candidate-list">
            {candidates.map((candidate, index) => (
              <button key={candidate.id} className={`candidate-row ${candidate.id === selected.id ? "selected" : ""}`} onClick={() => selectCandidate(candidate.id)}>
                <span className={`rank rank-${index + 1}`}>{index + 1}</span>
                <span className="candidate-copy"><strong>{candidate.name}</strong><small>{candidate.currentTitle} · {candidate.years} 年</small></span>
                <span className="candidate-score">{candidate.overallScore.toFixed(1)}</span>
              </button>
            ))}
          </div>
          <div className="rail-pagination"><button><ChevronLeft size={15} /></button><span>1</span><button><ChevronRight size={15} /></button></div>
        </section>

        <section className="assessment-panel">
          <div className="candidate-header">
            <div><span className="back-link">候选人 / {selected.id.toUpperCase()}</span><h2>{selected.name}<span className="synthetic-inline">合成</span></h2><p>{selected.currentCompany} · {selected.currentTitle} · {selected.education}</p></div>
            <div className="score-lockup"><span>校准后总分</span><strong>{finalScore.toFixed(1)}</strong><small>{confirmed ? "已确认" : "待确认"}</small></div>
          </div>

          <div className="score-table" role="table" aria-label="胜任力评分表">
            <div className="score-table-head" role="row">
              <span>评估维度</span><span>证据主张</span><span>AI 评分</span><span>HR 调整</span><span>最终分</span>
            </div>
            {activeJob.competencies.map((competency) => {
              const score = visibleScores.find((item) => item.competencyId === competency.id)!;
              const displayStatus: EvidenceStatus = score.status === "conflict" && resolved ? "review" : score.status;
              return (
                <div key={competency.id} role="row" tabIndex={0} className={`score-row ${activeCompetency === competency.id ? "active" : ""}`} onClick={() => setActiveCompetency(competency.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setActiveCompetency(competency.id); }}>
                  <span className="dimension-cell"><strong>{competency.name}</strong><small>权重 {competency.weight}%</small></span>
                  <span className="claim-cell"><span>{score.claim}</span><small><Link2 size={12} /> 证据 {score.evidenceCount} 条</small></span>
                  <span className="number-cell">{score.aiScore}</span>
                  <span className="adjust-cell" onClick={(event) => event.stopPropagation()}>
                    <button aria-label="减少调整" onClick={() => setAdjustment(score, -1)}><Minus size={13} /></button><strong className={(score.hrAdjustment ?? 0) > 0 ? "positive" : (score.hrAdjustment ?? 0) < 0 ? "negative" : ""}>{score.hrAdjustment > 0 ? "+" : ""}{score.hrAdjustment}</strong><button aria-label="增加调整" onClick={() => setAdjustment(score, 1)}><Plus size={13} /></button>
                  </span>
                  <span className="final-cell"><strong>{finalCompetencyScore(score)}</strong><StatusMark status={displayStatus} /></span>
                </div>
              );
            })}
          </div>

          <div className="process-rail">
            {stageRail.map((stage, index) => <div key={stage} className={index < 4 ? "complete" : "current"}><span>{index < 4 ? <Check size={13} /> : index + 1}</span><strong>{stage}</strong><small>{index < 4 ? "已完成" : confirmed ? "已确认" : "当前节点"}</small></div>)}
          </div>
          <div className="trace-strip"><span><Sparkles size={14} /> HireLens-Judge v2.3.1</span><span>Skill Pack · Finance-PM v1.4.0</span><span>检索 P95 · 287ms</span><span>本次估算 · ¥0.148</span></div>
        </section>

        <aside className="evidence-inspector" aria-label="证据核查">
          <div className="inspector-heading"><div><span>证据核查</span><strong>{selected.name} · {activeJob.competencies.find((item) => item.id === activeCompetency)?.name}</strong></div><StatusMark status={activeScore.status === "conflict" && resolved ? "review" : activeScore.status} /></div>
          <div className="shared-scale">
            <div><span>AI 原分</span><strong>{activeScore.aiScore}</strong></div><div><span>HR 修订</span><strong className="teal">{activeScore.hrAdjustment > 0 ? "+" : ""}{activeScore.hrAdjustment}</strong></div><div><span>最终分</span><strong>{finalCompetencyScore(activeScore)}</strong></div>
          </div>
          <div className="evidence-stack">
            {(citations.length ? citations : selected.citations.slice(0, 2)).map((citation) => (
              <article key={citation.id} className={`evidence-card ${citation.status}`}>
                <header><span><FileText size={14} /> {citation.sourceType === "resume" ? "简历摘录" : "面试摘录"}</span><StatusMark status={citation.status} compact /></header>
                <blockquote>{citation.quote}</blockquote>
                <footer><span>{citation.sourceLabel} · {citation.locator}</span><button aria-label="查看原文"><ExternalLink size={13} /></button></footer>
              </article>
            ))}
          </div>
          {hasConflict ? (
            <div className="conflict-card"><div><AlertTriangle size={18} /><strong>经历时间存在冲突</strong></div><p>简历记录为 2022.03–2023.06，面试回答为 2022.07–2023.03。系统不会自动判定真伪。</p><button onClick={() => setResolved(true)}>核实并记录</button></div>
          ) : (
            <div className="resolved-card"><Check size={16} /><div><strong>人工核实已记录</strong><p>冲突保留在审计记录中，不再阻断确认。</p></div></div>
          )}
          <label className="review-reason"><span>修订理由</span><textarea defaultValue="补充项目中的跨部门协作与资源协调证据，调整该维度分数。" /></label>
          {saveError ? <p className="decision-note">{saveError}</p> : null}
          <button className="confirm-button" disabled={hasConflict || confirmed || saving} onClick={confirmAssessment}>{confirmed ? <><Check size={17} /> 评估已确认</> : saving ? "正在写入审计记录…" : "确认本次评估"}</button>
          <p className="decision-note">确认后将写入人工修订记录。AI 无权直接改变候选人录用状态。</p>
        </aside>
      </div>
    </div>
  );
}

