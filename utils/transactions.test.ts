import { describe, it, expect } from 'vitest';
import { toDbTransaction } from './transactions';
import type { Transaction } from '../types';

const baseTx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'tx-1',
  title: 'Pizza',
  amount: 20,
  date: '2025-01-01T00:00:00.000Z',
  type: 'Meal',
  payerId: 'me',
  friendId: 'friend-uuid',
  ...overrides,
});

describe('toDbTransaction', () => {
  const USER = 'user-uuid';

  it('maps "me" payerId to the user UUID and leaves friendId alone', () => {
    const row = toDbTransaction(baseTx({ payerId: 'me', friendId: 'friend-uuid' }), USER);
    expect(row.payer_id).toBe(USER);
    expect(row.friend_id).toBe('friend-uuid');
  });

  it('maps "me" friendId to the payerId (who is the friend in this case)', () => {
    const row = toDbTransaction(baseTx({ payerId: 'friend-uuid', friendId: 'me' }), USER);
    expect(row.payer_id).toBe('friend-uuid');
    expect(row.friend_id).toBe('friend-uuid');
  });

  it('passes through real UUIDs unchanged', () => {
    const row = toDbTransaction(
      baseTx({ payerId: 'user-A', friendId: 'user-B' }),
      USER,
    );
    expect(row.payer_id).toBe('user-A');
    expect(row.friend_id).toBe('user-B');
  });

  it('coerces missing note to null and missing isSettlement to false', () => {
    const tx = baseTx();
    delete (tx as Partial<Transaction>).note;
    delete (tx as Partial<Transaction>).isSettlement;
    const row = toDbTransaction(tx, USER);
    expect(row.note).toBeNull();
    expect(row.is_settlement).toBe(false);
  });

  it('preserves note and isSettlement when set', () => {
    const row = toDbTransaction(
      baseTx({ note: 'split 4 ways', isSettlement: true }),
      USER,
    );
    expect(row.note).toBe('split 4 ways');
    expect(row.is_settlement).toBe(true);
  });

  it('copies identity and detail fields verbatim', () => {
    const row = toDbTransaction(baseTx(), USER);
    expect(row.id).toBe('tx-1');
    expect(row.user_id).toBe(USER);
    expect(row.title).toBe('Pizza');
    expect(row.amount).toBe(20);
    expect(row.date).toBe('2025-01-01T00:00:00.000Z');
    expect(row.type).toBe('Meal');
  });
});
