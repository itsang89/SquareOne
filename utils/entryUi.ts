import type { Account, Category, CategoryKind, Entry, EntryKind, Friend } from '../types';
import { friendDeltas, localDay, round2, sharesTotal } from './calculations';

export const KIND_LABEL: Record<EntryKind, string> = {
  expense: 'Expense', income: 'Income', transfer: 'Transfer', settlement: 'Settle up',
};

export const CATEGORY_COLORS = ['#FF99C8', '#FFDE59', '#5CE1E6', '#C3F53C', '#C3B1E1', '#FF914D', '#FF4D4D', '#26C485'];
export const CATEGORY_EMOJI = ['🍜', '🚇', '🛒', '🏠', '🎬', '💊', '🎁', '👕', '☕', '📱', '💼', '💰', '✈️', '🎮', '📚', '🐶'];
export const NO_COLOR = '#E5E7EB';

/** Active (or all) categories of a kind, most-used first. */
export function categoriesByUse(categories: Category[], entries: Entry[], kind: CategoryKind, withArchived = false): Category[] {
  const uses = new Map<string, number>();
  for (const e of entries) if (e.categoryId) uses.set(e.categoryId, (uses.get(e.categoryId) ?? 0) + 1);
  return categories
    .filter((c) => c.kind === kind && (withArchived || !c.archived))
    .sort((a, b) => (uses.get(b.id) ?? 0) - (uses.get(a.id) ?? 0) || a.sort - b.sort || a.name.localeCompare(b.name));
}

/** Account of the newest entry that still points at an active account (entries are newest first). */
export function lastUsedAccountId(accounts: Account[], entries: Entry[]): string | undefined {
  const live = new Set(accounts.filter((a) => !a.archived).map((a) => a.id));
  for (const e of entries) {
    const id = [e.accountId, e.toAccountId].find((x) => x && live.has(x));
    if (id && e.accountId === id) return id;
  }
  return accounts.find((a) => !a.archived)?.id;
}

/** Latest fx rate to HKD per currency, from newest entries. */
export function latestFx(entries: Entry[]): Record<string, number> {
  const fx: Record<string, number> = {};
  for (const e of entries) if (!(e.currency in fx)) fx[e.currency] = e.fxRate;
  return fx;
}

/** Split `total` equally between me and `n` friends. Friends get rounded shares; I absorb the remainder. */
export function splitEqual(total: number, n: number): number {
  return n > 0 ? round2(total / (n + 1)) : 0;
}

/** Local YYYY-MM-DD → ISO timestamp. Keeps the original time-of-day when the day is unchanged; else noon. */
export function dayToIso(day: string, original?: string): string {
  const base = original ?? new Date().toISOString();
  return day === localDay(base) ? base : new Date(`${day}T12:00:00`).toISOString();
}

export const dayLabel = (day: string): string => {
  const d = new Date(`${day}T12:00:00`);
  const today = localDay(new Date().toISOString());
  if (day === today) return 'Today';
  if (day === localDay(new Date(Date.now() - 864e5).toISOString())) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
};

export interface Lookups {
  categories: Category[];
  accounts: Account[];
  friends: Friend[];
}

export interface EntryView {
  cat?: Category;
  kind: EntryKind;
  title: string;
  sub: string;
  amount: number;
  currency: string;
  sign: '+' | '-' | '';
  tone: 'in' | 'out' | 'muted';
}

/** How one entry reads in a list. `forFriend` shows it from that friend's side (what they owe / repaid). */
export function entryView(e: Entry, { categories, accounts, friends }: Lookups, forFriend?: string): EntryView {
  const cat = categories.find((c) => c.id === e.categoryId);
  const acc = (id?: string) => accounts.find((a) => a.id === id)?.name;
  const fname = (id?: string) => friends.find((f) => f.id === id)?.name ?? 'Friend';
  const base = { currency: e.currency, cat, kind: e.kind };

  if (forFriend) {
    const delta = friendDeltas(e).find(([id]) => id === forFriend)?.[1] ?? 0;
    return {
      ...base, title: e.title || cat?.name || KIND_LABEL[e.kind],
      sub: e.kind === 'settlement' ? (acc(e.accountId) ?? 'Offset') : `of ${e.amount.toFixed(2)}${acc(e.accountId) ? ` · ${acc(e.accountId)}` : ''}`,
      amount: Math.abs(delta), sign: delta >= 0 ? '+' : '-', tone: delta >= 0 ? 'out' : 'in',
    };
  }

  switch (e.kind) {
    case 'income':
      return { ...base, title: e.title || cat?.name || 'Income',
        sub: [cat?.name, acc(e.accountId)].filter(Boolean).join(' · '), amount: e.amount, sign: '+', tone: 'in' };
    case 'transfer':
      return { ...base, title: e.title || 'Transfer',
        sub: `${acc(e.accountId) ?? '?'} → ${acc(e.toAccountId) ?? '?'}`, amount: e.amount, sign: '', tone: 'muted' };
    case 'settlement':
      return { ...base, title: e.title || `${fname(e.friendId)} repaid`,
        sub: `${fname(e.friendId)} · ${acc(e.accountId) ?? 'offset, no money moved'}`, amount: e.amount, sign: e.accountId ? '+' : '', tone: e.accountId ? 'in' : 'muted' };
    default: {
      const split = e.shares.length > 0;
      const mine = round2(e.amount - sharesTotal(e));
      const names = e.shares.map((s) => fname(s.friendId).split(' ')[0]).join(', ');
      return {
        ...base, title: e.title || cat?.name || 'Expense',
        sub: [cat?.name, acc(e.accountId), split && `split w/ ${names}`].filter(Boolean).join(' · '),
        // Receivable-only entries cost me nothing: show what's owed instead.
        amount: mine > 0 || !split ? mine : sharesTotal(e), sign: mine > 0 || !split ? '-' : '', tone: mine > 0 || !split ? 'out' : 'muted',
      };
    }
  }
}
