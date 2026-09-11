import {NextResponse} from "next/server";
import {z} from "zod";
import {getPool} from "@/server/db/client";
import {ensureEvaluationDataset} from "@/server/evaluation/runner";
import {requireOwner,WorkflowError} from "@/server/workflow/store";

const bodySchema=z.object({
 status:z.enum(["supported","insufficient","conflict"]),
 scoreRange:z.tuple([z.number().int().min(0).max(100),z.number().int().min(0).max(100)]).nullable(),
 requiredSourceIds:z.array(z.string()).max(4),
 forbiddenSourceIds:z.array(z.string()).max(4),
 rationale:z.string().trim().min(8).max(500),
 reviewNote:z.string().trim().min(4).max(300),
}).superRefine((value,ctx)=>{
 if(value.status!=="conflict"&&!value.scoreRange)ctx.addIssue({code:"custom",path:["scoreRange"],message:"有依据或证据不足的判断都必须填写合理分数区间"});
 if(value.status==="conflict"&&value.scoreRange)ctx.addIssue({code:"custom",path:["scoreRange"],message:"来源冲突时暂不设置分数"});
 if(value.status==="insufficient"&&value.scoreRange&&value.scoreRange[1]>24)ctx.addIssue({code:"custom",path:["scoreRange"],message:"证据不足项的合理区间上限为24分"});
 if(value.scoreRange&&value.scoreRange[0]>value.scoreRange[1])ctx.addIssue({code:"custom",path:["scoreRange"],message:"最低分不能高于最高分"});
 if(value.requiredSourceIds.some(id=>value.forbiddenSourceIds.includes(id)))ctx.addIssue({code:"custom",path:["requiredSourceIds"],message:"同一来源不能同时设为必引和禁用"});
});

export async function PATCH(request:Request,{params}:{params:Promise<{caseId:string}>}){
 try{
  const reviewer=await requireOwner(),dataset=await ensureEvaluationDataset(),{caseId}=await params,body=bodySchema.parse(await request.json());
  const found=await getPool().query<{id:string;input:{sources:Array<{id:string}>}}>("SELECT id,input FROM eval_cases WHERE dataset_id=$1 AND input->>'id'=$2 LIMIT 1",[dataset.id,caseId]);
  const row=found.rows[0];if(!row)return NextResponse.json({error:"找不到这条评测案例。"},{status:404});
  const valid=new Set(row.input.sources.map(source=>source.id));
  if([...body.requiredSourceIds,...body.forbiddenSourceIds].some(id=>!valid.has(id)))return NextResponse.json({error:"引用来源不属于这条案例，请刷新后重试。"},{status:400});
  const expected={status:body.status,scoreRange:body.scoreRange,requiredSourceIds:body.requiredSourceIds,forbiddenSourceIds:body.forbiddenSourceIds,rationale:body.rationale,reviewNote:body.reviewNote,reviewedAt:new Date().toISOString(),reviewSource:"hr",reviewedBy:reviewer};
  await getPool().query("UPDATE eval_cases SET expected=$2::jsonb,updated_at=now() WHERE id=$1",[row.id,JSON.stringify(expected)]);
  return NextResponse.json({expected});
 }catch(error){
  if(error instanceof WorkflowError)return NextResponse.json({error:error.message},{status:error.status});
  if(error instanceof z.ZodError)return NextResponse.json({error:error.issues[0]?.message||"人工标注填写不完整。"},{status:400});
  return NextResponse.json({error:"暂时无法保存人工标注，请重试。"},{status:503});
 }
}
