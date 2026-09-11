"use client";
import {useState} from "react";
import {CheckCircle2,LoaderCircle} from "lucide-react";

export type EvalCaseForReview={id:string;role:string;title:string;scenario:string;criterion:string;sources:Array<{id:string;type:"resume"|"interview";text:string}>;expected:{status:"supported"|"insufficient"|"conflict";scoreRange:[number,number]|null;requiredSourceIds:string[];forbiddenSourceIds:string[];rationale:string;reviewedAt?:string;reviewNote?:string;reviewSource?:"ai_assisted"|"product_owner"|"hr"}};

export function EvaluationCaseEditor({item,onSaved}:{item:EvalCaseForReview;onSaved:()=>Promise<void>}){
 const [status,setStatus]=useState(item.expected.status),[min,setMin]=useState(item.expected.scoreRange?.[0]??35),[max,setMax]=useState(item.expected.scoreRange?.[1]??60),[required,setRequired]=useState(item.expected.requiredSourceIds),[forbidden,setForbidden]=useState(item.expected.forbiddenSourceIds),[rationale,setRationale]=useState(item.expected.rationale),[note,setNote]=useState(item.expected.reviewNote||"已核对案例原文与预期判断"),[saving,setSaving]=useState(false),[message,setMessage]=useState("");
 function toggle(id:string,kind:"required"|"forbidden"){
  if(kind==="required"){setRequired(list=>list.includes(id)?list.filter(value=>value!==id):[...list,id]);setForbidden(list=>list.filter(value=>value!==id));}
  else{setForbidden(list=>list.includes(id)?list.filter(value=>value!==id):[...list,id]);setRequired(list=>list.filter(value=>value!==id));}
 }
 async function save(){setSaving(true);setMessage("");try{const response=await fetch(`/api/evals/cases/${item.id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({status,scoreRange:status==="conflict"?null:[min,max],requiredSourceIds:required,forbiddenSourceIds:forbidden,rationale,reviewNote:note})});const body=await response.json();if(!response.ok)throw new Error(body.error);setMessage("人工标注已保存，将从下一轮评测开始生效。");await onSaved();}catch(error){setMessage(error instanceof Error?error.message:"保存失败，请重试。");}finally{setSaving(false);}}
 return <div className="hl-eval-editor">
  <header><div><strong>HR 校准标注</strong><small>{item.criterion}</small></div>{item.expected.reviewSource==="hr"?<span><CheckCircle2 size={14}/>已由 HR 复核</span>:item.expected.reviewSource==="ai_assisted"?<span>AI 辅助规则复核</span>:null}</header>
  <div className="hl-eval-editor-fields"><label>预期判断<select value={status} onChange={event=>{const next=event.target.value as typeof status;setStatus(next);if(next==="insufficient"){setMin(value=>Math.min(value,24));setMax(value=>Math.min(value,24));}}}><option value="supported">有依据，可评分</option><option value="insufficient">证据不足，低置信度暂估</option><option value="conflict">来源冲突，待核实</option></select></label>{status!=="conflict"&&<div className="hl-eval-range"><label>合理最低分<input type="number" min="0" max={status==="insufficient"?24:100} value={min} onChange={event=>setMin(Number(event.target.value))}/></label><label>合理最高分<input type="number" min="0" max={status==="insufficient"?24:100} value={max} onChange={event=>setMax(Number(event.target.value))}/></label></div>}</div>
  <fieldset><legend>证据规则</legend>{item.sources.length?item.sources.map(source=><div className="hl-eval-source" key={source.id}><p><strong>{source.type==="resume"?"简历":"面试记录"}</strong>{source.text}</p><label><input type="checkbox" checked={required.includes(source.id)} onChange={()=>toggle(source.id,"required")}/>必须引用</label><label><input type="checkbox" checked={forbidden.includes(source.id)} onChange={()=>toggle(source.id,"forbidden")}/>禁止用于评分</label></div>):<p className="hl-help">本案例没有原文，预期应为“证据不足”。</p>}</fieldset>
  <label>标注依据<textarea value={rationale} onChange={event=>setRationale(event.target.value)} rows={3} maxLength={500}/></label>
  <label>HR 复核记录<textarea value={note} onChange={event=>setNote(event.target.value)} rows={2} maxLength={300}/></label>
  <footer><small role="status">{message}</small><button className="hl-primary" onClick={save} disabled={saving}>{saving?<LoaderCircle className="hl-spin" size={16}/>:null}保存 HR 标注</button></footer>
 </div>;
}
