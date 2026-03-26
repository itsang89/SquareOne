import { describe, expect, it } from 'vitest';
import {
  filterFriendsByQuery,
  filterTransactionsByQuery,
  matchesTransactionQuery,
  normalizeSearchQuery,
  searchAll,
} from './search';
import type { Friend, Transaction } from '../types';

const friends: Friend[] = [
  {
    id: 'f1',
    name: 'Alex Kim',
    avatar: 'a',
    balance: 10,
    lastActivity: '',
    status: 'active',
  },
  {
    id: 'f2',
    name: 'Sam Lee',
    avatar: 'b',
    balance: 0,
    lastActivity: '',
    status: 'active',
  },
];

const tx1: Transaction = {
  id: 't1',
  title: 'Dinner',
  amount: 42.5,
  date: new Date().toISOString(),
  type: 'Meal',
  payerId: 'me',
  friendId: 'f1',
};

describe('normalizeSearchQuery', () => {
  it('trims and lowercases', () => {
    expect(normalizeSearchQuery('  Hello ')).toBe('hello');
  });
});

describe('matchesTransactionQuery', () => {
  it('matches friend name', () => {
    expect(matchesTransactionQuery(tx1, 'alex', friends)).toBe(true);
  });

  it('matches title', () => {
    expect(matchesTransactionQuery(tx1, 'dinner', friends)).toBe(true);
  });

  it('matches amount substring', () => {
    expect(matchesTransactionQuery(tx1, '42', friends)).toBe(true);
  });
});

describe('filterFriendsByQuery', () => {
  it('filters by name', () => {
    expect(filterFriendsByQuery(friends, 'sam').map((f) => f.id)).toEqual(['f2']);
  });
});

describe('filterTransactionsByQuery', () => {
  it('returns all when query empty', () => {
    expect(filterTransactionsByQuery([tx1], '', friends)).toHaveLength(1);
  });
});

describe('searchAll', () => {
  it('returns empty when query empty', () => {
    const r = searchAll(friends, [tx1], '   ');
    expect(r.friends).toEqual([]);
    expect(r.transactions).toEqual([]);
  });

  it('returns friend and transaction matches', () => {
    const r = searchAll(friends, [tx1], 'alex');
    expect(r.friends).toHaveLength(1);
    expect(r.transactions).toHaveLength(1);
  });
});
