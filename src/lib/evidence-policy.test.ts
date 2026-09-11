import {describe,expect,it} from "vitest";
import {isEligibleScoringEvidence} from "./evidence-policy";

describe("scoring evidence policy",()=>{
 it("blocks identity-only material",()=>expect(isEligibleScoringEvidence("姓名、年龄、籍贯、政治面貌和毕业院校已列出。")).toBe(false));
 it("keeps mixed chunks that contain real work evidence",()=>expect(isEligibleScoringEvidence("姓名已脱敏。负责订单服务开发与性能优化，完成压测验证。")).toBe(true));
 it("does not mistake a negated job keyword for positive evidence",()=>expect(isEligibleScoringEvidence("材料只有姓名和年龄，没有需求分析或产品交付证据。")).toBe(false));
 it("keeps job-relevant education without using school prestige",()=>expect(isEligibleScoringEvidence("硕士学历，统计学专业，持有相关资格证书。")).toBe(true));
 it("keeps ordinary technical evidence",()=>expect(isEligibleScoringEvidence("熟悉 Java、MySQL 和 Redis，参与微服务开发。")).toBe(true));
});
