import 'server-only';
import {getPool} from '@/server/db/client';
import {WorkflowError} from '@/server/workflow/store';

export function hrDailyAiLimit() {
 const configured=Number.parseInt(process.env.HR_DAILY_AI_LIMIT||'50',10);
 return Number.isFinite(configured)&&configured>0?Math.min(configured,500):50;
}

export async function consumeHrAiUsage(ownerEmail: string) {
 const limit=hrDailyAiLimit();
 const result=await getPool().query<{operations:number}>(`
  INSERT INTO hr_ai_usage_daily(owner_email,usage_date,operations)
  VALUES($1,to_char(current_date,'YYYY-MM-DD'),1)
  ON CONFLICT(owner_email,usage_date) DO UPDATE
  SET operations=hr_ai_usage_daily.operations+1
  WHERE hr_ai_usage_daily.operations<$2
  RETURNING operations
 `,[ownerEmail,limit]);
 if(!result.rows[0])throw new WorkflowError(`今天的 AI 分析次数已达到 ${limit} 次，请明天再试。`,429);
 return {used:result.rows[0].operations,limit};
}
