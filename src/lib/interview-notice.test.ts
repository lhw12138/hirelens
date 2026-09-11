import { describe, expect, it } from "vitest";
import { calendarEvent, noticeContent, validateNotice } from "./interview-notice";
import { open, seal } from "./secret-box";
const future = new Date("2029-12-01T02:00:00.000Z").toISOString();
describe("interview email notice", () => {
  it("builds a Chinese preview without exposing unrelated data", () => { const details = validateNotice({ email: "candidate@example.com", salutation: "候选人", startsAt: future, durationMinutes: 45, location: "https://meeting.example/123", note: "请提前进入" }, Date.parse("2029-01-01")); const content = noticeContent(details, "AI 产品经理\nInjected"); expect(content.subject).not.toContain("\n"); expect(content.text).toContain("北京时间"); expect(content.text).toContain("45 分钟"); });
  it("rejects past and invalid input", () => { expect(() => validateNotice({ email: "bad", salutation: "a", startsAt: future, durationMinutes: 1, location: "x", note: "" }, Date.parse("2029-01-01"))).toThrow(); expect(() => validateNotice({ email: "a@b.com", salutation: "a", startsAt: "2020-01-01T00:00:00.000Z", durationMinutes: 30, location: "x", note: "" })).toThrow(); });
  it("creates a UTC calendar invitation", () => { const payload = { salutation: "候选人", startsAt: future, durationMinutes: 30, location: "腾讯会议", note: "", subject: "面试通知", text: "正文" }; const ics = calendarEvent("id", "candidate@example.com", payload, "hr@example.com"); expect(ics).toContain("METHOD:REQUEST"); expect(ics).toContain("DTSTART:20291201T020000Z"); expect(ics).toContain("ATTENDEE;RSVP=TRUE:mailto:candidate@example.com"); });
  it("encrypts credentials and recipient addresses", () => { const ciphertext = seal("secret@example.com"); expect(ciphertext).not.toContain("secret@example.com"); expect(open(ciphertext)).toBe("secret@example.com"); expect(() => open(ciphertext.slice(0, -2) + "aa")).toThrow(); });
});
