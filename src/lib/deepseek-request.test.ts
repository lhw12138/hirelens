import { afterEach, describe, expect, it, vi } from 'vitest';
import { withDeepSeekNonThinking } from './deepseek-request';

describe('withDeepSeekNonThinking', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('disables thinking for DeepSeek V4 requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);

    await withDeepSeekNonThinking('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ model: 'deepseek-v4-flash', messages: [] }),
    });

    const sent = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(sent.thinking).toEqual({ type: 'disabled' });
  });

  it('does not alter requests that already choose a thinking mode', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    const body = JSON.stringify({ model: 'deepseek-v4-flash', thinking: { type: 'enabled' } });

    await withDeepSeekNonThinking('https://api.deepseek.com/chat/completions', { method: 'POST', body });

    expect(fetchMock.mock.calls[0][1].body).toBe(body);
  });
});
