"use client";
import { useState } from "react";
import { Check, FileText, ShieldCheck, UploadCloud } from "lucide-react";

export function ResumeUpload() {
  const [stage, setStage] = useState<"upload" | "redaction" | "indexing">("upload");
  return <div><div className="page-heading"><div><h1>先脱敏，再进入 AI 流程</h1><p>支持 PDF、DOCX，单个文件不超过 8MB。</p></div></div>
    {stage === "upload" ? <section className="upload-zone"><UploadCloud size={34} /><h2>拖入简历，或选择文件</h2><p>本地解析不会执行文档中的脚本或外部链接。</p><label className="primary-button">选择演示文件<input type="file" accept=".pdf,.docx" onChange={() => setStage("redaction")} hidden /></label></section> : null}
    {stage === "redaction" ? <div className="redaction-layout"><section className="work-panel"><header className="section-heading"><div><h2>脱敏预览</h2></div><span className="status-pill active"><ShieldCheck size={13} /> 本地完成</span></header><div className="resume-preview"><h3>[姓名已隐藏]</h3><p>财务产品经理 · 6 年经验</p><dl><div><dt>电话</dt><dd>[手机号已脱敏]</dd></div><div><dt>邮箱</dt><dd>[邮箱已脱敏]</dd></div></dl><h4>项目经历</h4><p>主导财务共享平台 2.0 产品建设，协同财务、IT、风控与法务团队完成需求评审与上线落地。</p></div></section><aside className="work-panel"><header className="section-heading"><div><h2>发现 3 类敏感信息</h2></div></header><ul className="check-list"><li><Check size={15} /> 手机号 1 处已遮盖</li><li><Check size={15} /> 邮箱 1 处已遮盖</li><li><Check size={15} /> 详细地址 1 处已遮盖</li></ul><p className="privacy-copy">只有确认后的脱敏片段会进入向量和评审模型。原始文件保留在受控对象存储中。</p><button className="primary-button full-button" onClick={() => setStage("indexing")}>确认并开始索引</button></aside></div> : null}
    {stage === "indexing" ? <section className="success-state"><span><FileText size={28} /></span><h2>简历已进入索引队列</h2><p>演示任务：解析 2 页、生成 18 个片段、进行关键词与向量索引。</p><a className="primary-button" href="/candidates">返回候选人列表</a></section> : null}
  </div>;
}

