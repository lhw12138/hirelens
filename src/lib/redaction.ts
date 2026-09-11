export interface RedactionResult {
  text: string;
  findings: Array<{ type: "phone" | "email" | "id" | "address"; count: number }>;
}

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export function extractEmailAddresses(input: string): string[] {
  return [...new Set((input.match(EMAIL_PATTERN) ?? []).map((email) => email.toLowerCase()))].slice(0, 5);
}

const rules = [
  { type: "phone" as const, pattern: /(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)/g, replacement: "[手机号已脱敏]" },
  { type: "email" as const, pattern: EMAIL_PATTERN, replacement: "[邮箱已脱敏]" },
  { type: "id" as const, pattern: /(?<!\d)\d{6}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[0-9Xx](?!\d)/g, replacement: "[证件号已脱敏]" },
  { type: "address" as const, pattern: /(?:现居住?地|住址|地址)\s*[：:]\s*[^\n]{4,40}/g, replacement: "地址：[详细地址已脱敏]" },
];

export function redactPersonalData(input: string): RedactionResult {
  const findings: RedactionResult["findings"] = [];
  let text = input;

  for (const rule of rules) {
    const count = text.match(rule.pattern)?.length ?? 0;
    if (count > 0) findings.push({ type: rule.type, count });
    text = text.replace(rule.pattern, rule.replacement);
  }

  return { text, findings };
}

export function assertSafeForTracing(input: unknown): void {
  const serialized = JSON.stringify(input);
  const result = redactPersonalData(serialized);
  if (result.findings.length > 0) {
    throw new Error("Trace payload contains unredacted personal data");
  }
}
