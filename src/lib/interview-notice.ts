import { z } from "zod";

const singleLine = z.string().trim().min(1).max(1000).refine((value) => !/[\r\n]/.test(value), "请填写单行内容");
export const noticeInputSchema = z.object({
  email: z.email().max(254),
  salutation: singleLine.max(60),
  startsAt: z.iso.datetime({ offset: true }),
  durationMinutes: z.number().int().min(15).max(240),
  location: singleLine,
  note: z.string().trim().max(2000),
});
export type NoticeInput = z.infer<typeof noticeInputSchema>;
export type NoticeStatus = "draft" | "sending" | "accepted" | "unknown";
export type NoticeRecord = { id: string; candidateId: string; email: string; payload: Omit<NoticeInput, "email"> & { subject: string; text: string }; status: NoticeStatus; createdAt: string; updatedAt: string };

export function validateNotice(input: unknown, now = Date.now()) {
  const value = noticeInputSchema.parse(input);
  const starts = Date.parse(value.startsAt);
  if (starts <= now || starts > now + 366 * 86_400_000) throw new Error("请选择未来一年内的面试时间。");
  return value;
}

export function noticeContent(input: NoticeInput, title: string) {
  const cleanTitle = title.replace(/[\r\n]/g, " ").slice(0, 100);
  const subject = `面试通知｜${cleanTitle}`;
  const time = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(input.startsAt));
  const text = `${input.salutation}，您好：\n\n邀请您参加「${cleanTitle}」岗位面试。\n时间：${time}（北京时间 UTC+8）\n预计时长：${input.durationMinutes} 分钟\n会议链接或面试地址：${input.location}\n${input.note ? `\n补充说明：\n${input.note}\n` : ""}\n请回复此邮件确认是否方便参加。如需调整时间，请联系发件人。\n\n期待与您交流。`;
  return { subject, text };
}

const escapeIcs = (value: string) => value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
const stamp = (value: number) => new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
export function calendarEvent(id: string, email: string, payload: NoticeRecord["payload"], from: string) {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//HireLens//Interview Notice//ZH", "METHOD:REQUEST", "BEGIN:VEVENT", `UID:${id}@hirelens.local`, "SEQUENCE:0", `DTSTAMP:${stamp(Date.now())}`, `DTSTART:${stamp(Date.parse(payload.startsAt))}`, `DTEND:${stamp(Date.parse(payload.startsAt) + payload.durationMinutes * 60_000)}`, `SUMMARY:${escapeIcs(payload.subject)}`, `LOCATION:${escapeIcs(payload.location)}`, `DESCRIPTION:${escapeIcs(payload.text)}`, `ORGANIZER:mailto:${from}`, `ATTENDEE;RSVP=TRUE:mailto:${email}`, "STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR"].join("\r\n") + "\r\n";
}

export const noticeStatusLabel: Record<NoticeStatus, string> = {
  draft: "预览草稿 · 尚未发送",
  sending: "正在提交邮件 · 请勿重复发送",
  accepted: "邮件服务器已接受 · 不代表已送达或已读",
  unknown: "发送结果待核实 · 请检查发件邮箱，勿直接重发",
};
