import { describe, expect, it } from 'vitest';
import type { Account, Entry } from '../types';
import { canRepeatEntry, offsetAmount, recentEntryTemplates, settlementAmount } from './entryForm';

const entry = (id: string, data: Partial<Entry> = {}): Entry => ({
  id, kind: 'expense', occurredAt: '2026-11-21', title: 'Lunch', amount: 50,
  categoryId: 'food', currency: 'HKD', fxRate: 1, shares: [], ...data,
});

describe('settlementAmount', () => {
  it('converts and rounds a balance into the entry currency', () => {
    expect(settlementAmount(100, 7.8)).toBe(12.82);
    expect(settlementAmount(100, 1)).toBe(100);
    expect(settlementAmount(100, 0)).toBe(0);
  });

  it('chooses a cent amount that never overpays the rounded HKD balance', () => {
    expect(settlementAmount(1, 7.8)).toBe(0.12);
    expect(offsetAmount(settlementAmount(1, 7.8), 7.8)).toBe(0.94);
    expect(settlementAmount(0.04, 7.8)).toBe(0);
    expect(settlementAmount(1, 1.005)).toBe(0.99);
    expect(settlementAmount(-1, 7.8)).toBe(0);
  });
});

describe('offsetAmount', () => {
  it('preserves the HKD value when removing a foreign account', () => {
    expect(offsetAmount(12.82, 7.8)).toBe(100);
    expect(offsetAmount(100, 1)).toBe(100);
  });
});

describe('recentEntryTemplates', () => {
  it('keeps up to three distinct title, category and amount combinations, newest first', () => {
    const entries = [
      entry('1'), entry('2', { note: 'Different note' }), entry('3', { categoryId: 'travel' }),
      entry('4', { amount: 60 }), entry('5', { title: 'Dinner' }),
    ];
    expect(recentEntryTemplates(entries, []).map((item) => item.id)).toEqual(['1', '3', '4']);
    expect(recentEntryTemplates(entries.slice(0, 2), [])).toEqual([entries[0]]);
    expect(recentEntryTemplates([], [])).toEqual([]);
  });

  it('filters adjustments before picking Recent and allows other archived transfer accounts', () => {
    const adjustment: Account = { id: 'hidden', name: 'Balance adjustments', currency: 'HKD', archived: true, sort: 0 };
    const accounts = [adjustment, { ...adjustment, id: 'old', name: 'Old bank' }];
    const entries = [
      entry('title', { title: 'Balance adjustment' }),
      entry('in', { kind: 'transfer', accountId: 'hidden' }),
      entry('out', { kind: 'transfer', toAccountId: 'hidden' }),
      entry('legit', { kind: 'transfer', toAccountId: 'old' }),
      entry('import', { categoryId: undefined }),
    ];
    expect(recentEntryTemplates(entries, accounts).map((item) => item.id)).toEqual(['legit', 'import']);
    expect(canRepeatEntry(entries[2], [{ ...adjustment, archived: false }])).toBe(true);
  });
});
