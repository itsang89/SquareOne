// Money+ CSV export → SquareOne entries. Pure parsing/planning; the screen does the DB writes.
import type { CategoryKind, EntryKind } from '../types';

export interface MoneyPlusRow {
  index: number; // position among bill rows; for error messages only
  occurrence: number; // 0 for the first row with this exact content, 1 for the next identical one, ...
  date: string; // 'YYYY-MM-DD HH:mm:ss', local HKT
  category: string;
  amount: number;
  kind: Exclude<EntryKind, 'settlement'>;
  account: string;
  currency: string;
  note: string;
  transferTo: string;
}

export interface ImportPreview {
  counts: Record<MoneyPlusRow['kind'], number>;
  balances: Record<string, number>; // account → balance from the file alone
  categories: { name: string; kind: CategoryKind }[];
  from: string;
  to: string;
}

/** Accounts that were closed/parked in Money+; created archived. */
export const ARCHIVED_ACCOUNTS = ['To Be Received', 'futu'];

const TYPES: Record<string, MoneyPlusRow['kind']> = { Expense: 'expense', Income: 'income', Transfer: 'transfer' };

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** Zero-amount bills can't be stored (amount > 0) and move no money, so they're skipped and counted. */
export function parseMoneyPlus(text: string): { rows: MoneyPlusRow[]; skipped: number } {
  const all = parseCsv(text.replace(/^\uFEFF/, ''));
  const h = all.findIndex((r) => r[0] === 'Date' && r.includes('Transfer to'));
  if (h < 0) throw new Error('Not a Money+ export: header "Date,Category,Amount,Type,…" not found.');
  const col = Object.fromEntries(all[h].map((name, i) => [name, i]));
  const out: MoneyPlusRow[] = [];
  let n = 0, skipped = 0;
  const seen = new Map<string, number>();
  for (const r of all.slice(h + 1)) {
    if (r.every((c) => !c.trim())) continue;
    const get = (n: string) => (r[col[n]] ?? '').trim();
    const kind = TYPES[get('Type')];
    const amount = Number(get('Amount'));
    if (kind && amount === 0) { n++; skipped++; continue; }
    if (!kind || !(amount > 0) || !/^\d{4}-\d\d-\d\d/.test(get('Date')) || !get('Account')) {
      throw new Error(`Bad row ${n + 1}: ${r.join(',')}`);
    }
    if (kind === 'transfer' && (!get('Transfer to') || get('Transfer to') === get('Account'))) {
      throw new Error(`Bad transfer in row ${n + 1}: ${r.join(',')}`);
    }
    // Identical rows (same content) get 0,1,2... so they stay distinct but a shifted re-export still matches.
    const sig = [get('Date'), get('Category'), get('Amount'), kind, get('Account'), get('Currency'), get('Note'), get('Transfer to')].join('|');
    const occurrence = seen.get(sig) ?? 0;
    seen.set(sig, occurrence + 1);
    out.push({
      index: n++, occurrence, date: get('Date'), category: get('Category'), amount, kind, account: get('Account'),
      currency: get('Currency') || 'HKD', note: get('Note'), transferTo: get('Transfer to'),
    });
  }
  return { rows: out, skipped };
}

export function previewImport(rows: MoneyPlusRow[]): ImportPreview {
  const counts = { expense: 0, income: 0, transfer: 0 };
  const cents: Record<string, number> = {};
  const cats = new Map<string, { name: string; kind: CategoryKind }>();
  const add = (a: string, v: number) => { cents[a] = (cents[a] ?? 0) + Math.round(v * 100); };
  for (const r of rows) {
    counts[r.kind]++;
    if (r.kind === 'transfer') { add(r.account, -r.amount); add(r.transferTo, r.amount); continue; }
    add(r.account, r.kind === 'income' ? r.amount : -r.amount);
    if (r.category) cats.set(`${r.kind}:${r.category}`, { name: r.category, kind: r.kind });
  }
  const dates = rows.map((r) => r.date.slice(0, 10)).sort();
  return {
    counts,
    balances: Object.fromEntries(Object.entries(cents).map(([a, c]) => [a, c / 100])),
    categories: [...cats.values()],
    from: dates[0] ?? '', to: dates[dates.length - 1] ?? '',
  };
}

/** Deterministic UUID (SHA-256 of row content + occurrence among identical rows), independent of row position. */
export async function rowRequestId(r: MoneyPlusRow): Promise<string> {
  const data = new TextEncoder().encode(['moneyplus2', r.date, r.category, r.amount, r.kind, r.account, r.transferTo, r.currency, r.note, r.occurrence].join('|'));
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', data)).slice(0, 16);
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = [...h].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

/** DB row for `entries` (without user_id). Ids come from name → id maps. */
export async function toEntryRow(
  r: MoneyPlusRow,
  accountId: (name: string) => string,
  categoryId: (kind: CategoryKind, name: string) => string | undefined,
) {
  return {
    kind: r.kind,
    occurred_at: `${r.date.replace(' ', 'T')}${r.date.length > 10 ? '' : 'T00:00:00'}+08:00`, // ponytail: export is always HKT
    title: r.category || (r.kind === 'transfer' ? 'Transfer' : r.kind === 'income' ? 'Income' : 'Expense'),
    note: r.note || null,
    amount: r.amount,
    currency: r.currency, // ponytail: fx_rate stays 1; the real export is all HKD
    account_id: accountId(r.account),
    to_account_id: r.kind === 'transfer' ? accountId(r.transferTo) : null,
    category_id: r.kind === 'transfer' || !r.category ? null : categoryId(r.kind, r.category) ?? null,
    request_id: await rowRequestId(r),
  };
}
