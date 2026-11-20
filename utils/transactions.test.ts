import { describe, it, expect } from 'vitest';
import {
  entriesToTransactions, legacyDelta, legacyToEntry, shouldGrayTransaction, transactionToEntryInput, type LegacyRow,
} from './transactions';
import { friendBalancesMap } from './calculations';
import type { Entry, EntryInput, Transaction } from '../types';

const asEntry = (i: EntryInput): Entry => ({
  title: '', currency: 'HKD', fxRate: 1, occurredAt: '2026-01-01T00:00:00Z', shares: [], ...i, id: i.id ?? 'x',
});

/** Pre-migration balance, exactly as the old calculations.ts computed it. */
function legacyBalances(rows: LegacyRow[]) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.friendId, (m.get(r.friendId) ?? 0) + legacyDelta(r.payerIsMe, r.amount));
  return m;
}

describe('legacy transactions → entries (mirrors the SQL migration)', () => {
  // Deterministic pseudo-random rows across 3 friends, payers and settlement flags.
  const rows: LegacyRow[] = Array.from({ length: 200 }, (_, i) => ({
    id: `t${i}`, title: `row ${i}`, date: '2026-01-01T00:00:00Z',
    amount: Math.round((((i * 7919) % 10000) / 100) * 100) / 100,
    friendId: ['a', 'b', 'c'][i % 3],
    payerIsMe: (i * 31) % 5 < 3,
  }));

  it('preserves every friend balance exactly', () => {
    const entries = rows.map((r) => legacyToEntry(r)).filter((e): e is EntryInput => !!e).map(asEntry);
    const before = legacyBalances(rows);
    const after = friendBalancesMap(entries);
    for (const f of ['a', 'b', 'c']) expect(after.get(f) ?? 0).toBeCloseTo(before.get(f) ?? 0, 2);
  });

  it('maps I-paid to a receivable-only expense and friend-paid to an offset settlement', () => {
    const base = { id: 'i', title: 'T', amount: 25, date: '2026-01-01', friendId: 'f' };
    const mine = legacyToEntry({ ...base, payerIsMe: true }, 'cat');
    expect(mine).toMatchObject({ id: 'i', kind: 'expense', amount: 25, categoryId: 'cat', shares: [{ friendId: 'f', amount: 25 }] });
    expect(mine?.accountId).toBeUndefined();
    const theirs = legacyToEntry({ ...base, payerIsMe: false });
    expect(theirs).toMatchObject({ kind: 'settlement', friendId: 'f', amount: 25 });
    expect(theirs?.accountId).toBeUndefined();
    expect(legacyToEntry({ ...base, amount: 0, payerIsMe: true })).toBeNull();
  });

  it('treats legacy settlements by payer, like regular rows', () => {
    // friend repays 30 (payer = friend, is_settlement) → balance -30
    expect(legacyDelta(false, 30)).toBe(-30);
    // I hand cash back (payer = me, is_settlement) → balance +30
    expect(legacyDelta(true, 30)).toBe(30);
  });
});

describe('transaction ↔ entry view', () => {
  const tx = (o: Partial<Transaction>): Transaction => ({
    id: 't', title: 'T', amount: 40, date: '2026-01-02T00:00:00Z', type: 'Meal', payerId: 'me', friendId: 'f', ...o,
  });

  it('translates old-screen rows into entries', () => {
    expect(transactionToEntryInput(tx({}))).toMatchObject({ kind: 'expense', shares: [{ friendId: 'f', amount: 40 }] });
    expect(transactionToEntryInput(tx({ payerId: 'f', friendId: 'me' }))).toMatchObject({ kind: 'settlement', friendId: 'f' });
    expect(transactionToEntryInput(tx({ payerId: 'f', friendId: 'me', isSettlement: true }))).toMatchObject({ kind: 'settlement' });
  });

  it('projects split expenses to one row per friend and settlements back', () => {
    const entries: Entry[] = [
      asEntry({ id: 'e1', kind: 'expense', amount: 300, accountId: 'bank', occurredAt: '2026-01-02T00:00:00Z',
        shares: [{ friendId: 'a', amount: 100 }, { friendId: 'b', amount: 100 }] }),
      asEntry({ id: 'e2', kind: 'settlement', amount: 100, friendId: 'a', occurredAt: '2026-01-03T00:00:00Z' }),
      asEntry({ id: 'e3', kind: 'income', amount: 9, accountId: 'bank' }),
    ];
    const view = entriesToTransactions(entries, []);
    expect(view.map((t) => t.id)).toEqual(['e2', 'e1:a', 'e1:b']);
    expect(view[0]).toMatchObject({ payerId: 'a', friendId: 'me', isSettlement: true });
    // balance in the view equals the entries' balance
    const a = view.reduce((s, t) => s + (t.friendId === 'a' ? t.amount : t.payerId === 'a' ? -t.amount : 0), 0);
    expect(a).toBe(friendBalancesMap(entries).get('a'));
  });

  it('grays rows at or before the last time a friend was squared up', () => {
    const rows = [
      tx({ id: '1', amount: 100, date: '2026-01-01T00:00:00Z' }),
      tx({ id: '2', amount: 100, payerId: 'f', friendId: 'me', isSettlement: true, date: '2026-01-02T00:00:00Z' }),
      tx({ id: '3', amount: 20, date: '2026-01-03T00:00:00Z' }),
    ];
    expect(shouldGrayTransaction(rows[0], 'f', rows)).toBe(true);
    expect(shouldGrayTransaction(rows[2], 'f', rows)).toBe(false);
  });
});
