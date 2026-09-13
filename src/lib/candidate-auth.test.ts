import { describe, expect, it } from 'vitest';
import { candidateCredentials } from './candidate-auth';

describe('candidate credentials', () => {
  it('allows public registration without an invitation code', () => {
    const credentials = candidateCredentials.parse({
      action: 'register',
      email: ' Candidate@Example.com ',
      password: 'strong-password',
    });

    expect(credentials).toEqual({
      action: 'register',
      email: 'candidate@example.com',
      password: 'strong-password',
    });
  });

  it('keeps the minimum password length requirement', () => {
    expect(candidateCredentials.safeParse({
      action: 'register',
      email: 'candidate@example.com',
      password: 'too-short',
    }).success).toBe(false);
  });
});
