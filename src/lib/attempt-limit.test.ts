import { describe, expect, it } from 'vitest';
import { allowAttempt } from './attempt-limit';
describe('attempt limit', () => {
  it('blocks after the configured window quota and resets later', () => {
    const key = crypto.randomUUID();
    expect(allowAttempt(key, 2, 1000)).toBe(true);
    expect(allowAttempt(key, 2, 1001)).toBe(true);
    expect(allowAttempt(key, 2, 1002)).toBe(false);
    expect(allowAttempt(key, 2, 1000 + 15 * 60 * 1000)).toBe(true);
  });
});
