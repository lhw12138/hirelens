import { proposeHardRequirements } from "../src/server/workflow/model";
import type { HiringTask } from "../src/lib/workflow";
import { getPool } from "../src/server/db/client";

const rows=await getPool().query("select id,data from hiring_tasks where data->>'demoDatasetKey' like 'user-synthetic-%' order by data->>'title'");
for(const row of rows.rows as Array<{id:string;data:HiringTask}>){
 const task=row.data;
 const suggestions=await proposeHardRequirements(task.jd,task.criteria);
 const byId=new Map(suggestions.map(item=>[item.criterionId,item]));
 const apply=(items:typeof task.criteria)=>items.map(item=>{const suggestion=byId.get(item.id);return{...item,mustHave:!!suggestion?.mustHave,minimumScore:suggestion?.mustHave?suggestion.minimumScore||60:undefined};});
 task.criteria=apply(task.criteria);task.evaluationCriteria=apply(task.evaluationCriteria||task.criteria);
 task.audit.push({at:new Date().toISOString(),action:'AI 根据 JD 起草硬性条件，待 HR 在任务中核对'});
 await getPool().query('update hiring_tasks set data=$2::jsonb,version=version+1,updated_at=now() where id=$1',[row.id,JSON.stringify(task)]);
 console.log(task.title+': '+task.criteria.filter(item=>item.mustHave).map(item=>`${item.name} ≥${item.minimumScore}`).join('；'));
}
await getPool().end();
