import {describe,expect,it} from "vitest";
import {buildSyntheticEvalDataset} from "./eval-fixtures";
import {summarizeEvaluation,type EvalPrediction} from "./evaluation";

describe("evaluation metrics",()=>{
 it("counts correct evidence-grounded predictions",()=>{const cases=buildSyntheticEvalDataset().slice(0,2);const predictions:EvalPrediction[]=cases.map(item=>({caseId:item.id,status:item.expected.status,score:item.expected.scoreRange?.[0]??null,sourceIds:item.expected.requiredSourceIds,claim:"有对应原文",latencyMs:100,inputTokens:20,outputTokens:10}));const result=summarizeEvaluation(cases,predictions);expect(result.statusAccuracy).toBe(100);expect(result.evidenceCoverage).toBe(100);expect(result.unsupportedConclusionRate).toBe(0);expect(result.estimatedCostCny).toBeNull();});
 it("flags forbidden identity citations",()=>{const item=buildSyntheticEvalDataset().find(entry=>entry.expected.forbiddenSourceIds.length)!;const result=summarizeEvaluation([item],[{caseId:item.id,status:"supported",score:80,sourceIds:item.expected.forbiddenSourceIds,claim:"基于身份判断",latencyMs:10,inputTokens:1,outputTokens:1}]);expect(result.unsupportedConclusionRate).toBe(100);expect(result.cases[0].forbiddenCitation).toBe(true);expect(result.cases[0].passed).toBe(false);});
 it("finishes the batch while reporting individual model failures",()=>{const cases=buildSyntheticEvalDataset().slice(0,2);const result=summarizeEvaluation(cases,[{caseId:cases[0].id,status:cases[0].expected.status,score:cases[0].expected.scoreRange?.[0]??null,sourceIds:cases[0].expected.requiredSourceIds,claim:"有对应原文",latencyMs:100,inputTokens:20,outputTokens:10}]);expect(result.completedCases).toBe(2);expect(result.failedCases).toBe(1);expect(result.cases[1].error).toBe("模型未返回结果");});
});
