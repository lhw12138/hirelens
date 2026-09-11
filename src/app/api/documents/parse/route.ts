import { NextResponse } from "next/server";
import { parseResume } from "@/server/documents/parse";
import { requireOwner } from "@/server/workflow/store";
import { createContactToken } from "@/server/workflow/candidate-contact";
import { failure } from "@/app/api/tasks/route";
import { WorkflowError } from "@/server/workflow/store";

export async function POST(request: Request) {
  try {
    const owner=await requireOwner();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new WorkflowError("请选择一份 PDF 或 DOCX 简历。",400,"INVALID_INPUT");
    if (file.size > 8 * 1024 * 1024) throw new WorkflowError("文件不能超过 8MB。",413,"INVALID_INPUT");
    const result = await parseResume(Buffer.from(await file.arrayBuffer()), file.type);
    const { emails, ...safeResult } = result;
    return NextResponse.json({ ...safeResult, contactToken: createContactToken(owner, emails), contactEmailCount: emails.length });
  } catch (error) {
    if(error instanceof WorkflowError)return failure(error);
    const detail=error instanceof Error?error.message:"";
    const message=/扫描版|足够文本/.test(detail)?"没有提取到足够文字。这可能是扫描版 PDF，请先进行 OCR 后再上传。":/仅支持/.test(detail)?"仅支持 PDF 或 DOCX 简历。":/30 页/.test(detail)?"PDF 不能超过 30 页。":"无法读取这份文件。请确认文件未损坏、未加密，并包含可复制文字。";
    return NextResponse.json({error:message,code:"DOCUMENT_PARSE_FAILED"},{status:422});
  }
}
