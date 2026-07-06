import { describe, expect, it } from 'vitest';
import {
  filterFriendsByQuery,
  filterTransactionsByQuery,
  getTransactionCounterparty,
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

describe('getTransactionCounterparty', () => {
  it('returns the friend referenced by friendId when it is not "me"', () => {
    const { friend, counterpartyId } = getTransactionCounterparty(tx1, friends);
    expect(friend?.id).toBe('f1');
    expect(counterpartyId).toBe('f1');
  });

  it('falls back to payerId when friendId is "me"', () => {
    const flipped: Transaction = { ...tx1, payerId: 'f2', friendId: 'me' };
    const { friend, counterpartyId } = getTransactionCounterparty(flipped, friends);
    expect(friend?.id).toBe('f2');
    expect(counterpartyId).toBe('f2');
  });

  it('returns undefined friend and null id when both sides are "me"', () => {
    const self: Transaction = { ...tx1, payerId: 'me', friendId: 'me' };
    const { friend, counterpartyId } = getTransactionCounterparty(self, friends);
    expect(friend).toBeUndefined();
    expect(counterpartyId).toBeNull();
  });

  it('resolves friend as undefined when the uuid is not in the friends list', () => {
    const orphan: Transaction = { ...tx1, friendId: 'unknown-uuid' };
    const { friend, counterpartyId } = getTransactionCounterparty(orphan, friends);
    expect(friend).toBeUndefined();
    expect(counterpartyId).toBe('unknown-uuid');
  });
});
