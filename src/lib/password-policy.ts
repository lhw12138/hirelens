export const ACCOUNT_PASSWORD_MIN_LENGTH = 8;

export function accountPasswordError(password: string) {
  if (password.length < ACCOUNT_PASSWORD_MIN_LENGTH) return '密码至少 8 位。';
  const categoryCount = [
    /\p{Lu}/u,
    /\p{Ll}/u,
    /\p{N}/u,
    /[^\p{L}\p{N}\s]/u,
  ].filter(pattern => pattern.test(password)).length;
  return categoryCount >= 2 ? null : '请在大写字母、小写字母、数字和特殊字符中至少使用两类。';
}
