import { NextResponse } from 'next/server';
import { parseResume } from '@/server/documents/parse';
import { candidateFailure, requireCandidate } from '@/server/candidate/service';
import { WorkflowError } from '@/server/workflow/store';
import { allowAttempt } from '@/lib/attempt-limit';
export async function POST(request: Request) {
  try {
    const owner = await requireCandidate();
    if (!allowAttempt(`candidate-parse:${owner}`, 15)) throw new WorkflowError('上传次数较多，请稍后再试。', 429);
    if (Number(request.headers.get('content-length')) > 9 * 1024 * 1024) throw new WorkflowError('文件不能超过8MB。', 413);
    const file = (await request.formData()).get('file');
    if (!(file instanceof File) || file.size > 8 * 1024 * 1024) throw new WorkflowError('请选择不超过8MB的PDF或DOCX。');
    try {
      const result = await parseResume(Buffer.from(await file.arrayBuffer()), file.type);
      if (result.redactedText.length > 30000) throw new Error('too-long');
      return NextResponse.json({ text: result.redactedText }, { headers: { 'cache-control': 'no-store' } });
    } catch { throw new WorkflowError('无法提取简历。请使用可复制文字的PDF或DOCX（最多30页、3万字），也可以粘贴文本。', 422); }
  } catch (error) { return candidateFailure(error); }
}
