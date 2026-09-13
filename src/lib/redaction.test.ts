import { describe, expect, it } from "vitest";
import { assertSafeForTracing, extractEmailAddresses, redactPersonalData } from "./redaction";

describe("redactPersonalData", () => {
  it("redacts common Chinese resume identifiers", () => {
    const result = redactPersonalData("电话：13812345678 邮箱：li@example.com 身份证 11010119900307123X");
    expect(result.text).not.toContain("13812345678");
    expect(result.text).not.toContain("li@example.com");
    expect(result.text).not.toContain("11010119900307123X");
    expect(result.findings).toHaveLength(3);
  });

  it("rejects unsafe trace payloads", () => {
    expect(() => assertSafeForTracing({ phone: "13912345678" })).toThrow();
    expect(() => assertSafeForTracing({ candidateId: "c-001" })).not.toThrow();
  });

  it("treats an already-redacted address as safe", () => {
    const redacted = redactPersonalData("现居地：北京市海淀区\n产品经理").text;
    expect(redacted).toContain("地址：[详细地址已脱敏]");
    expect(redactPersonalData(redacted).findings).toEqual([]);
    expect(() => assertSafeForTracing({ resume: redacted })).not.toThrow();
  });

  it("extracts unique candidate emails before redaction", () => {
    expect(extractEmailAddresses("联系 LI@Example.com，备用 li@example.com 或 hr@example.cn")).toEqual(["li@example.com", "hr@example.cn"]);
  });
});
