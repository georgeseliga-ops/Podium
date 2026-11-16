// Server-side proxy to the Anthropic API so the API key never reaches the browser.
// Set ANTHROPIC_API_KEY in Netlify: Site configuration > Environment variables.

const ALLOWED_MODELS = new Set(['claude-haiku-4-5-20251001']);
const MAX_TOKENS_CAP = 2000;

export default async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ type: 'error', error: { message: 'Method not allowed' } }, { status: 405 });
  }

  const key = (globalThis.Netlify?.env?.get('ANTHROPIC_API_KEY')) || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return Response.json(
      { type: 'error', error: { message: 'Server is missing ANTHROPIC_API_KEY. Add it in Netlify environment variables and redeploy.' } },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ type: 'error', error: { message: 'Invalid request body' } }, { status: 400 });
  }

  // Only forward what the app needs, so the endpoint can't be used for other models or huge requests.
  const model = ALLOWED_MODELS.has(body.model) ? body.model : 'claude-haiku-4-5-20251001';
  const payload = {
    model,
    max_tokens: Math.min(Number(body.max_tokens) || 1000, MAX_TOKENS_CAP),
    messages: Array.isArray(body.messages) ? body.messages : [],
  };
  if (!payload.messages.length) {
    return Response.json({ type: 'error', error: { message: 'No messages' } }, { status: 400 });
  }

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(payload),
  });

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { 'content-type': 'application/json' },
  });
};

export const config = { path: '/api/claude' };
