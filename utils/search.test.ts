import { describe, expect, it } from 'vitest';
import { filterFriendsByQuery, matchesEntryQuery, normalizeSearchQuery, searchAll } from './search';
import type { Entry, Friend } from '../types';

const friends: Friend[] = [
  { id: 'f1', name: 'Alex Kim', avatar: 'a', balance: 10, lastActivity: '', status: 'active' },
  { id: 'f2', name: 'Sam Lee', avatar: 'b', balance: 0, lastActivity: '', status: 'active' },
];
const lookups = {
  friends,
  categories: [{ id: 'c1', name: 'Dining', kind: 'expense' as const, archived: false, sort: 0 }],
  accounts: [{ id: 'a1', name: 'Octopus', currency: 'HKD', archived: false, sort: 0 }],
};
const dinner: Entry = {
  id: 'e1', kind: 'expense', occurredAt: new Date().toISOString(), title: 'Dinner', note: 'ramen', amount: 42.5,
  currency: 'HKD', fxRate: 1, accountId: 'a1', categoryId: 'c1', shares: [{ friendId: 'f1', amount: 20 }],
};

describe('search', () => {
  it('normalizes', () => expect(normalizeSearchQuery('  Hello ')).toBe('hello'));
  it('matches title, note, amount, category, account and shared friend', () => {
    for (const q of ['dinner', 'ramen', '42', 'dining', 'octopus', 'alex']) {
      expect(matchesEntryQuery(dinner, q, lookups)).toBe(true);
    }
    expect(matchesEntryQuery(dinner, 'sam', lookups)).toBe(false);
  });
  it('filters friends', () => expect(filterFriendsByQuery(friends, 'sam').map((f) => f.id)).toEqual(['f2']));
  it('returns nothing for a blank query', () => {
    expect(searchAll(lookups, [dinner], '  ')).toEqual({ friends: [], entries: [] });
  });
  it('returns friend and entry matches', () => {
    const r = searchAll(lookups, [dinner], 'alex');
    expect(r.friends).toHaveLength(1);
    expect(r.entries).toHaveLength(1);
  });
});
