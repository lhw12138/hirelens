import { describe, expect, it } from "vitest";
import { ASSESSMENT_TOOL_ALLOWLIST } from "./tools";

describe("assessment agent boundaries", () => {
  it("has an explicit allowlist and no final decision mutation tool", () => {
    expect(ASSESSMENT_TOOL_ALLOWLIST).toEqual([
      "read_job_model", "retrieve_resume_evidence", "retrieve_interview_evidence", "detect_conflicts", "calculate_rule_score", "draft_assessment",
    ]);
    expect(ASSESSMENT_TOOL_ALLOWLIST.some((name) => /confirm|hire|reject_candidate/.test(name))).toBe(false);
  });
});

