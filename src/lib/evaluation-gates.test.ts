import {describe,expect,it} from "vitest";
import {evaluateQualityGates} from "./evaluation-gates";

describe("evaluation quality gates",()=>{
 it("requires every internal gate before recommending release",()=>{const result=evaluateQualityGates({statusAccuracy:95,citationAccuracy:100,evidenceCoverage:95,unsupportedConclusionRate:0,conflictRecall:100,scoreRangeAccuracy:75});expect(result.ready).toBe(true);expect(result.passed).toBe(6);});
 it("reports the exact failing dimensions",()=>{const result=evaluateQualityGates({statusAccuracy:88,citationAccuracy:100,evidenceCoverage:82,unsupportedConclusionRate:0,conflictRecall:100,scoreRangeAccuracy:63});expect(result.ready).toBe(false);expect(result.items.filter(item=>!item.passed).map(item=>item.key)).toEqual(["statusAccuracy","evidenceCoverage","scoreRangeAccuracy"]);});
});
