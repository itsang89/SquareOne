#!/usr/bin/env node
import process from 'node:process';
import { parseArgs } from 'node:util';
import { mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const paginated = ['limit', 'offset'];
// strings: --name VALUE | multi: repeatable | bools: presence flags | required: must be set | write: needs a request ID
const commands = {
  'friends.list': { strings: paginated },
  'friends.add': { required: ['name'], strings: ['avatar'], write: true },
  'friends.edit': { required: ['id'], strings: ['name', 'avatar'], change: true, write: true },
  'friends.delete': { required: ['id'], write: true, approval: true },
  'accounts.list': { bools: ['all'] },
  'accounts.add': { required: ['name'], strings: ['currency'], write: true },
  'accounts.edit': { required: ['id'], strings: ['name', 'currency', 'sort'], change: true, write: true },
  'accounts.archive': { required: ['id'], bools: ['unarchive'], write: true },
  'accounts.reconcile': { required: ['id', 'balance'], bools: ['dry-run'], write: true },
  'accounts.delete': { required: ['id'], write: true, approval: true },
  'categories.list': { strings: ['kind'], bools: ['all'] },
  'categories.add': { required: ['name'], strings: ['kind', 'icon', 'color'], write: true },
  'categories.edit': { required: ['id'], strings: ['name', 'icon', 'color'], bools: ['archive', 'unarchive'], change: true, write: true },
  'entries.list': { strings: ['from', 'to', 'kind', 'category', 'account', 'friend', 'search', 'tz', ...paginated] },
  'entries.add': {
    required: ['amount'], write: true, dryRun: true,
    strings: ['kind', 'title', 'note', 'date', 'account', 'to-account', 'category', 'friend', 'currency', 'fx-rate', 'split-equal'],
    multi: ['split'], bools: ['create-category', 'dry-run'],
  },
  'entries.edit': {
    required: ['id'], write: true, dryRun: true, change: true, clearNote: true,
    strings: ['amount', 'title', 'note', 'date', 'account', 'to-account', 'category', 'friend', 'currency', 'fx-rate', 'split-equal'],
    multi: ['split'], bools: ['no-split', 'create-category', 'dry-run'],
  },
  'entries.delete': { required: ['id'], write: true },
  'entries.undo': { required: ['delete-request-id'], write: true },
  'subscriptions.list': { bools: ['all'] },
  'subscriptions.add': {
    required: ['title', 'amount', 'cadence', 'next-date'], strings: ['kind', 'category', 'account', 'currency', 'fx-rate'], write: true,
  },
  'subscriptions.edit': {
    required: ['id'], strings: ['kind', 'title', 'amount', 'cadence', 'next-date', 'category', 'account', 'currency', 'fx-rate'],
    change: true, write: true,
  },
  'subscriptions.pause': { required: ['id'], bools: ['resume'], write: true },
  'stats.get': { strings: ['month', 'from', 'to', 'tz'] },
  'balances.get': {},
  'profile.show': {},
  'profile.edit': { strings: ['name', 'avatar'], change: true, write: true },
  'data.export': { strings: ['format'], write: true, approval: true },
  'data.clear': { write: true, approval: true },
  'connection.info': {},
};
// `stats` and `balances` take no sub-command.
const bare = { stats: 'stats.get', balances: 'balances.get', whoami: 'connection.info' };

const help = `Usage: node cli/squareone.mjs <resource> <command> [options]   (all output is JSON)

  connect --url APP_URL --name NAME   Connect through a browser approval link (do this once)
  whoami                              Show the account and permissions

LOG MONEY (kinds: expense | income | transfer | settlement; default expense)
  entries add --amount N [--title T] [--category C] [--account A] [--date YYYY-MM-DD] [--note TEXT]
              [--split FRIEND:AMOUNT ...] [--split-equal FRIEND,FRIEND] [--dry-run]
              [--kind income|transfer|settlement] [--to-account B] [--friend F]
              [--currency USD --fx-rate 7.8] [--create-category]
  entries edit --id UUID [same fields] [--clear-note] [--no-split]
  entries delete --id UUID
  entries undo --delete-request-id UUID      Restore a CLI deletion within 10 minutes, using its request_id
  entries list [--from D] [--to D] [--kind K] [--category C] [--account A] [--friend F] [--search TEXT]
               [--limit 20] [--offset N] [--tz Asia/Hong_Kong]   newest first; dates are inclusive, Hong Kong time unless --tz

  Names or UUIDs work for --account, --category, --friend (case-insensitive, unique partial match ok).
  Date defaults to now. Account defaults to your only account; otherwise name it ("--account none" = no account).
  Amounts are plain numbers with up to 2 decimals (no $ or commas). The amount is the FULL total.
  --split Alex:500 --split Ben:300      exact friend shares; my share = total - shares
  --split-equal Alex,Ben                total divided equally among me + Alex + Ben
  Always --dry-run first if a name or split is ambiguous: prints the resolved entry, writes nothing.

REPORTS
  stats --month 2026-11 | --from D --to D [--tz ZONE]   My spending/income (my share only) + by category, in HKD
  balances                                  Account balances, net worth, what friends owe me
  accounts list [--all]    categories list [--kind expense|income] [--all]    subscriptions list [--all]
  friends list              Friends with balances (positive = owes me)

MANAGE
  accounts add --name N [--currency HKD] | edit --id A [--name N] [--currency C] | archive --id A [--unarchive]
  accounts reconcile --id A --balance N [--dry-run]   Set the actual balance in the account currency via an Untracked entry
                                                      Use --balance=-100 for a negative balance
  accounts delete --id A                    Needs browser approval; only for accounts with no entries
  categories add --name N [--kind expense|income] [--icon E] [--color #hex] | edit --id C [--name] [--icon] [--color] [--archive|--unarchive]
  subscriptions add --title T --amount N --cadence weekly|monthly|yearly --next-date D [--kind expense|income] [--category C] [--account A]
                                            --next-date = date of the next charge (today if the user gave none)
  subscriptions edit --id S [fields] | pause --id S [--resume]
  friends add --name N | edit --id F [--name N] | delete --id F (needs browser approval)
  profile show|edit [--name N] [--avatar URL]   --avatar only accepts the app's preset avatar URLs (friends too)
  data export [--format json|csv]           Needs browser approval, then repeat the same command
  data clear                                Needs browser approval, then repeat the same command

EXAMPLES (plain English -> command)
  "Dinner $1200 on Bank, Alex 500 Ben 300"
    entries add --amount 1200 --title Dinner --category Food --account Bank --split Alex:500 --split Ben:300
  "Lunch 180, split with Alex"
    entries add --amount 180 --title Lunch --category Food --split-equal Alex
  "Salary 30000 into Bank"
    entries add --kind income --amount 30000 --title Salary --category Salary --account Bank
  "Moved 2000 from Bank to Octopus"
    entries add --kind transfer --amount 2000 --account Bank --to-account Octopus
  "Alex paid me back 500 to Bank"
    entries add --kind settlement --amount 500 --friend Alex --account Bank
  "How much did I spend in November?"       stats --month 2026-11
  "How much did I spend on food this month?"  stats --month 2026-11, read by_category (my share only)
  "Netflix 78 every month from Bank"
    subscriptions add --title Netflix --amount 78 --cadence monthly --next-date 2026-12-01 --account Bank --category Entertainment
  "What does Alex owe me?"                  friends list

Writes take --request-id UUID (one is generated and echoed back if you omit it). Retry a failed write with the
SAME request-id and fields; it never double-posts. Approval commands print approval_url: ask the owner to
open it, then repeat the identical command. Set SQUAREONE_CONFIG_DIR to isolate multiple agent connections.
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

function parse(flags, strings, booleans = [], multi = []) {
  const { values, tokens } = parseArgs({
    args: flags, tokens: true,
    options: Object.fromEntries([
      ...strings.map((name) => [name, { type: 'string' }]),
      ...booleans.map((name) => [name, { type: 'boolean' }]),
      ...multi.map((name) => [name, { type: 'string', multiple: true }]),
    ]),
  });
  const once = tokens.filter((token) => token.kind === 'option' && !multi.includes(token.name)).map((token) => token.name);
  if (new Set(once).size !== once.length) throw new Error('Use each option only once.');
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
  const rows = [['Date', 'Kind', 'Title', 'Amount', 'Currency', 'FX rate', 'Account', 'To account', 'Category', 'Friend',
    'My share', 'Friend shares', 'Note'], ...items.map((item) => [
    item.date, item.kind, item.title, Number(item.amount).toFixed(2), item.currency, item.fx_rate, item.account?.name,
    item.to_account?.name, item.category?.name, item.friend?.name, item.my_share,
    item.shares.map((share) => `${share.friend} ${share.amount}`).join('; '), item.note,
  ])];
  return rows.map((row) => row.map((value) => {
    const text = String(value ?? '');
    const safeText = /^[=+\-@\t\r]/.test(text) ? "'" + text : text; // spreadsheet formula guard (same rule as utils/csv.ts)
    return `"${safeText.replaceAll('"', '""')}"`;
  }).join(',')).join('\n') + '\n';
}

let activeRequestId;

async function main(args, env) {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    process.stdout.write(help);
    return;
  }
  if (args[0] === 'connect') {
    process.stdout.write(`${JSON.stringify(await connect(args.slice(1)))}\n`);
    return;
  }
  const [resource, ...rest] = args;
  const operation = bare[resource] ?? `${resource}.${rest[0]}`;
  const flags = bare[resource] ? rest : rest.slice(1);
  if (!Object.hasOwn(commands, operation)) throw new Error('Unknown command. Run with --help.');
  const command = commands[operation];
  const strings = [...(command.required ?? []), ...(command.strings ?? [])];
  const booleans = [...(command.bools ?? []), ...(command.clearNote ? ['clear-note'] : [])];
  const values = parse(flags, [...strings, ...(command.write ? ['request-id'] : [])], booleans, command.multi);
  for (const option of command.required ?? []) {
    if (!values[option]?.trim()) throw new Error(`Missing --${option}.`);
  }
  if (values['clear-note'] && values.note !== undefined) throw new Error('Choose --note or --clear-note.');
  if (command.change && ![...strings, ...(command.multi ?? []), ...booleans].some((field) =>
    !['id', 'dry-run', 'create-category'].includes(field) && values[field] !== undefined)) {
    throw new Error('Provide at least one field to change.');
  }
  if (values.format && !['json', 'csv'].includes(values.format)) throw new Error('Use --format json or csv.');
  // Catch bad dates here with a clear message instead of a vague server error.
  for (const name of ['date', 'from', 'to', 'next-date']) {
    const v = values[name];
    if (v === undefined) continue;
    const m = /^(\d{4})-(\d{2})-(\d{2})(T.*)?$/.exec(v.trim());
    const d = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (!m || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) {
      throw new Error(`--${name} "${v}" is not a real date. Use YYYY-MM-DD, e.g. --${name} 2026-11-21.`);
    }
  }
  if (values.month !== undefined && !/^\d{4}-(0[1-9]|1[0-2])$/.test(values.month.trim())) {
    throw new Error(`--month "${values.month}" is not valid. Use YYYY-MM, e.g. --month 2026-11.`);
  }
  const dryRun = Boolean(values['dry-run']);
  // Writes get a request ID: yours, or a generated one that is echoed back so a retry can reuse it.
  const requestId = command.write && !dryRun ? values['request-id']?.trim() || randomUUID() : undefined;
  const flagToField = { 'dry-run': 'dry_run' };
  const payload = Object.fromEntries(Object.entries(values)
    .filter(([name]) => !['clear-note', 'format', 'request-id', 'split', 'split-equal', 'unarchive', 'archive', 'resume'].includes(name))
    .map(([name, value]) => [flagToField[name] ?? name.replaceAll('-', '_'), value]));
  if (requestId) payload.request_id = requestId;
  activeRequestId = requestId;
  if (values['clear-note']) payload.note = null;
  if (values.split) {
    payload.splits = values.split.map((pair) => {
      const cut = pair.lastIndexOf(':');
      if (cut < 1) throw new Error('Use --split FRIEND:AMOUNT, e.g. --split Alex:500.');
      return { friend: pair.slice(0, cut).trim(), amount: pair.slice(cut + 1).trim() };
    });
  }
  if (values['split-equal'] !== undefined) {
    payload.split_equal = values['split-equal'].split(',').map((name) => name.trim()).filter(Boolean);
  }
  if (values.archive || values.unarchive) payload.archived = Boolean(values.archive);
  if (operation === 'accounts.archive') payload.archived = !values.unarchive;
  if (operation === 'subscriptions.pause') payload.active = Boolean(values.resume);
  if (operation === 'data.export') delete payload.format;

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
  if (requestId && output && typeof output === 'object') output = { ...output, request_id: requestId };
  if (operation === 'data.export' && values.format === 'csv' && Array.isArray(output.items)) {
    process.stdout.write(historyCsv(output.items));
    return;
  }
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

main(process.argv.slice(2), process.env).catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: error.message, ...(activeRequestId && { request_id: activeRequestId }) })}\n`);
  process.exitCode = 1;
});
