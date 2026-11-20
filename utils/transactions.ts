import type { Category, Entry, EntryInput, Transaction } from '../types';
import { TRANSACTION_COLORS as TYPE_COLORS } from '../constants';

/**
 * Legacy friend-ledger view. The old screens still speak `Transaction` (payerId 'me' or a friend);
 * the data layer stores `Entry`. These helpers translate between the two.
 * The mapping mirrors supabase/migrations/20261121100100_legacy_transactions_to_entries.sql:
 *   legacy balance delta = (payer is me ? +amount : -amount), settlement or not
 *   delta > 0 -> expense, no account, one share = delta (receivable only)
 *   delta < 0 -> settlement, no account (offset)
 */

export const legacyDelta = (payerIsMe: boolean, amount: number): number => (payerIsMe ? amount : -amount);

export interface LegacyRow {
  id: string;
  title: string;
  amount: number;
  date: string;
  note?: string | null;
  friendId: string;
  payerIsMe: boolean;
}

/** Map one legacy row to the entry that preserves its balance effect (null for a zero amount). */
export function legacyToEntry(row: LegacyRow, categoryId?: string): EntryInput | null {
  const delta = legacyDelta(row.payerIsMe, row.amount);
  if (delta === 0) return null;
  const base = { id: row.id, occurredAt: row.date, title: row.title, note: row.note ?? undefined, amount: Math.abs(delta) };
  return delta > 0
    ? { ...base, kind: 'expense', categoryId, shares: [{ friendId: row.friendId, amount: delta }] }
    : { ...base, kind: 'settlement', friendId: row.friendId };
}

/** Translate a legacy-style transaction (from the old Add/Settle screens) into an entry input. */
export function transactionToEntryInput(tx: Transaction, categoryId?: string): EntryInput | null {
  const payerIsMe = tx.payerId === 'me';
  return legacyToEntry(
    {
      id: tx.entryId ?? tx.id,
      title: tx.title,
      amount: tx.amount,
      date: tx.date,
      note: tx.note,
      friendId: payerIsMe ? tx.friendId : tx.payerId,
      payerIsMe,
    },
    categoryId
  );
}

/** Friend-ledger rows for the old screens: one per (expense, friend share) and per settlement. */
export function entriesToTransactions(entries: Entry[], categories: Category[]): Transaction[] {
  const name = (id?: string) => categories.find((c) => c.id === id)?.name ?? 'General';
  const out: Transaction[] = [];
  for (const e of entries) {
    if (e.kind === 'settlement' && e.friendId) {
      out.push({
        id: e.id, entryId: e.id, title: e.title || 'Settlement', amount: e.amount, date: e.occurredAt,
        type: 'General', payerId: e.friendId, friendId: 'me', note: e.note, isSettlement: true,
      });
    } else if (e.kind === 'expense') {
      for (const s of e.shares) {
        out.push({
          id: e.shares.length === 1 ? e.id : `${e.id}:${s.friendId}`, entryId: e.id, title: e.title,
          amount: s.amount, date: e.occurredAt, type: name(e.categoryId), payerId: 'me',
          friendId: s.friendId, note: e.note, isSettlement: false,
        });
      }
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

/** Signed effect of a ledger row on `friendId`'s balance (legacy-view semantics). */
function ledgerDelta(t: Transaction, friendId: string): number {
  if (t.payerId === 'me' && t.friendId === friendId) return t.amount;
  if (t.payerId === friendId && t.friendId === 'me') return -t.amount;
  return 0;
}

/** True when a ledger row was already squared away by a later zero-balance point. */
export function shouldGrayTransaction(tx: Transaction, friendId: string, transactions: Transaction[]): boolean {
  if (!friendId || !transactions) return false;
  const rows = transactions
    .filter((t) => t.friendId === friendId || t.payerId === friendId)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let running = 0;
  let total = 0;
  let lastZero = -1;
  rows.forEach((t, i) => {
    running += ledgerDelta(t, friendId);
    total = running;
    if (Math.abs(running) < 0.01) lastZero = i;
  });
  if (Math.abs(total) < 0.01) return true;
  const idx = rows.findIndex((t) => t.id === tx.id);
  return lastZero >= 0 && idx >= 0 && idx <= lastZero;
}

/** Home chart: share of outstanding receivables by category label (percent, rounded). */
export function calculateDebtOrigins(transactions: Transaction[]): { name: string; value: number; color: string }[] {
  const totals = new Map<string, number>();
  for (const t of transactions) if (!t.isSettlement) totals.set(t.type, (totals.get(t.type) ?? 0) + t.amount);
  const sum = [...totals.values()].reduce((s, v) => s + v, 0);
  if (sum === 0) return [];
  return [...totals.entries()]
    .map(([name, amount]) => ({ name, value: Math.round((amount / sum) * 100), color: TYPE_COLORS[name] ?? TYPE_COLORS.General }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
}

/** Home chart: amounts friends were fronted per month, last N months. */
export function calculateMonthlyTotals(transactions: Transaction[], months = 6): { month: string; total: number }[] {
  const now = new Date();
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const total = transactions
      .filter((t) => !t.isSettlement && t.payerId === 'me' && t.date.slice(0, 7) === key)
      .reduce((s, t) => s + t.amount, 0);
    return { month: d.toLocaleDateString(undefined, { month: 'short' }), total: Math.round(total * 100) / 100 };
  });
}
