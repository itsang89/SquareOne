const tokenPattern = /^Bearer (sq[odr]_[a-f0-9]{64})$/;
// Friend/profile basics stay in run_agent_management; everything else (money model) is run_agent_money.
const managementCommands = new Set(['connection.info', 'friends.add', 'friends.edit', 'profile.show', 'profile.edit']);
const connectionCommands = new Set(['connect.start', 'connect.poll', 'connect.refresh']);
const expectedErrors = new Set(['PT400', 'PT401', 'PT403', 'PT404', 'PT409', 'PT429']);
const maxBodyBytes = 16384;

function json(body, status = 200, headers = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

async function readJson(body) {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const reader = body.getReader();
  let bytes = 0;
  let text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return JSON.parse(text + decoder.decode());
      bytes += value.byteLength;
      if (bytes > maxBodyBytes) throw new RangeError('Request too large');
      text += decoder.decode(value, { stream: true });
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}

export async function handleRequest(request) {
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405, { Allow: 'POST' });
  let body;
  try {
    body = await readJson(request.body);
  } catch (error) {
    if (error instanceof RangeError) return json({ error: 'Request is too large.' }, 413);
    return json({ error: 'Expected a JSON command.' }, 400);
  }
  if (!body || typeof body.operation !== 'string' || !body.payload ||
    typeof body.payload !== 'object' || Array.isArray(body.payload)) {
    return json({ error: 'Expected an operation and payload.' }, 400);
  }

  const { operation, payload } = body;
  const token = tokenPattern.exec(request.headers.get('Authorization') ?? '')?.[1];
  const prefix = operation === 'connect.poll' ? 'sqd_' : operation === 'connect.refresh' ? 'sqr_' : 'sqo_';
  if (operation !== 'connect.start' && !token?.startsWith(prefix)) {
    return json({ error: 'A valid agent credential is required.' }, 401);
  }

  try {
    const serverUrl = Deno.env.get('SUPABASE_URL');
    const legacyKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const key = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default || legacyKey;
    if (!serverUrl || !key) throw new Error('Missing Supabase server configuration');

    const headers = { apikey: key, 'Content-Type': 'application/json' };
    if (key === legacyKey) headers.Authorization = `Bearer ${key}`;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token ?? ''));
    const tokenHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    const rpc = connectionCommands.has(operation) ? 'run_agent_connection' :
      managementCommands.has(operation) ? 'run_agent_management' : 'run_agent_money';
    const response = await fetch(`${serverUrl}/rest/v1/rpc/${rpc}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_hash: tokenHash, p_operation: operation, p_payload: payload }),
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    if (response.ok) return json(data);
    if (expectedErrors.has(data.code)) return json({ error: data.message }, Number(data.code.slice(2)));
  } catch {
    // Avoid exposing backend or request details in errors.
  }
  return json({ error: 'SquareOne could not complete the command.' }, 502);
}

Deno.serve(handleRequest);
