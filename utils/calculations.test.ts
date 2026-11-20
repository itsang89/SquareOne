import { describe, it, expect } from 'vitest';
import {
  accountBalances, categoryEntries, dailySeries, friendBalance, friendBalancesMap, getLastActivity, monthlySeries, monthRange,
  myExpense, netWorth, netWorthSeries, rangeTotals, totalOwed, totalOwing, totalsByCategory, yearRange,
} from './calculations';
import type { Account, Entry } from '../types';

let n = 0;
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();
function entry(o: Partial<Entry> & Pick<Entry, 'kind' | 'amount'>): Entry {
  return { id: `e${++n}`, occurredAt: at(2026, 1, 10), title: 't', currency: 'HKD', fxRate: 1, shares: [], ...o };
}
const acct = (id: string, o: Partial<Account> = {}): Account => ({ id, name: id, currency: 'HKD', archived: false, sort: 0, ...o });

// 300 dinner on Bank, Alex owes 100 and Bob 100 → my expense 100.
const dinner = entry({
  kind: 'expense', amount: 300, accountId: 'bank', categoryId: 'food',
  shares: [{ friendId: 'alex', amount: 100 }, { friendId: 'bob', amount: 100 }],
});

describe('friend balances with fx', () => {
  it('values a USD share at its rate, so an HKD repayment clears it', () => {
    const usd = entry({ kind: 'expense', amount: 200, currency: 'USD', fxRate: 7.8, shares: [{ friendId: 'alex', amount: 100 }] });
    expect(friendBalance('alex', [usd])).toBe(780);
    const repay = entry({ kind: 'settlement', amount: 780, friendId: 'alex' });
    expect(friendBalance('alex', [usd, repay])).toBe(0);
  });
});

describe('friend balances', () => {
  it('adds shares and subtracts settlements', () => {
    const entries = [dinner, entry({ kind: 'settlement', amount: 40, friendId: 'alex', accountId: 'bank' })];
    expect(friendBalance('alex', entries)).toBe(60);
    expect(friendBalance('bob', entries)).toBe(100);
    expect(friendBalance('nobody', entries)).toBe(0);
  });

  it('settlement without an account is an offset with the same balance effect', () => {
    const entries = [dinner, entry({ kind: 'settlement', amount: 100, friendId: 'alex' })];
    expect(friendBalance('alex', entries)).toBe(0);
    expect(accountBalances([acct('bank')], entries).get('bank')).toBe(-300);
  });

  it('totals owed and owing split by sign', () => {
    const entries = [dinner, entry({ kind: 'settlement', amount: 130, friendId: 'bob' })];
    expect(friendBalancesMap(entries).get('bob')).toBe(-30);
    expect(totalOwed(entries)).toBe(100);
    expect(totalOwing(entries)).toBe(30);
  });

  it('ignores income and transfers', () => {
    expect(totalOwed([entry({ kind: 'income', amount: 50, accountId: 'bank' })])).toBe(0);
  });
});

describe('my expense', () => {
  it('is amount minus shares, times fx rate', () => {
    expect(myExpense(dinner)).toBe(100);
    expect(myExpense(entry({ kind: 'expense', amount: 10, currency: 'USD', fxRate: 7.8 }))).toBe(78);
  });
  it('is 0 for a receivable-only expense and for non-expenses', () => {
    const receivable = entry({ kind: 'expense', amount: 50, shares: [{ friendId: 'alex', amount: 50 }] });
    expect(myExpense(receivable)).toBe(0);
    expect(myExpense(entry({ kind: 'income', amount: 50, accountId: 'bank' }))).toBe(0);
  });
});

describe('accounts and net worth', () => {
  const accounts = [acct('bank'), acct('octopus'), acct('old', { archived: true })];
  const entries = [
    entry({ kind: 'income', amount: 1000, accountId: 'bank' }),
    dinner,
    entry({ kind: 'transfer', amount: 200, accountId: 'bank', toAccountId: 'octopus' }),
    entry({ kind: 'income', amount: 5, accountId: 'old' }),
  ];
  it('computes balances including transfers', () => {
    const b = accountBalances(accounts, entries);
    expect(b.get('bank')).toBe(1000 - 300 - 200);
    expect(b.get('octopus')).toBe(200);
  });
  it('net worth = live accounts + friends owe me, excluding archived', () => {
    expect(netWorth(accounts, entries)).toBe(500 + 200 + 200);
  });
  it('applies fx for non-HKD accounts', () => {
    const usd = [acct('usd', { currency: 'USD' })];
    expect(netWorth(usd, [entry({ kind: 'income', amount: 10, accountId: 'usd' })], { USD: 7.8 })).toBe(78);
  });
  it('net worth series follows entries over time, in any point order', () => {
    const es = [
      entry({ kind: 'income', amount: 100, accountId: 'bank', occurredAt: at(2026, 1, 1) }),
      entry({ kind: 'expense', amount: 40, accountId: 'bank', occurredAt: at(2026, 1, 5), shares: [{ friendId: 'a', amount: 10 }] }),
      entry({ kind: 'settlement', amount: 10, friendId: 'a', accountId: 'bank', occurredAt: at(2026, 1, 9) }),
    ];
    const pts = [new Date(2026, 0, 10), new Date(2026, 0, 2), new Date(2026, 0, 6)];
    const vals = netWorthSeries([acct('bank')], es, pts).map((p) => p.value);
    expect(vals).toEqual([70, 100, 70]); // 100-40+10 (settled) | 100 | 60 + 10 owed
    expect(netWorthSeries([acct('bank')], es, pts)[0].value).toBe(netWorth([acct('bank')], es));
  });
});

describe('stats', () => {
  const entries = [
    dinner, // Jan 10, my 100
    entry({ kind: 'expense', amount: 50, categoryId: 'fun', occurredAt: at(2026, 1, 20) }),
    entry({ kind: 'income', amount: 800, categoryId: 'salary', accountId: 'bank', occurredAt: at(2026, 1, 25) }),
    entry({ kind: 'expense', amount: 70, categoryId: 'food', occurredAt: at(2026, 2, 1, 0) }), // local midnight
    entry({ kind: 'transfer', amount: 999, accountId: 'bank', toAccountId: 'cash', occurredAt: at(2026, 1, 11) }),
  ];
  it('range totals exclude transfers and other months', () => {
    expect(rangeTotals(entries, monthRange(2026, 0))).toEqual({ expense: 150, income: 800, net: 650 });
    expect(rangeTotals(entries, monthRange(2026, 1))).toEqual({ expense: 70, income: 0, net: -70 });
    expect(rangeTotals(entries, yearRange(2026)).expense).toBe(220);
  });
  it('totals by category with percentages, largest first', () => {
    const t = totalsByCategory(entries, 'expense', monthRange(2026, 0));
    expect(t).toEqual([
      { categoryId: 'food', total: 100, percent: 66.7 },
      { categoryId: 'fun', total: 50, percent: 33.3 },
    ]);
    expect(totalsByCategory(entries, 'income', monthRange(2026, 0))[0]).toMatchObject({ categoryId: 'salary', total: 800, percent: 100 });
  });
  it('daily series covers every day and buckets by local day', () => {
    const d = dailySeries(entries, 2026, 0);
    expect(d).toHaveLength(31);
    expect(d[9]).toEqual({ key: '2026-01-10', income: 0, expense: 100 });
    expect(d[24].income).toBe(800);
    expect(dailySeries(entries, 2026, 1)[0].expense).toBe(70); // Feb 1 00:00 local stays in Feb
  });
  it('monthly series has 12 buckets', () => {
    const m = monthlySeries(entries, 2026);
    expect(m).toHaveLength(12);
    expect(m[0]).toEqual({ key: '2026-01', income: 800, expense: 150 });
    expect(m[1].expense).toBe(70);
  });
});

describe('categoryEntries', () => {
  it('filters by kind, category and range, newest first, skipping zero-cost entries', () => {
    const a = entry({ kind: 'expense', amount: 10, categoryId: 'food', occurredAt: at(2026, 3, 1) });
    const b = entry({ kind: 'expense', amount: 20, categoryId: 'food', occurredAt: at(2026, 3, 9) });
    const free = entry({ kind: 'expense', amount: 20, categoryId: 'food', occurredAt: at(2026, 3, 5), shares: [{ friendId: 'x', amount: 20 }] });
    const other = entry({ kind: 'expense', amount: 5, categoryId: 'fun', occurredAt: at(2026, 3, 2) });
    const old = entry({ kind: 'expense', amount: 5, categoryId: 'food', occurredAt: at(2026, 2, 2) });
    const none = entry({ kind: 'expense', amount: 7, occurredAt: at(2026, 3, 3) });
    const all = [a, b, free, other, old, none];
    expect(categoryEntries(all, 'expense', 'food', monthRange(2026, 2)).map((e) => e.id)).toEqual([b.id, a.id]);
    expect(categoryEntries(all, 'expense', null, monthRange(2026, 2)).map((e) => e.id)).toEqual([none.id]);
  });
});

describe('getLastActivity', () => {
  const now = new Date(2026, 0, 20, 12);
  it('describes recency for share and settlement entries', () => {
    expect(getLastActivity('alex', [], now)).toBe('Never');
    expect(getLastActivity('alex', [dinner], now)).toBe('1 week ago');
    const s = entry({ kind: 'settlement', amount: 1, friendId: 'alex', occurredAt: at(2026, 1, 20, 8) });
    expect(getLastActivity('alex', [dinner, s], now)).toBe('Today');
  });
});
