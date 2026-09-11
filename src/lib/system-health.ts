export type HealthState = "ok" | "warning" | "error";
export type HealthService = { id:string; name:string; state:HealthState; message:string; recovery?:string; href?:string; checkedAt:string };
export type SystemHealth = { state:HealthState; checkedAt:string; services:HealthService[] };
export function overallHealth(services:HealthService[]):HealthState{return services.some(service=>service.state==="error")?"error":services.some(service=>service.state==="warning")?"warning":"ok";}
export function heartbeatState(lastSeen:string|undefined,now=Date.now()):Pick<HealthService,"state"|"message"|"recovery">{
  if(!lastSeen)return {state:"error",message:"尚未收到后台服务心跳。",recovery:"启动本地开发服务后等待约 15 秒，再刷新。"};
  const age=Math.max(0,now-Date.parse(lastSeen));
  if(age>45_000)return {state:"error",message:`后台服务已 ${Math.round(age/1000)} 秒未响应。`,recovery:"确认后台服务仍在运行；本地环境可重新启动 npm run dev。"};
  if(age>25_000)return {state:"warning",message:"后台服务响应变慢。",recovery:"稍等片刻后刷新；若持续出现，请重新启动开发服务。"};
  return {state:"ok",message:"后台任务可正常接收和处理。"};
}
