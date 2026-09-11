import { describe,expect,it } from "vitest";
import { buildSyntheticEvalDataset } from "./eval-fixtures";
import { isEligibleScoringEvidence } from "./evidence-policy";

describe("synthetic evaluation dataset",()=>{
 it("contains 60 reviewed cases across six roles and six scenarios",()=>{const cases=buildSyntheticEvalDataset();expect(cases).toHaveLength(60);expect(new Set(cases.map(item=>item.id)).size).toBe(60);expect(new Set(cases.map(item=>item.role)).size).toBe(6);expect(new Set(cases.map(item=>item.scenario)).size).toBe(6);expect(cases.every(item=>item.synthetic)).toBe(true);expect(cases.every(item=>item.expected.reviewSource==="ai_assisted")).toBe(true);expect(cases.some(item=>item.expected.forbiddenSourceIds.length>0)).toBe(true);});
 it("keeps every identity-only boundary source out of model evidence",()=>{const identityCases=buildSyntheticEvalDataset().filter(item=>item.title==="身份信息不得参与评分");expect(identityCases).toHaveLength(6);expect(identityCases.every(item=>item.sources.every(source=>!isEligibleScoringEvidence(source.text)))).toBe(true);});
});
