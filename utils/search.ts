import type { Account, Category, Entry, Friend } from '../types';

/** Lowercase query string (trimmed). */
export function normalizeSearchQuery(raw: string): string {
  return raw.trim().toLowerCase();
}

export interface SearchLookups {
  friends: Friend[];
  categories: Category[];
  accounts: Account[];
}

/** Whether an entry matches a **lowercased** query: title, note, amount, category, account or friend names. */
export function matchesEntryQuery(e: Entry, q: string, { friends, categories, accounts }: SearchLookups): boolean {
  const name = (list: { id: string; name: string }[], id?: string) => list.find((x) => x.id === id)?.name ?? '';
  const friendIds = [e.friendId, ...e.shares.map((s) => s.friendId)];
  const hay = [
    e.title, e.note ?? '', String(e.amount), name(categories, e.categoryId),
    name(accounts, e.accountId), name(accounts, e.toAccountId),
    ...friendIds.map((id) => name(friends, id ?? undefined)),
  ].join('\n').toLowerCase();
  return hay.includes(q);
}

export function filterFriendsByQuery(friends: Friend[], queryLower: string): Friend[] {
  if (!queryLower.trim()) return friends;
  return friends.filter((f) => f.name.toLowerCase().includes(queryLower));
}

const FRIEND_LIMIT = 12;
const ENTRY_LIMIT = 15;

export function searchAll(
  lookups: SearchLookups,
  entries: Entry[],
  rawQuery: string
): { friends: Friend[]; entries: Entry[] } {
  const q = normalizeSearchQuery(rawQuery);
  if (!q) return { friends: [], entries: [] };
  return {
    friends: filterFriendsByQuery(lookups.friends, q).slice(0, FRIEND_LIMIT),
    entries: entries.filter((e) => matchesEntryQuery(e, q, lookups)).slice(0, ENTRY_LIMIT),
  };
}
