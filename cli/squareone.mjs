#!/usr/bin/env node
import process from 'node:process';
import { parseArgs } from 'node:util';
import { mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const expenseFields = ['title', 'type', 'amount', 'date', 'note'];
const paginated = ['limit', 'offset'];
const commands = {
  'friends.list': { options: paginated },
  'friends.add': { required: ['name'], optional: ['avatar'], write: true },
  'friends.edit': { required: ['id'], optional: ['name', 'avatar'], change: true, write: true },
  'friends.delete': { required: ['id'], write: true, approval: true },
  'transactions.list': { options: paginated },
  'transactions.add': {
    required: ['title', 'type', 'amount', 'date', 'friend-id', 'payer'], optional: ['note'], write: true,
  },
  'transactions.edit': { required: ['id'], optional: expenseFields, change: true, write: true, clearNote: true },
  'transactions.move': { required: ['id', 'friend-id', 'payer'], write: true },
  'transactions.delete': { required: ['id'], write: true },
  'transactions.notes': { required: ['id'] },
  'balances.list': {},
  'settlements.list': { options: paginated },
  'settlements.add': { required: ['friend-id', 'amount', 'date'], optional: ['note'], write: true },
  'categories.list': {},
  'categories.add': { required: ['name'], write: true },
  'categories.delete': { required: ['id'], write: true },
  'profile.show': {},
  'profile.edit': { optional: ['name', 'avatar'], change: true, write: true },
  'data.export': { options: ['format'], write: true, approval: true },
  'data.clear': { write: true, approval: true },
  'connection.info': {},
};

const help = `Usage: node cli/squareone.mjs <resource> <command> [options]

  connect --url APP_URL --name NAME       Connect through a browser approval link
  whoami                                 Show the approved account and scopes
  friends list|add|edit|delete            Use --id, --name, --avatar as applicable
  transactions list|add|edit|move|delete|notes
    add  --friend-id UUID --payer me|friend --title TITLE --type CATEGORY --amount AMOUNT --date YYYY-MM-DD [--note TEXT]
    edit --id UUID [--title TITLE] [--type CATEGORY] [--amount AMOUNT] [--date YYYY-MM-DD] [--note TEXT | --clear-note]
    move --id UUID --friend-id UUID --payer me|friend
    delete|notes --id UUID
  balances list
  settlements list|add
    add --friend-id UUID --amount AMOUNT --date YYYY-MM-DD [--note TEXT]
  categories list|add|delete              Use --name for add, --id for delete
  profile show|edit                       Edit --name, --avatar, or both
  data export [--format json|csv]          Confirm in the browser, then repeat the command
  data clear                              Confirm in the browser, then repeat the command

Every write takes --request-id UUID. Reuse it with the same fields for retries
and after approving an action. Friends, expenses, and settlements support --limit
and --offset. Set SQUAREONE_CONFIG_DIR to isolate multiple agent connections.
For manual tokens, inject SQUAREONE_AGENT_TOKEN and set SQUAREONE_URL to Supabase.
`;

function validatedOrigin(input) {
  const url = new URL(input);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) ||
    url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Use an HTTPS URL or an HTTP loopback URL with no path.');
  }
  return url.origin;
}

async function discoverApi(appUrl) {
  const response = await fetch(appUrl, { redirect: 'error', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Could not open the SquareOne app URL.');
  const html = await response.text();
  const discovered = /<meta name="squareone-api" content="([^"]+)"\s*\/?\s*>/.exec(html)?.[1];
  if (!discovered) throw new Error('This SquareOne app does not advertise an agent API.');
  return validatedOrigin(discovered);
}

async function request(url, operation, payload, credential) {
  let response;
  try {
    response = await fetch(new URL('/functions/v1/agent-transactions', url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(credential && { Authorization: `Bearer ${credential}` }) },
      body: JSON.stringify({ operation, payload }),
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error('Could not reach SquareOne. Retry writes with the same request ID and fields.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.error ?? `SquareOne returned HTTP ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  if (!data || typeof data !== 'object') throw new Error('SquareOne returned an invalid response.');
  return data;
}

function parse(flags, strings, booleans = []) {
  const { values, tokens } = parseArgs({
    args: flags, tokens: true,
    options: Object.fromEntries([
      ...strings.map((name) => [name, { type: 'string' }]),
      ...booleans.map((name) => [name, { type: 'boolean' }]),
    ]),
  });
  if (new Set(tokens.map((token) => token.name)).size !== tokens.length) throw new Error('Use each option only once.');
  return values;
}

const configDir = process.env.SQUAREONE_CONFIG_DIR ?? join(homedir(), '.config', 'squareone');
const sessionPath = join(configDir, 'connection.json');

async function saveSession(session) {
  await mkdir(configDir, { recursive: true, mode: 0o700 });
  const temp = join(configDir, `connection-${randomUUID()}.tmp`);
  try {
    await writeFile(temp, JSON.stringify(session), { mode: 0o600, flag: 'wx' });
    await rename(temp, sessionPath);
  } finally {
    await rm(temp, { force: true });
  }
}

async function loadSession() {
  try {
    const session = JSON.parse(await readFile(sessionPath, 'utf8'));
    return { ...session, api: validatedOrigin(session.api), app: validatedOrigin(session.app) };
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error('Run connect to authorize this agent.');
    throw error;
  }
}

async function refreshSession(previous) {
  const lockPath = join(configDir, 'connection.lock');
  let lock;
  for (let attempts = 0; attempts < 100 && !lock; attempts += 1) {
    try {
      lock = await open(lockPath, 'wx', 0o600);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const info = await stat(lockPath).catch(() => null);
      if (info && Date.now() - info.mtimeMs > 45000) await rm(lockPath, { force: true });
      await delay(275);
    }
  }
  if (!lock) throw new Error('Another SquareOne command is refreshing the connection. Try again shortly.');
  try {
    const current = await loadSession();
    if (current.connection_id !== previous.connection_id) throw new Error('The active SquareOne connection changed. Retry the command.');
    if (current.access_token !== previous.access_token) return current;
    const update = await request(current.api, 'connect.refresh', {}, current.refresh_token);
    const refreshed = { ...current, ...update };
    await saveSession(refreshed);
    return refreshed;
  } finally {
    await lock.close();
    await rm(lockPath, { force: true });
  }
}

async function connect(flags) {
  const values = parse(flags, ['url', 'name']);
  if (!values.url || !values.name?.trim()) throw new Error('Use connect --url APP_URL --name NAME.');
  const app = validatedOrigin(values.url);
  const api = await discoverApi(app);
  const start = await request(api, 'connect.start', { label: values.name });
  const link = `${app}/#/connect-agent?code=${encodeURIComponent(start.user_code)}`;
  process.stderr.write(`Open ${link}\nConfirm that the browser shows code ${start.user_code}. Waiting for approval…\n`);
  const deadline = Date.now() + start.expires_in * 1000;
  let interval = start.interval;
  while (Date.now() < deadline) {
    await delay(interval * 1000);
    const session = await request(api, 'connect.poll', {}, start.device_code);
    if (session.status === 'connected') {
      await saveSession({ api, app, ...session });
      return { status: 'connected', account_id: session.account_id, account_name: session.account_name, label: session.label, scopes: session.scopes };
    }
    interval = session.interval;
  }
  throw new Error('The browser approval expired. Run connect again.');
}

function historyCsv(items) {
  const rows = [['Date', 'Title', 'Type', 'Amount', 'Payer', 'Friend', 'Note', 'Settlement'], ...items.map((item) => [
    item.date, item.title, item.type, Number(item.amount).toFixed(2), item.payer, item.friend, item.note,
    item.is_settlement ? 'Yes' : 'No',
  ])];
  return rows.map((row) => row.map((value) => {
    const text = String(value ?? '');
    const safeText = /^[\s]*[=+@-]/.test(text) ? "'" + text : text;
    return `"${safeText.replaceAll('"', '""')}"`;
  }).join(',')).join('\n') + '\n';
}

async function main(args, env) {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    process.stdout.write(help);
    return;
  }
  if (args[0] === 'connect') {
    process.stdout.write(`${JSON.stringify(await connect(args.slice(1)))}\n`);
    return;
  }
  const [resource, action, ...flags] = args;
  const operation = resource === 'whoami' && !action ? 'connection.info' : `${resource}.${action}`;
  if (!Object.hasOwn(commands, operation)) throw new Error('Unknown command. Run with --help.');
  const command = commands[operation];
  const required = [...(command.required ?? []), ...(command.write ? ['request-id'] : [])];
  const values = parse(flags, [...required, ...(command.optional ?? []), ...(command.options ?? [])],
    command.clearNote ? ['clear-note'] : []);
  for (const option of required) {
    if (!values[option]?.trim()) throw new Error(`Missing --${option}.`);
  }
  if (values['clear-note'] && values.note !== undefined) throw new Error('Choose --note or --clear-note.');
  if (command.change && !command.optional.some((field) => values[field] !== undefined) && !values['clear-note']) {
    throw new Error('Provide at least one field to edit.');
  }
  if (values.format && !['json', 'csv'].includes(values.format)) throw new Error('Use --format json or csv.');
  const payload = Object.fromEntries(Object.entries(values).filter(([name]) => !['clear-note', 'format'].includes(name))
    .map(([name, value]) => [name.replaceAll('-', '_'), value]));
  if (values['clear-note']) payload.note = null;

  let output;
  let app;
  if (env.SQUAREONE_AGENT_TOKEN) {
    if (!/^sqo_[a-f0-9]{64}$/.test(env.SQUAREONE_AGENT_TOKEN) || !env.SQUAREONE_URL) {
      throw new Error('Set the manual token and Supabase project URL in the environment.');
    }
    app = env.SQUAREONE_APP_URL && validatedOrigin(env.SQUAREONE_APP_URL);
    if (command.approval && !app) throw new Error('Set SQUAREONE_APP_URL to open the approval link for this command.');
    output = await request(validatedOrigin(env.SQUAREONE_URL), operation, payload, env.SQUAREONE_AGENT_TOKEN);
  } else {
    let session = await loadSession();
    if (env.SQUAREONE_URL && validatedOrigin(env.SQUAREONE_URL) !== session.api) {
      throw new Error('The active connection is for a different Supabase project. Reconnect to the intended SquareOne app.');
    }
    if (Date.parse(session.expires_at) <= Date.now() + 15000) session = await refreshSession(session);
    app = session.app;
    try {
      output = await request(session.api, operation, payload, session.access_token);
    } catch (error) {
      if (error.status !== 401) throw error;
      session = await refreshSession(session);
      output = await request(session.api, operation, payload, session.access_token);
    }
  }
  if (output.status === 'approval_required') {
    const { user_code: code, ...details } = output;
    output = { ...details, approval_url: `${app}/#/connect-agent?action=${encodeURIComponent(code)}` };
  }
  if (operation === 'data.export' && values.format === 'csv' && Array.isArray(output.items)) {
    process.stdout.write(historyCsv(output.items));
    return;
  }
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

main(process.argv.slice(2), process.env).catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: error.message })}\n`);
  process.exitCode = 1;
});
