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
  return (
    <Link
      to={`/entry/${entry.id}`}
      className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 border-2 border-transparent hover:border-black active:bg-gray-50 dark:active:bg-zinc-800 transition-colors"
    >
      <CategoryTile category={v.cat} kind={v.kind} />
      <span className="flex-1 min-w-0">
        <span className="block font-bold text-[15px] leading-tight truncate dark:text-zinc-100">{v.title}</span>
        <span className="block text-xs font-medium text-gray-600 dark:text-zinc-400 truncate mt-0.5">{v.sub || '—'}</span>
      </span>
      <span className={`font-bold text-[15px] tabular-nums shrink-0 ${tone}`}>
        {v.sign}{formatCurrency(v.amount, v.currency)}
      </span>
    </Link>
  );
};
