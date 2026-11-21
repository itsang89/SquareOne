import React from 'react';
import { Link } from 'react-router-dom';
import type { Entry } from '../types';
import { entryView, type Lookups } from '../utils/entryUi';
import { CategoryTile } from './CategoryTile';
import { formatCurrency } from '../utils/formatters';

/** One entry in a list. Tap opens the edit screen. `forFriend` shows the friend's side of it. */
export const EntryRow: React.FC<{ entry: Entry; lookups: Lookups; forFriend?: string }> = ({ entry, lookups, forFriend }) => {
  const v = entryView(entry, lookups, forFriend);
  const tone = v.tone === 'in' ? 'text-neo-greenDark' : v.tone === 'out' ? 'text-neo-ink dark:text-zinc-100' : 'text-gray-600 dark:text-zinc-400';
  // Split expenses list each friend's share under the row.
  const shares = !forFriend && entry.kind === 'expense' ? entry.shares : [];
  return (
    <Link
      to={`/entry/${entry.id}`}
      className="block p-3 bg-white dark:bg-zinc-900 border-2 border-transparent hover:border-black active:bg-gray-50 dark:active:bg-zinc-800 transition-colors"
    >
      <span className="flex items-center gap-3">
        <CategoryTile category={v.cat} kind={v.kind} />
        <span className="flex-1 min-w-0">
          <span className="block font-bold text-[15px] leading-tight truncate dark:text-zinc-100">{v.title}</span>
          <span className="block text-xs font-medium text-gray-600 dark:text-zinc-400 line-clamp-2 mt-0.5">{v.sub || '—'}</span>
        </span>
        <span className={`font-bold text-[15px] tabular-nums shrink-0 ${tone}`}>
          {v.sign}{formatCurrency(v.amount, v.currency)}
        </span>
      </span>
      {shares.length > 0 && (
        <span className="block mt-2 ml-[52px] border-l-2 border-black/20 dark:border-zinc-600 pl-3 space-y-1">
          {shares.map((s) => (
            <span key={s.friendId} className="flex justify-between gap-2 text-xs font-bold">
              <span className="truncate text-gray-600 dark:text-zinc-400">
                {lookups.friends.find((f) => f.id === s.friendId)?.name ?? 'Friend'} owes you
              </span>
              <span className="tabular-nums text-neo-greenDark shrink-0">{formatCurrency(s.amount, entry.currency)}</span>
            </span>
          ))}
        </span>
      )}
    </Link>
  );
};
