import { Transaction } from '../types';

export interface DbTransactionRow {
  id: string;
  user_id: string;
  title: string;
  amount: number;
  date: string;
  type: string;
  payer_id: string;
  friend_id: string;
  note: string | null;
  is_settlement: boolean;
}

/**
 * Map a frontend `Transaction` (with `'me'` sentinel on payerId/friendId) to the
 * snake_case row shape Supabase expects. The user's UUID replaces `'me'` wherever
 * it appears; the friend UUID is the other side of the transaction.
 */
export function toDbTransaction(tx: Transaction, userId: string): DbTransactionRow {
  return {
    id: tx.id,
    user_id: userId,
    title: tx.title,
    amount: tx.amount,
    date: tx.date,
    type: tx.type,
    payer_id: tx.payerId === 'me' ? userId : tx.payerId,
    friend_id: tx.friendId === 'me' ? tx.payerId : tx.friendId,
    note: tx.note ?? null,
    is_settlement: tx.isSettlement ?? false,
  };
}
