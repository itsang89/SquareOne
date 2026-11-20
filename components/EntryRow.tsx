import React from 'react';
import { Link } from 'react-router-dom';
import type { Entry } from '../types';
import { entryView, type Lookups } from '../utils/entryUi';
import { formatCurrency } from '../utils/formatters';

/** One entry in a list. Tap opens the edit screen. `forFriend` shows the friend's side of it. */
export const EntryRow: React.FC<{ entry: Entry; lookups: Lookups; forFriend?: string }> = ({ entry, lookups, forFriend }) => {
  const v = entryView(entry, lookups, forFriend);
  const tone = v.tone === 'in' ? 'text-neo-greenDark' : v.tone === 'out' ? 'text-neo-red' : 'text-gray-500 dark:text-zinc-400';
  return (
    <Link
      to={`/entry/${entry.id}`}
      className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 border-2 border-transparent hover:border-black active:bg-gray-50 dark:active:bg-zinc-800 transition-colors"
    >
      <span className="w-10 h-10 shrink-0 border-2 border-black grid place-items-center text-lg" style={{ backgroundColor: v.color }} aria-hidden>
        {v.icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-bold text-sm leading-tight truncate dark:text-zinc-100">{v.title}</span>
        <span className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-zinc-500 truncate">{v.sub || '—'}</span>
      </span>
      <span className={`font-black text-sm shrink-0 ${tone}`}>
        {v.sign}{formatCurrency(v.amount, v.currency)}
      </span>
    </Link>
  );
};
