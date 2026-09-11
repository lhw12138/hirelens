import "server-only";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { chunkDocument, type DocumentChunkInput } from "@/lib/chunking";
import { extractEmailAddresses, redactPersonalData } from "@/lib/redaction";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_PDF_PAGES = 30;

export interface ParsedResume {
  pageCount: number;
  redactedText: string;
  findings: ReturnType<typeof redactPersonalData>["findings"];
  chunks: ReturnType<typeof chunkDocument>;
  emails: string[];
}

export async function parseResume(buffer: Buffer, mimeType: string): Promise<ParsedResume> {
  if (buffer.byteLength > MAX_FILE_BYTES) throw new Error("文件不能超过 8MB");

  let sections: DocumentChunkInput[] = [];
  let pageCount = 1;
  if (mimeType === "application/pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(buffer), { maxImageSize: 16_777_216 });
    if (pdf.numPages > MAX_PDF_PAGES) throw new Error("PDF 不能超过 30 页");
    const extracted = await extractText(pdf, { mergePages: false });
    pageCount = extracted.totalPages;
    sections = (extracted.text as string[]).map((text, index) => ({ section: `第 ${index + 1} 页`, page: index + 1, text }));
  } else if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const result = await mammoth.extractRawText({ buffer });
    sections = result.value.split(/\n{2,}/).map((text, index) => ({ section: `段落 ${index + 1}`, text }));
  } else {
    throw new Error("仅支持 PDF 或 DOCX 简历");
  }

  const rawText = sections.map((section) => section.text).join("\n\n");
  if (rawText.trim().length < 30) throw new Error("未提取到足够文本，可能是扫描版 PDF");
  const redacted = redactPersonalData(rawText);
  const redactedSections = sections.map((section) => ({ ...section, text: redactPersonalData(section.text).text }));

  return {
    pageCount,
    redactedText: redacted.text,
    findings: redacted.findings,
    chunks: chunkDocument(redactedSections),
    emails: extractEmailAddresses(rawText),
  };
}
