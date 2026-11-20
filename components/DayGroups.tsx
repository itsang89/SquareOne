import React from 'react';
import type { Entry } from '../types';
import { EntryRow } from './EntryRow';
import { localDay, myExpense, incomeAmount } from '../utils/calculations';
import { dayLabel, type Lookups } from '../utils/entryUi';
import { formatCurrency } from '../utils/formatters';

/** Entries (newest first) grouped under day headers with that day's spent / income. Used by Ledger and Home. */
export const DayGroups: React.FC<{ entries: Entry[]; lookups: Lookups }> = ({ entries, lookups }) => {
  const days: { day: string; items: Entry[] }[] = [];
  for (const e of entries) {
    const day = localDay(e.occurredAt);
    const last = days[days.length - 1];
    if (last?.day === day) last.items.push(e); else days.push({ day, items: [e] });
  }
  return (
    <>
      {days.map(({ day, items }) => {
        const spent = items.reduce((s, e) => s + myExpense(e), 0);
        const earned = items.reduce((s, e) => s + incomeAmount(e), 0);
        return (
          <section key={day} aria-label={dayLabel(day)}>
            <div className="flex items-baseline justify-between mb-1 px-1">
              <h2 className="text-xs font-black uppercase tracking-widest dark:text-zinc-100">{dayLabel(day)}</h2>
              <span className="text-xs font-black tabular-nums">
                {spent > 0 && <span className="dark:text-zinc-100">-{formatCurrency(spent)}</span>}
                {earned > 0 && <span className="text-neo-greenDark ml-2">+{formatCurrency(earned)}</span>}
              </span>
            </div>
            <div className="border-2 border-black shadow-neo-sm divide-y-2 divide-black/10">
              {items.map((e) => <EntryRow key={e.id} entry={e} lookups={lookups} />)}
            </div>
          </section>
        );
      })}
    </>
  );
};
