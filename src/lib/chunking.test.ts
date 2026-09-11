import { describe, expect, it } from "vitest";
import { chunkDocument } from "./chunking";

describe("chunkDocument", () => {
  it("keeps section and locator metadata", () => {
    const chunks = chunkDocument([{ section: "项目经历", page: 2, text: "主导项目。".repeat(80) }], 120, 20);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].section).toBe("项目经历");
    expect(chunks[0].page).toBe(2);
    expect(chunks[1].start).toBeLessThan(chunks[0].end);
  });
});
