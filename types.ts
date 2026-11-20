export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

export type FriendStatus = 'settled' | 'active';

export interface Friend {
  id: string; // UUID
  user_id?: string; // UUID
  name: string;
  avatar: string;
  balance: number; // Positive = they owe you, Negative = you owe them
  lastActivity: string;
  status: FriendStatus;
}

export type EntryKind = 'expense' | 'income' | 'transfer' | 'settlement';
export type CategoryKind = 'expense' | 'income';
export type Cadence = 'weekly' | 'monthly' | 'yearly';

export interface Account {
  id: string;
  name: string;
  currency: string;
  archived: boolean;
  sort: number;
}

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  icon?: string;
  color?: string;
  archived: boolean;
  sort: number;
}

/** A friend's share of an expense: they owe me this much. */
export interface EntryShare {
  friendId: string;
  amount: number;
}

/** One money event, always paid by me. `amount` is the full total in `currency`; `fxRate` converts it to HKD. */
export interface Entry {
  id: string;
  kind: EntryKind;
  occurredAt: string; // ISO timestamp
  title: string;
  note?: string;
  amount: number; // > 0
  currency: string;
  fxRate: number;
  accountId?: string;
  toAccountId?: string; // transfer only
  categoryId?: string;
  friendId?: string; // settlement only
  subscriptionId?: string;
  requestId?: string;
  shares: EntryShare[]; // expense only
}

/** Fields the caller supplies; defaults: currency HKD, fxRate 1, occurredAt now, shares []. */
export type EntryInput = Pick<Entry, 'kind' | 'amount'> &
  Partial<Omit<Entry, 'kind' | 'amount' | 'id'>> & { id?: string };

export interface Subscription {
  id: string;
  title: string;
  amount: number;
  currency: string;
  fxRate: number;
  categoryId?: string;
  accountId?: string;
  cadence: Cadence;
  nextDate: string; // YYYY-MM-DD
  active: boolean;
}

export type SubscriptionInput = Omit<Subscription, 'id' | 'fxRate' | 'currency' | 'active'> &
  Partial<Pick<Subscription, 'id' | 'fxRate' | 'currency' | 'active'>>;

export type TransactionType = string;

/**
 * Legacy friend-ledger view of an entry (see utils/transactions.ts). Kept so existing
 * screens keep working; one Transaction per (entry, friend) pair.
 */
export interface Transaction {
  id: string; // `${entryId}` for single-share rows, `${entryId}:${friendId}` otherwise
  entryId?: string;
  user_id?: string;
  title: string;
  amount: number;
  date: string; // ISO date string
  type: TransactionType;
  payerId: string; // 'me' or friendId
  friendId: string; // UUID - The other person involved
  note?: string;
  isSettlement?: boolean;
}

export interface ExpenseChartData {
  name: string;
  value: number;
  color: string;
  [key: string]: unknown;
}
