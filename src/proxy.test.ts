import { describe, expect, it } from "vitest";
import { isAllowedOrigin, isPublicPath } from "./proxy";

describe("proxy public paths", () => {
  it("keeps the deployment liveness endpoint public", () => {
    expect(isPublicPath("/api/live")).toBe(true);
  });

  it("does not expose operational health details", () => {
    expect(isPublicPath("/api/health")).toBe(false);
    expect(isPublicPath("/health")).toBe(false);
  });
});

describe("proxy origin protection", () => {
  it("accepts the public HTTPS origin behind a reverse proxy", () => {
    expect(isAllowedOrigin("https://merittrace.cyou", "http://web:3000", "https://merittrace.cyou")).toBe(true);
  });

  it("continues to reject unrelated origins", () => {
    expect(isAllowedOrigin("https://example.com", "http://web:3000", "https://merittrace.cyou")).toBe(false);
  });

  it("accepts direct same-origin and origin-less requests", () => {
    expect(isAllowedOrigin("http://localhost:3000", "http://localhost:3000")).toBe(true);
    expect(isAllowedOrigin(null, "http://localhost:3000")).toBe(true);
  });
});
