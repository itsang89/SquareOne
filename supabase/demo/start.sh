#!/usr/bin/env bash
set -euo pipefail
umask 077

repo=$(cd "$(dirname "$0")/../.." && pwd)
for tool in supabase docker node; do command -v "$tool" >/dev/null; done
docker info --format '{{.ServerVersion}}' >/dev/null
workdir=$(mktemp -d "${TMPDIR:-/tmp}/squareone-supabase.XXXXXX")
export DO_NOT_TRACK=1 SUPABASE_TELEMETRY_DISABLED=1

cleanup_failed_start() {
  if [ "$?" -ne 0 ]; then
    supabase stop --workdir "$workdir" --no-backup >/dev/null 2>&1 || true
    rm -f -- "$workdir/status.json" "$workdir/demo.env"
  fi
}
trap cleanup_failed_start EXIT

mkdir -p "$workdir/supabase/migrations" "$workdir/supabase/functions/agent-transactions"
suffix=$(printf '%s' "${workdir##*.}" | tr '[:upper:]' '[:lower:]')
sed "s/squareone-agent-demo/squareone-agent-demo-$suffix/" "$repo/supabase/config.toml" > "$workdir/supabase/config.toml"
cp "$repo/supabase/functions/agent-transactions/index.js" "$workdir/supabase/functions/agent-transactions/"
cp "$repo/supabase/migrations/"*.sql "$workdir/supabase/migrations/"
cp "$repo/supabase/demo/base.sql" "$workdir/supabase/migrations/20250325110000_demo_base.sql"
cat > "$workdir/supabase/seed.sql" <<'SQL'
grant select, insert, update, delete on public.custom_types to authenticated;
alter publication supabase_realtime add table public.custom_types;
SQL

printf 'Starting isolated Supabase in %s\n' "$workdir"
if ! supabase start --workdir "$workdir" > "$workdir/start.log" 2>&1; then
  printf 'Supabase failed to start. See %s/start.log\n' "$workdir" >&2
  exit 1
fi
rm -f -- "$workdir/start.log"

supabase status --workdir "$workdir" -o json > "$workdir/status.json"
node --input-type=module - "$workdir" <<'JS'
import { randomBytes } from 'node:crypto';
import { readFile, unlink, writeFile } from 'node:fs/promises';

const [workdir] = process.argv.slice(2);
const statusFile = `${workdir}/status.json`;
const config = JSON.parse(await readFile(statusFile, 'utf8'));
await unlink(statusFile);
const base = new URL(config.API_URL);
if (base.protocol !== 'http:' || base.hostname !== '127.0.0.1' || base.port !== '54321') {
  throw new Error('Expected the default local Supabase URL.');
}
const publicKey = config.PUBLISHABLE_KEY || config.ANON_KEY;
const key = config.SERVICE_ROLE_KEY || config.SECRET_KEY;
if (!key || !publicKey) throw new Error('Missing local Supabase credentials.');
const headers = { apikey: key, 'Content-Type': 'application/json' };
if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;

async function post(path, payload) {
  const response = await fetch(new URL(path, base), {
    method: 'POST', headers, body: JSON.stringify(payload), redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Local demo setup failed at ${path} (HTTP ${response.status}).`);
  return response.status === 204 || response.headers.get('content-length') === '0' ? null :
    JSON.parse(await response.text() || 'null');
}

const email = 'squareone-demo@example.test';
const password = randomBytes(24).toString('hex');
const account = await post('/auth/v1/admin/users', {
  email, password, email_confirm: true, user_metadata: { name: 'SquareOne Demo' },
});
await post('/rest/v1/profiles', { id: account.id, name: 'SquareOne Demo' });
await post('/rest/v1/friends', { user_id: account.id, name: 'Alex Demo' });
await writeFile(`${workdir}/demo.env`, [
  `VITE_SUPABASE_URL=${base.origin}`, `VITE_SUPABASE_ANON_KEY=${publicKey}`,
  `SQUAREONE_URL=${base.origin}`, `SQUAREONE_DEMO_EMAIL=${email}`, `SQUAREONE_DEMO_PASSWORD=${password}`, '',
].join('\n'), { mode: 0o600 });
console.log(`Demo account created (${email}). Credentials: ${workdir}/demo.env`);
JS

printf 'Start the app: (set -a; source %q; set +a; npm run dev -- --host 127.0.0.1 --port 3010 --strictPort)\n' "$workdir/demo.env"
printf 'Delete the demo: supabase stop --workdir %q --no-backup && rm -rf -- %q\n' "$workdir" "$workdir"
