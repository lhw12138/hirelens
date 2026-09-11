export type QualityMetricKey="statusAccuracy"|"citationAccuracy"|"evidenceCoverage"|"unsupportedConclusionRate"|"conflictRecall"|"scoreRangeAccuracy";
export type QualityMetrics=Record<QualityMetricKey,number>;

export const QUALITY_GATES=[
 {key:"statusAccuracy",label:"状态判断准确率",threshold:90,direction:"min"},
 {key:"citationAccuracy",label:"引用准确率",threshold:95,direction:"min"},
 {key:"evidenceCoverage",label:"证据覆盖率",threshold:90,direction:"min"},
 {key:"unsupportedConclusionRate",label:"无依据结论率",threshold:2,direction:"max"},
 {key:"conflictRecall",label:"冲突召回率",threshold:90,direction:"min"},
 {key:"scoreRangeAccuracy",label:"分数区间命中率",threshold:70,direction:"min"},
] as const satisfies ReadonlyArray<{key:QualityMetricKey;label:string;threshold:number;direction:"min"|"max"}>;

export function evaluateQualityGates(metrics:QualityMetrics){
 const items=QUALITY_GATES.map(gate=>({...gate,value:metrics[gate.key],passed:gate.direction==="min"?metrics[gate.key]>=gate.threshold:metrics[gate.key]<=gate.threshold}));
 return{items,passed:items.filter(item=>item.passed).length,total:items.length,ready:items.every(item=>item.passed)};
}
