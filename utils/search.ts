import type { Friend, Transaction } from '../types';

/** Lowercase query string (trimmed). */
export function normalizeSearchQuery(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Resolves the counterparty friend for a transaction. The frontend
 * `Transaction` shape uses the sentinel `'me'` for the signed-in user; the
 * other side carries the friend UUID. This helper unwraps both cases and
 * returns the resolved friend (or undefined if neither side points at a
 * friend) plus the UUID that was used to find them.
 *
 * Resolution order, matching the inline copies in Home / History / Search:
 *   1. tx.friendId !== 'me'  -> counterparty is the friend named by friendId
 *   2. tx.payerId  !== 'me'  -> counterparty is the friend named by payerId
 *   3. otherwise              -> no friend (self-transfer; shouldn't occur)
 */
export function getTransactionCounterparty(
  tx: Transaction,
  friends: Friend[],
): { friend: Friend | undefined; counterpartyId: string | null } {
  if (tx.friendId !== 'me') {
    const friend = friends.find((f) => f.id === tx.friendId);
    return { friend, counterpartyId: tx.friendId };
  }
  if (tx.payerId !== 'me') {
    const friend = friends.find((f) => f.id === tx.payerId);
    return { friend, counterpartyId: tx.payerId };
  }
  return { friend: undefined, counterpartyId: null };
}

/**
 * Lowercased counterparty name for search filtering.
 * Thin wrapper over `getTransactionCounterparty`.
 */
export function getTransactionCounterpartyName(tx: Transaction, friends: Friend[]): string {
  return getTransactionCounterparty(tx, friends).friend?.name.toLowerCase() ?? '';
}

/**
 * Whether a transaction matches a **lowercased** search query (substring match).
 */
export function matchesTransactionQuery(
  tx: Transaction,
  queryLower: string,
  friends: Friend[]
): boolean {
  const friendName = getTransactionCounterpartyName(tx, friends);
  const title = tx.title.toLowerCase();
  const note = (tx.note || '').toLowerCase();
  const amount = tx.amount.toString();

  return (
    friendName.includes(queryLower) ||
    title.includes(queryLower) ||
    note.includes(queryLower) ||
    amount.includes(queryLower)
  );
}

export function filterFriendsByQuery(friends: Friend[], queryLower: string): Friend[] {
  if (!queryLower.trim()) return friends;
  return friends.filter((f) => f.name.toLowerCase().includes(queryLower));
}

export function filterTransactionsByQuery(
  transactions: Transaction[],
  queryLower: string,
  friends: Friend[]
): Transaction[] {
  if (!queryLower.trim()) return transactions;
  return transactions.filter((tx) => matchesTransactionQuery(tx, queryLower, friends));
}

const DEFAULT_FRIEND_LIMIT = 12;
const DEFAULT_TX_LIMIT = 15;

export interface SearchAllLimits {
  friends: number;
  transactions: number;
}

export function searchAll(
  friends: Friend[],
  transactions: Transaction[],
  rawQuery: string,
  limits: SearchAllLimits = {
    friends: DEFAULT_FRIEND_LIMIT,
    transactions: DEFAULT_TX_LIMIT,
  }
): { friends: Friend[]; transactions: Transaction[] } {
  const q = normalizeSearchQuery(rawQuery);
  if (!q) {
    return { friends: [], transactions: [] };
  }
  return {
    friends: filterFriendsByQuery(friends, q).slice(0, limits.friends),
    transactions: filterTransactionsByQuery(transactions, q, friends).slice(0, limits.transactions),
  };
}
