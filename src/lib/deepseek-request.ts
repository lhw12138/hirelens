export const withDeepSeekNonThinking: typeof fetch = (input, init) => {
  if (typeof init?.body !== 'string') return fetch(input, init);

  try {
    const body = JSON.parse(init.body) as Record<string, unknown>;
    if (typeof body.model === 'string' && /^deepseek-(?:v\d+-)?flash(?:$|-)/.test(body.model) && body.thinking === undefined) {
      body.thinking = { type: 'disabled' };
      return fetch(input, { ...init, body: JSON.stringify(body) });
    }
  } catch {
    // Leave non-JSON requests untouched.
  }

  return fetch(input, init);
};
