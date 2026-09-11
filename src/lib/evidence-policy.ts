const identityOnlySignals = /姓名|年龄|性别|籍贯|政治面貌|婚姻|婚育|出生|生日|照片|民族|身份证|住址|现居|毕业院校/;
const jobEvidenceSignals = /负责|主导|参与|完成|开发|设计|分析|运营|销售|实现|上线|协调|管理|研究|优化|验证|交付|复盘|熟悉|掌握/;

/** Prevent identity-only chunks from reaching a scoring model. Mixed chunks with job evidence remain eligible. */
export function isEligibleScoringEvidence(text:string){
 const normalized=text.replace(/\s+/g," ").trim();
 if(!normalized)return false;
 const affirmativeText=normalized.replace(/(?:没有|无|未提供|缺少)[^。；;]*/g," ");
 return !identityOnlySignals.test(normalized)||jobEvidenceSignals.test(affirmativeText);
}
