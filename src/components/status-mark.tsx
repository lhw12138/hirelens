import { AlertCircle, CheckCircle2, CircleDashed, SearchCheck } from "lucide-react";
import type { EvidenceStatus } from "@/lib/types";

const labels = {
  grounded: "充分证据",
  review: "证据待核实",
  missing: "证据不足",
  conflict: "存在冲突",
};

export function StatusMark({ status, compact = false }: { status: EvidenceStatus; compact?: boolean }) {
  const Icon = status === "grounded" ? CheckCircle2 : status === "conflict" ? AlertCircle : status === "review" ? SearchCheck : CircleDashed;
  return <span className={`status-mark ${status}`}><Icon size={14} />{compact ? null : labels[status]}</span>;
}
