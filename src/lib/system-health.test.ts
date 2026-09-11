import { describe, expect, it } from "vitest";
import { heartbeatState, overallHealth, type HealthService } from "./system-health";
const item=(state:"ok"|"warning"|"error")=>({id:state,name:state,state,message:state,checkedAt:"now"}) satisfies HealthService;
describe("system health",()=>{
  it("uses the most serious service state",()=>{expect(overallHealth([item("ok"),item("warning")])).toBe("warning");expect(overallHealth([item("ok"),item("error")])).toBe("error");});
  it("marks stale heartbeats as unavailable",()=>{expect(heartbeatState(undefined).state).toBe("error");expect(heartbeatState(new Date(1000).toISOString(),50_000).state).toBe("error");expect(heartbeatState(new Date(40_000).toISOString(),50_000).state).toBe("ok");});
});
