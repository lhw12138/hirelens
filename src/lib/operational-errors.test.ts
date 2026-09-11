import { describe, expect, it } from "vitest";
import { looksLikeDatabaseError, looksLikeTimeout, operationalRecovery } from "./operational-errors";

describe("operational errors", () => {
  it("recognizes infrastructure failures without exposing raw payloads", () => {
    expect(looksLikeDatabaseError({ code: "ECONNREFUSED" })).toBe(true);
    expect(looksLikeTimeout(new DOMException("stopped", "AbortError"))).toBe(true);
    expect(operationalRecovery.MAIL_UNCERTAIN).toContain("不要立即重复发送");
  });
});
