export type OperationalErrorCode =
  | "INVALID_INPUT"
  | "AUTH_REQUIRED"
  | "CONFLICT"
  | "RAG_UNAVAILABLE"
  | "MODEL_TIMEOUT"
  | "MODEL_FAILED"
  | "DATABASE_UNAVAILABLE"
  | "STORAGE_UNAVAILABLE"
  | "DOCUMENT_PARSE_FAILED"
  | "MAIL_UNCERTAIN"
  | "INTERNAL_UNAVAILABLE"
  | "SCORING_TIMEOUT";

export const operationalRecovery: Record<OperationalErrorCode, string> = {
  INVALID_INPUT: "检查填写内容后重试。",
  AUTH_REQUIRED: "重新登录后继续，已保存的数据不会丢失。",
  CONFLICT: "重新读取已保存进度后继续。",
  RAG_UNAVAILABLE: "确认简历检索服务已启动，再重新评分。",
  MODEL_TIMEOUT: "模型响应超时。资料已保留，可稍后重新评分。",
  MODEL_FAILED: "模型暂时未完成评分。资料已保留，可重新评分。",
  DATABASE_UNAVAILABLE: "确认 Docker 中 PostgreSQL 已启动，然后重试。",
  STORAGE_UNAVAILABLE: "确认 Docker 中 MinIO 已启动，然后重试。",
  DOCUMENT_PARSE_FAILED: "无法读取这份文件。请确认它是可复制文字的 PDF 或 DOCX，且未损坏或加密。",
  MAIL_UNCERTAIN: "请先到发件箱核实是否已发送，不要立即重复发送。",
  INTERNAL_UNAVAILABLE: "稍后重试；若仍失败，请在系统状态页查看受影响的服务。",
  SCORING_TIMEOUT: "后台评分超过 10 分钟已自动停止。资料已保留，可重新评分。",
};

export function looksLikeDatabaseError(error: unknown) {
  const value = error as { code?: string; message?: string } | null;
  return ["ECONNREFUSED", "ECONNRESET", "57P01", "57P02", "57P03", "08000", "08003", "08006"].includes(value?.code || "") || /database|postgres|connection terminated/i.test(value?.message || "");
}

export function looksLikeTimeout(error: unknown) {
  const value = error as { name?: string; code?: string; message?: string } | null;
  return value?.name === "AbortError" || value?.code === "ETIMEDOUT" || /timeout|timed out|aborted/i.test(value?.message || "");
}
