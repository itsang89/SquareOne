import { describe, expect, it } from 'vitest';
import { categoriesByUse, dayToIso, entryView, lastUsedAccountId, splitEqual } from './entryUi';
import { localDay } from './calculations';
import type { Account, Category, Entry, Friend } from '../types';

const accounts: Account[] = [
  { id: 'a1', name: 'Bank', currency: 'HKD', archived: false, sort: 0 },
  { id: 'a2', name: 'Old', currency: 'HKD', archived: true, sort: 1 },
];
const categories: Category[] = [
  { id: 'c1', name: 'Food', kind: 'expense', archived: false, sort: 0 },
  { id: 'c2', name: 'Taxi', kind: 'expense', archived: false, sort: 1 },
  { id: 'c3', name: 'Gone', kind: 'expense', archived: true, sort: 2 },
];
const friends = [{ id: 'f1', name: 'Alex Kim', avatar: '', balance: 0, lastActivity: '', status: 'active' }] as Friend[];
const e = (p: Partial<Entry>): Entry => ({
  id: 'e', kind: 'expense', occurredAt: '2026-11-20T10:00:00Z', title: '', amount: 100, currency: 'HKD', fxRate: 1, shares: [], ...p,
});

describe('entryUi', () => {
  it('orders active categories by use, then sort', () => {
    const list = categoriesByUse(categories, [e({ categoryId: 'c2' }), e({ categoryId: 'c2' }), e({ categoryId: 'c1' })], 'expense');
    expect(list.map((c) => c.id)).toEqual(['c2', 'c1']);
  });

  it('defaults to the newest entry\'s active account, else the first active one', () => {
    expect(lastUsedAccountId(accounts, [e({ accountId: 'a2' }), e({ accountId: 'a1' })])).toBe('a1');
    expect(lastUsedAccountId(accounts, [])).toBe('a1');
  });

  it('splits equally between me and friends', () => {
    expect(splitEqual(90, 2)).toBe(30);
    expect(splitEqual(100, 2)).toBe(33.33);
    expect(splitEqual(100, 0)).toBe(0);
  });

  it('keeps time of day when the day is unchanged, else noon of the new day', () => {
    const orig = '2026-11-20T10:00:00Z';
    expect(dayToIso(localDay(orig), orig)).toBe(orig);
    expect(localDay(dayToIso('2026-01-05'))).toBe('2026-01-05');
  });

  it('shows my share for a split expense and what is owed for a receivable-only one', () => {
    const lookups = { accounts, categories, friends };
    const split = entryView(e({ accountId: 'a1', shares: [{ friendId: 'f1', amount: 40 }] }), lookups);
    expect([split.amount, split.sign]).toEqual([60, '-']);
    const owed = entryView(e({ shares: [{ friendId: 'f1', amount: 100 }] }), lookups);
    expect([owed.amount, owed.sign, owed.tone]).toEqual([100, '', 'muted']);
    const theirs = entryView(e({ shares: [{ friendId: 'f1', amount: 40 }] }), lookups, 'f1');
    expect([theirs.amount, theirs.sign]).toEqual([40, '+']);
  });
});
