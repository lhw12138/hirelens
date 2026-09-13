import {beforeEach, describe, expect, it} from 'vitest';
import {createHrSession, verifyHrSession} from './session';

describe('HR session identity', () => {
  beforeEach(() => { process.env.AUTH_SECRET = 'test-secret-with-at-least-thirty-two-characters'; });
  it('round-trips the specific HR account identity', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    await expect(verifyHrSession(await createHrSession(id, 'one@example.com'))).resolves.toEqual({id, email: 'one@example.com'});
  });
  it('keeps different HR accounts distinct', async () => {
    const first = await verifyHrSession(await createHrSession('11111111-1111-4111-8111-111111111111', 'one@example.com'));
    const second = await verifyHrSession(await createHrSession('22222222-2222-4222-8222-222222222222', 'two@example.com'));
    expect(first?.email).not.toBe(second?.email);
  });
});
