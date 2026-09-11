import { describe, expect, it } from "vitest";
import { isPublicPath } from "./proxy";

describe("proxy public paths", () => {
  it("keeps the deployment liveness endpoint public", () => {
    expect(isPublicPath("/api/live")).toBe(true);
  });

  it("does not expose operational health details", () => {
    expect(isPublicPath("/api/health")).toBe(false);
    expect(isPublicPath("/health")).toBe(false);
  });
});
