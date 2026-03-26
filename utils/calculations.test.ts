import { describe, it, expect } from 'vitest';
import {
  calculateFriendBalance,
  calculateFriendBalancesMap,
  calculateTotalOwed,
  calculateTotalOwing,
  calculateNetBalance,
} from './calculations';
import type { Transaction } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tx(overrides: Partial<Transaction> & Pick<Transaction, 'id' | 'amount' | 'payerId' | 'friendId'>): Transaction {
  return {
    title: 'Test',
    date: '2024-01-01',
    type: 'General',
    isSettlement: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// calculateFriendBalance
// ---------------------------------------------------------------------------

describe('calculateFriendBalance', () => {
  it('returns 0 when there are no transactions', () => {
    expect(calculateFriendBalance('alice', [])).toBe(0);
  });

  it('returns 0 for an unknown friend', () => {
    const transactions = [tx({ id: '1', amount: 50, payerId: 'me', friendId: 'bob' })];
    expect(calculateFriendBalance('alice', transactions)).toBe(0);
  });

  it('is positive when "me" paid and friend owes', () => {
    const transactions = [tx({ id: '1', amount: 50, payerId: 'me', friendId: 'bob' })];
    expect(calculateFriendBalance('bob', transactions)).toBe(50);
  });

  it('is negative when friend paid and "me" owes', () => {
    const transactions = [tx({ id: '1', amount: 30, payerId: 'bob', friendId: 'me' })];
    expect(calculateFriendBalance('bob', transactions)).toBe(-30);
  });

  it('accumulates multiple transactions correctly', () => {
    const transactions = [
      tx({ id: '1', amount: 100, payerId: 'me', friendId: 'bob' }),
      tx({ id: '2', amount: 40, payerId: 'bob', friendId: 'me' }),
    ];
    // net: bob owes 100 - 40 = 60
    expect(calculateFriendBalance('bob', transactions)).toBe(60);
  });

  it('handles a settlement transaction reducing the balance', () => {
    const transactions = [
      tx({ id: '1', amount: 100, payerId: 'me', friendId: 'bob' }),
      tx({ id: '2', amount: 100, payerId: 'bob', friendId: 'me', isSettlement: true }),
    ];
    expect(calculateFriendBalance('bob', transactions)).toBe(0);
  });

  it('handles a partial settlement', () => {
    const transactions = [
      tx({ id: '1', amount: 100, payerId: 'me', friendId: 'bob' }),
      tx({ id: '2', amount: 40, payerId: 'bob', friendId: 'me', isSettlement: true }),
    ];
    expect(calculateFriendBalance('bob', transactions)).toBe(60);
  });

  it('handles a settlement where "me" pays the friend back', () => {
    // "me" borrowed from alice, then settled by paying alice
    const transactions = [
      tx({ id: '1', amount: 50, payerId: 'alice', friendId: 'me' }), // alice paid, me owes
      tx({ id: '2', amount: 50, payerId: 'me', friendId: 'alice', isSettlement: true }), // me settled
    ];
    expect(calculateFriendBalance('alice', transactions)).toBe(0);
  });

  it('returns 0 for null/undefined guard', () => {
    expect(calculateFriendBalance('', [])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateFriendBalancesMap
// ---------------------------------------------------------------------------

describe('calculateFriendBalancesMap', () => {
  it('returns an empty map for an empty array', () => {
    expect(calculateFriendBalancesMap([]).size).toBe(0);
  });

  it('tracks multiple friends independently', () => {
    const transactions = [
      tx({ id: '1', amount: 50, payerId: 'me', friendId: 'alice' }),
      tx({ id: '2', amount: 30, payerId: 'me', friendId: 'bob' }),
    ];
    const map = calculateFriendBalancesMap(transactions);
    expect(map.get('alice')).toBe(50);
    expect(map.get('bob')).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// calculateTotalOwed / calculateTotalOwing
// ---------------------------------------------------------------------------

describe('calculateTotalOwed', () => {
  it('returns 0 for an empty transaction list', () => {
    expect(calculateTotalOwed([])).toBe(0);
  });

  it('sums positive balances (friends who owe "me")', () => {
    const transactions = [
      tx({ id: '1', amount: 50, payerId: 'me', friendId: 'alice' }),
      tx({ id: '2', amount: 30, payerId: 'me', friendId: 'bob' }),
      tx({ id: '3', amount: 20, payerId: 'carol', friendId: 'me' }), // "me" owes carol
    ];
    expect(calculateTotalOwed(transactions)).toBe(80);
  });

  it('returns 0 when "me" only owes money', () => {
    const transactions = [tx({ id: '1', amount: 100, payerId: 'bob', friendId: 'me' })];
    expect(calculateTotalOwed(transactions)).toBe(0);
  });
});

describe('calculateTotalOwing', () => {
  it('returns 0 for an empty transaction list', () => {
    expect(calculateTotalOwing([])).toBe(0);
  });

  it('sums negative balances as a positive amount', () => {
    const transactions = [
      tx({ id: '1', amount: 50, payerId: 'alice', friendId: 'me' }),
      tx({ id: '2', amount: 30, payerId: 'bob', friendId: 'me' }),
      tx({ id: '3', amount: 20, payerId: 'me', friendId: 'carol' }), // carol owes me
    ];
    expect(calculateTotalOwing(transactions)).toBe(80);
  });

  it('returns 0 when "me" is never the debtor', () => {
    const transactions = [tx({ id: '1', amount: 100, payerId: 'me', friendId: 'bob' })];
    expect(calculateTotalOwing(transactions)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calculateNetBalance
// ---------------------------------------------------------------------------

describe('calculateNetBalance', () => {
  it('returns 0 for no transactions', () => {
    expect(calculateNetBalance([])).toBe(0);
  });

  it('is positive when more is owed to "me" than I owe', () => {
    const transactions = [
      tx({ id: '1', amount: 100, payerId: 'me', friendId: 'alice' }),
      tx({ id: '2', amount: 30, payerId: 'bob', friendId: 'me' }),
    ];
    expect(calculateNetBalance(transactions)).toBe(70);
  });

  it('is negative when "me" owes more than is owed to me', () => {
    const transactions = [
      tx({ id: '1', amount: 20, payerId: 'me', friendId: 'alice' }),
      tx({ id: '2', amount: 100, payerId: 'bob', friendId: 'me' }),
    ];
    expect(calculateNetBalance(transactions)).toBe(-80);
  });

  it('is zero when fully settled', () => {
    const transactions = [
      tx({ id: '1', amount: 50, payerId: 'me', friendId: 'alice' }),
      tx({ id: '2', amount: 50, payerId: 'alice', friendId: 'me', isSettlement: true }),
    ];
    expect(calculateNetBalance(transactions)).toBe(0);
  });

  it('equals owed minus owing', () => {
    const transactions = [
      tx({ id: '1', amount: 100, payerId: 'me', friendId: 'alice' }),
      tx({ id: '2', amount: 60, payerId: 'bob', friendId: 'me' }),
    ];
    const owed = calculateTotalOwed(transactions);
    const owing = calculateTotalOwing(transactions);
    expect(calculateNetBalance(transactions)).toBe(owed - owing);
  });
});
