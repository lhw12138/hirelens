import { describe, expect, it } from 'vitest';
import { candidateCredentials } from './candidate-auth';

describe('candidate credentials', () => {
  it('allows public registration without an invitation code', () => {
    const credentials = candidateCredentials.parse({
      action: 'register',
      email: ' Candidate@Example.com ',
      password: 'Merit2026',
    });

    expect(credentials).toEqual({
      action: 'register',
      email: 'candidate@example.com',
      password: 'Merit2026',
    });
  });

  it('requires at least eight characters', () => {
    expect(candidateCredentials.safeParse({
      action: 'register',
      email: 'candidate@example.com',
      password: 'Abc123',
    }).success).toBe(false);
  });

  it('requires two of uppercase, lowercase, number, and special character', () => {
    expect(candidateCredentials.safeParse({
      action: 'register',
      email: 'candidate@example.com',
      password: 'lowercaseonly',
    }).success).toBe(false);
    expect(candidateCredentials.safeParse({
      action: 'register',
      email: 'candidate@example.com',
      password: 'lowercase!',
    }).success).toBe(true);
  });

  it('does not apply new registration complexity rules to existing account logins', () => {
    expect(candidateCredentials.safeParse({
      action: 'login',
      email: 'candidate@example.com',
      password: 'aaaaaaaaaaaa',
    }).success).toBe(true);
  });
});
