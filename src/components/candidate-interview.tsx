"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronRight, Mic, MicOff, RotateCcw, Send, ShieldCheck } from "lucide-react";

type Turn = { role: "interviewer" | "candidate"; text: string; label?: string };
const questions = [
  "请用一个具体项目说明，你如何从业务问题识别出值得做的 AI 产品机会？",
  "如果财务业务方希望模型直接给出审批结论，你会怎样设计产品边界？",
  "请讲讲你如何组织产品、算法、研发与业务团队完成一次上线交付。",
];
const initial: Turn[] = [{ role: "interviewer", text: questions[0], label: "核心问题 1 / 3" }];

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => {
      lang: string; interimResults: boolean; continuous: boolean;
      onresult: (event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void;
      onend: () => void; onerror: () => void; start: () => void; stop: () => void;
    };
  }
}

export function CandidateInterview({ token }: { token: string }) {
  const storageKey = `hirelens-interview:${token}`;
  const [turns, setTurns] = useState<Turn[]>(initial);
  const [answer, setAnswer] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [followUpRound, setFollowUpRound] = useState(0);
  const [listening, setListening] = useState(false);
  const [done, setDone] = useState(false);
  const recognition = useRef<InstanceType<NonNullable<typeof window.webkitSpeechRecognition>> | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return;
    try {
      const state = JSON.parse(saved) as { turns: Turn[]; questionIndex: number; followUpRound: number; done: boolean };
      queueMicrotask(() => { setTurns(state.turns); setQuestionIndex(state.questionIndex); setFollowUpRound(state.followUpRound); setDone(state.done); });
    } catch { localStorage.removeItem(storageKey); }
  }, [storageKey]);
  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify({ turns, questionIndex, followUpRound, done })); }, [storageKey, turns, questionIndex, followUpRound, done]);

  const progress = useMemo(() => Math.min(100, Math.round(((questionIndex + (done ? 1 : 0)) / questions.length) * 100)), [questionIndex, done]);

  function toggleVoice() {
    if (listening) { recognition.current?.stop(); setListening(false); return; }
    if (!window.webkitSpeechRecognition) { alert("当前浏览器不支持实时语音识别，请使用文字回答或最新版 Chrome/Edge。"); return; }
    const engine = new window.webkitSpeechRecognition();
    engine.lang = "zh-CN"; engine.interimResults = false; engine.continuous = false;
    engine.onresult = (event) => setAnswer((value) => `${value}${value ? " " : ""}${event.results[0][0].transcript}`);
    engine.onend = () => setListening(false); engine.onerror = () => setListening(false);
    recognition.current = engine; engine.start(); setListening(true);
  }

  async function submitAnswer() {
    const value = answer.trim(); if (!value) return;
    setTurns((current) => [...current, { role: "candidate", text: value }]); setAnswer("");
    const response = await fetch("/api/interview/turn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: token, questionIndex, answer: value, followUpRound }) });
    const data = response.ok ? await response.json() as { followUp?: string; nextQuestion?: string; done?: boolean } : {};
    if (data.followUp) { setFollowUpRound((round) => round + 1); setTurns((current) => [...current, { role: "interviewer", text: data.followUp!, label: "基于证据的追问" }]); return; }
    if (data.done || questionIndex >= questions.length - 1) { setDone(true); return; }
    const next = questionIndex + 1; setQuestionIndex(next); setFollowUpRound(0);
    setTurns((current) => [...current, { role: "interviewer", text: data.nextQuestion || questions[next], label: `核心问题 ${next + 1} / ${questions.length}` }]);
  }

  if (done) return <main className="candidate-shell"><section className="interview-complete"><span><Check size={32} /></span><p className="candidate-kicker">回答已安全提交</p><h1>本次结构化面试已完成</h1><p>系统只会生成带证据的评估草稿，最终结论由招聘负责人确认。你可以关闭本页。</p><button onClick={() => { localStorage.removeItem(storageKey); setTurns(initial); setQuestionIndex(0); setFollowUpRound(0); setDone(false); }}><RotateCcw size={15} /> 重置演示</button></section></main>;

  return <main className="candidate-shell">
    <header className="candidate-header"><div className="candidate-brand"><span>MT</span><div><strong>MeritTrace</strong><small>结构化候选人面试</small></div></div><div className="privacy-seal"><ShieldCheck size={15} /> 本场回答仅用于招聘评估</div></header>
    <div className="candidate-progress"><span style={{ width: `${progress}%` }} /></div>
    <section className="interview-stage"><aside><span className="candidate-kicker">岗位</span><h1>财务 AI 产品经理</h1><p>预计 12–15 分钟</p><dl><div><dt>当前进度</dt><dd>{questionIndex + 1} / {questions.length}</dd></div><div><dt>追问上限</dt><dd>每题 2 轮</dd></div><div><dt>断点恢复</dt><dd>已开启</dd></div></dl><p className="candidate-note">请尽量讲清背景、你的行动和结果。无法确认的信息可以直接说“不确定”。</p></aside>
      <div className="conversation-panel"><div className="conversation-scroll">{turns.map((turn, index) => <article className={`message ${turn.role}`} key={`${turn.role}-${index}`}>{turn.label ? <span>{turn.label}</span> : null}<p>{turn.text}</p></article>)}</div><div className="answer-composer"><textarea aria-label="回答内容" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="输入回答，或点击麦克风开始说话……" /><div><button className={`voice-button ${listening ? "recording" : ""}`} onClick={toggleVoice}>{listening ? <MicOff size={17} /> : <Mic size={17} />} {listening ? "停止录音" : "语音回答"}</button><small>内容自动保存在本机</small><button className="send-button" onClick={submitAnswer} disabled={!answer.trim()}>提交回答 <Send size={15} /></button></div></div></div>
    </section><footer className="candidate-footer">AI 可能产生错误。评估必须引用你的原始回答，并由 HR 最终确认。 <ChevronRight size={13} /></footer>
  </main>;
}
