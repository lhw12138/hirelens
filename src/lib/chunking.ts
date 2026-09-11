export interface DocumentChunkInput {
  section: string;
  text: string;
  page?: number;
}

export interface DocumentChunk extends DocumentChunkInput {
  index: number;
  start: number;
  end: number;
}

export function chunkDocument(
  sections: DocumentChunkInput[],
  maxLength = 420,
  overlap = 60,
): DocumentChunk[] {
  if (maxLength < 100) throw new Error("maxLength must be at least 100");
  if (overlap < 0 || overlap >= maxLength) throw new Error("overlap must be smaller than maxLength");

  const chunks: DocumentChunk[] = [];
  for (const section of sections) {
    const normalized = section.text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
    if (!normalized) continue;
    let start = 0;
    while (start < normalized.length) {
      let end = Math.min(start + maxLength, normalized.length);
      if (end < normalized.length) {
        const boundary = Math.max(
          normalized.lastIndexOf("。", end),
          normalized.lastIndexOf("；", end),
          normalized.lastIndexOf("\n", end),
        );
        if (boundary > start + maxLength * 0.55) end = boundary + 1;
      }
      chunks.push({ ...section, text: normalized.slice(start, end), index: chunks.length, start, end });
      if (end === normalized.length) break;
      start = Math.max(end - overlap, start + 1);
    }
  }
  return chunks;
}
