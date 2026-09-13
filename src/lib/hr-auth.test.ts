import {describe, expect, it} from 'vitest';
import {hrCredentials} from './hr-auth';

describe('HR account credentials', () => {
  it('normalizes the account email', () => {
    expect(hrCredentials.parse({action: 'register', email: ' HR@Example.COM ', password: 'Abcd1234'}).email).toBe('hr@example.com');
  });
  it('uses the shared eight-character, two-category password policy', () => {
    expect(hrCredentials.safeParse({action: 'register', email: 'hr@example.com', password: 'abcdefgh'}).success).toBe(false);
    expect(hrCredentials.safeParse({action: 'register', email: 'hr@example.com', password: 'abcd1234'}).success).toBe(true);
  });
  it('does not apply the registration policy while logging in', () => {
    expect(hrCredentials.safeParse({action: 'login', email: 'hr@example.com', password: 'legacy'}).success).toBe(true);
  });
});
