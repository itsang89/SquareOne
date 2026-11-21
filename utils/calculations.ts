import type { Account, Category, CategoryKind, Entry, Subscription } from '../types';

/**
 * Pure functions over the entries model. Conventions:
 * - Entries are always paid by me. An expense's `amount` is the full total.
 * - Friend balance = sum of their shares − their settlements, in HKD (× fxRate per entry). Positive = they owe me.
 * - "My expense" = (amount − sum(shares)) × fxRate, in HKD. Income = amount × fxRate.
 * - Account balances are in the account's own currency (raw `amount`, no fx).
 * - Day/month bucketing uses the device's local time.
 */

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const pad = (n: number) => String(n).padStart(2, '0');
export const localDay = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const localMonth = (iso: string): string => localDay(iso).slice(0, 7);

/** Half-open time range [from, to). */
export interface DateRange {
  from: Date;
  to: Date;
}
/** `month` is 0-based (JS convention). */
export const monthRange = (year: number, month: number): DateRange => ({
  from: new Date(year, month, 1),
  to: new Date(year, month + 1, 1),
});
export const yearRange = (year: number): DateRange => ({ from: new Date(year, 0, 1), to: new Date(year + 1, 0, 1) });
/** Monday-start local week; `offset` 0 = this week, -1 = last week. */
export const weekRange = (offset = 0, now = new Date()): DateRange => {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) + offset * 7);
  return { from, to: new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7) };
};

const inRange = (e: Entry, r?: DateRange): boolean => {
  if (!r) return true;
  const t = new Date(e.occurredAt).getTime();
  return t >= r.from.getTime() && t < r.to.getTime();
};

// ---------------------------------------------------------------------------
// Per-entry
// ---------------------------------------------------------------------------

export const sharesTotal = (e: Entry): number => round2(e.shares.reduce((s, x) => s + x.amount, 0));

/** My own cost of an expense, in the entry's currency. 0 for non-expenses. */
export const myShare = (e: Entry): number => (e.kind === 'expense' ? round2(e.amount - sharesTotal(e)) : 0);

/** My own cost of an expense in HKD (what stats show). 0 for non-expenses. */
export const myExpense = (e: Entry): number => round2(myShare(e) * e.fxRate);

/** Income in HKD. 0 for non-income. */
export const incomeAmount = (e: Entry): number => (e.kind === 'income' ? round2(e.amount * e.fxRate) : 0);

/** Account movements an entry causes: [accountId, signed delta in account currency]. */
export function accountDeltas(e: Entry): [string, number][] {
  const out: [string, number][] = [];
  switch (e.kind) {
    case 'expense':
      if (e.accountId) out.push([e.accountId, -e.amount]);
      break;
    case 'income':
    case 'settlement':
      if (e.accountId) out.push([e.accountId, e.amount]);
      break;
    case 'transfer':
      if (e.accountId) out.push([e.accountId, -e.amount]);
      if (e.toAccountId) out.push([e.toAccountId, e.amount]);
      break;
  }
  return out;
}

/** Friend balance movements an entry causes: [friendId, signed delta in HKD (amount × fxRate, rounded per share)]. */
export function friendDeltas(e: Entry): [string, number][] {
  if (e.kind === 'expense') return e.shares.map((s) => [s.friendId, round2(s.amount * e.fxRate)]);
  if (e.kind === 'settlement' && e.friendId) return [[e.friendId, -round2(e.amount * e.fxRate)]];
  return [];
}

// ---------------------------------------------------------------------------
// Friends
// ---------------------------------------------------------------------------

export function friendBalancesMap(entries: Entry[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of entries) for (const [id, d] of friendDeltas(e)) m.set(id, (m.get(id) ?? 0) + d);
  for (const [id, v] of m) m.set(id, round2(v));
  return m;
}

export const friendBalance = (friendId: string, entries: Entry[]): number =>
  friendBalancesMap(entries).get(friendId) ?? 0;

/** Sum of balances friends owe me (positive balances only). */
export function totalOwed(entries: Entry[]): number {
  let t = 0;
  for (const v of friendBalancesMap(entries).values()) if (v > 0) t += v;
  return round2(t);
}

/** Sum of overpayments: friends whose balance is negative (they paid more than they owed). */
export function totalOwing(entries: Entry[]): number {
  let t = 0;
  for (const v of friendBalancesMap(entries).values()) if (v < 0) t -= v;
  return round2(t);
}

export function getLastActivity(friendId: string, entries: Entry[], now = new Date()): string {
  const times = entries
    .filter((e) => e.friendId === friendId || e.shares.some((s) => s.friendId === friendId))
    .map((e) => new Date(e.occurredAt).getTime());
  if (times.length === 0) return 'Never';
  const date = new Date(Math.max(...times));
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Accounts and net worth
// ---------------------------------------------------------------------------

/** Balance per account id (every account in `accounts` is present, even with no entries). */
export function accountBalances(accounts: Account[], entries: Entry[]): Map<string, number> {
  const m = new Map<string, number>(accounts.map((a) => [a.id, 0]));
  for (const e of entries) for (const [id, d] of accountDeltas(e)) m.set(id, (m.get(id) ?? 0) + d);
  for (const [id, v] of m) m.set(id, round2(v));
  return m;
}

/** HKD rate for a currency. HKD (or unknown, rough accuracy) = 1. */
const rate = (fx: Record<string, number> | undefined, currency: string) => fx?.[currency] ?? 1;

/**
 * Net worth in HKD = non-archived account balances + what friends owe me.
 * `fx` maps currency → HKD for non-HKD accounts (missing = 1).
 */
export function netWorth(accounts: Account[], entries: Entry[], fx?: Record<string, number>): number {
  const bal = accountBalances(accounts, entries);
  let t = totalOwed(entries);
  for (const a of accounts) if (!a.archived) t += (bal.get(a.id) ?? 0) * rate(fx, a.currency);
  return round2(t);
}

/** Net worth at each point in time (entries with occurredAt <= point). `points` need not be sorted. */
export function netWorthSeries(
  accounts: Account[],
  entries: Entry[],
  points: Date[],
  fx?: Record<string, number>
): { at: Date; value: number }[] {
  const live = new Map(accounts.filter((a) => !a.archived).map((a) => [a.id, rate(fx, a.currency)]));
  const sorted = [...entries].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const friends = new Map<string, number>();
  let cash = 0;
  let owed = 0;
  let i = 0;
  return [...points]
    .map((p, idx) => ({ p, idx }))
    .sort((a, b) => a.p.getTime() - b.p.getTime())
    .map(({ p, idx }) => {
      while (i < sorted.length && new Date(sorted[i].occurredAt).getTime() <= p.getTime()) {
        const e = sorted[i++];
        for (const [id, d] of accountDeltas(e)) cash += d * (live.get(id) ?? 0);
        for (const [id, d] of friendDeltas(e)) {
          const before = friends.get(id) ?? 0;
          const after = before + d;
          friends.set(id, after);
          owed += Math.max(after, 0) - Math.max(before, 0);
        }
      }
      return { idx, at: p, value: round2(cash + owed) };
    })
    .sort((a, b) => a.idx - b.idx)
    .map(({ at, value }) => ({ at, value }));
}

// ---------------------------------------------------------------------------
// Stats (HKD)
// ---------------------------------------------------------------------------

export function rangeTotals(entries: Entry[], range?: DateRange): { expense: number; income: number; net: number } {
  let expense = 0;
  let income = 0;
  for (const e of entries) {
    if (!inRange(e, range)) continue;
    expense += myExpense(e);
    income += incomeAmount(e);
  }
  return { expense: round2(expense), income: round2(income), net: round2(income - expense) };
}

export interface CategoryTotal {
  categoryId: string | null; // null = uncategorised
  total: number;
  percent: number; // 0..100, one decimal
}

/** Totals per category for one kind, largest first. Entries with a zero amount are skipped. */
export function totalsByCategory(entries: Entry[], kind: CategoryKind, range?: DateRange): CategoryTotal[] {
  const m = new Map<string | null, number>();
  for (const e of entries) {
    if (e.kind !== kind || !inRange(e, range)) continue;
    const v = kind === 'expense' ? myExpense(e) : incomeAmount(e);
    if (v > 0) m.set(e.categoryId ?? null, (m.get(e.categoryId ?? null) ?? 0) + v);
  }
  const sum = [...m.values()].reduce((s, v) => s + v, 0);
  return [...m.entries()]
    .map(([categoryId, total]) => ({
      categoryId,
      total: round2(total),
      percent: sum > 0 ? Math.round((total / sum) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

/** Entries of one kind in one category (null = uncategorised) within a range, newest first. */
export function categoryEntries(entries: Entry[], kind: CategoryKind, categoryId: string | null, range?: DateRange): Entry[] {
  const amt = kind === 'expense' ? myExpense : incomeAmount;
  return entries
    .filter((e) => e.kind === kind && (e.categoryId ?? null) === categoryId && inRange(e, range) && amt(e) > 0)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export interface SeriesPoint {
  key: string; // 'YYYY-MM-DD' (daily) or 'YYYY-MM' (monthly)
  income: number;
  expense: number;
}

/** Income vs my expense for every day of a month (`month` is 0-based). */
export function dailySeries(entries: Entry[], year: number, month: number): SeriesPoint[] {
  const days = new Date(year, month + 1, 0).getDate();
  const pts = Array.from({ length: days }, (_, i) => ({
    key: `${year}-${pad(month + 1)}-${pad(i + 1)}`,
    income: 0,
    expense: 0,
  }));
  const byKey = new Map(pts.map((p) => [p.key, p]));
  for (const e of entries) {
    const p = byKey.get(localDay(e.occurredAt));
    if (!p) continue;
    p.income += incomeAmount(e);
    p.expense += myExpense(e);
  }
  return pts.map((p) => ({ ...p, income: round2(p.income), expense: round2(p.expense) }));
}

/** Income vs my expense for each of the 12 months of a year. */
export function monthlySeries(entries: Entry[], year: number): SeriesPoint[] {
  const pts = Array.from({ length: 12 }, (_, i) => ({ key: `${year}-${pad(i + 1)}`, income: 0, expense: 0 }));
  const byKey = new Map(pts.map((p) => [p.key, p]));
  for (const e of entries) {
    const p = byKey.get(localMonth(e.occurredAt));
    if (!p) continue;
    p.income += incomeAmount(e);
    p.expense += myExpense(e);
  }
  return pts.map((p) => ({ ...p, income: round2(p.income), expense: round2(p.expense) }));
}

/** % change from prev to cur, rounded. null when there is no previous amount to compare. */
export const pctChange = (cur: number, prev: number): number | null => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);

/** Active subscriptions whose next date falls today..today+days (local), soonest first. */
export function subscriptionsDue(subs: Subscription[], now = new Date(), days = 7): Subscription[] {
  const from = localDay(now.toISOString());
  const to = localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 12).toISOString());
  return subs.filter((s) => s.active && s.nextDate >= from && s.nextDate <= to).sort((a, b) => a.nextDate.localeCompare(b.nextDate));
}

/** Category lookup helper for UIs. */
export const categoryName = (categories: Category[], id?: string | null): string =>
  categories.find((c) => c.id === id)?.name ?? 'Uncategorised';
