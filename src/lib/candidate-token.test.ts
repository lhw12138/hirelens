import { describe, expect, it } from "vitest";
import { createCandidateLinkToken, verifyCandidateLinkToken } from "./candidate-token";

describe("candidate link token", () => {
  it("keeps application scope and purpose", async () => {
    const token = await createCandidateLinkToken("app-42", "5m");
    await expect(verifyCandidateLinkToken(token)).resolves.toMatchObject({ applicationId: "app-42" });
  });
  it("rejects tampering", async () => {
    const token = await createCandidateLinkToken("app-42", "5m");
    await expect(verifyCandidateLinkToken(`${token}x`)).rejects.toThrow();
  });
});

