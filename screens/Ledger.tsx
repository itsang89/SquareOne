import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal } from 'lucide-react';
import { EntryRow } from '../components/EntryRow';
import { DataLoadErrorBanner } from '../components/DataLoadErrorBanner';
import { TransactionSkeleton } from '../components/LoadingSkeleton';
import { SELECT_CLASS } from '../components/Chip';
import { useAppContext } from '../context/AppContext';
import { localDay, localMonth, myExpense, incomeAmount, rangeTotals, monthRange } from '../utils/calculations';
import { dayLabel, KIND_LABEL } from '../utils/entryUi';
import { matchesEntryQuery, normalizeSearchQuery } from '../utils/search';
import { formatCurrency } from '../utils/formatters';
import type { Entry, EntryKind } from '../types';

const PAGE = 150;
const thisMonth = () => localMonth(new Date().toISOString());

const shiftMonth = (m: string, by: number) => {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Filters live in the URL so other screens can deep-link, e.g. /ledger?account=ID&month=all.
 * Params: q, kind, category, account, friend, month (YYYY-MM | all).
 */
export const Ledger: React.FC = () => {
  const { entries, accounts, categories, friends, loading, error, refetch } = useAppContext();
  const [params, setParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const q = params.get('q') ?? '';
  const month = params.get('month') ?? thisMonth();
  const kind = params.get('kind') ?? '';
  const category = params.get('category') ?? '';
  const account = params.get('account') ?? '';
  const friend = params.get('friend') ?? '';
  const filterCount = [kind, category, account, friend].filter(Boolean).length;

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
    setLimit(PAGE);
  };

  const lookups = useMemo(() => ({ accounts, categories, friends }), [accounts, categories, friends]);

  const filtered = useMemo(() => {
    const nq = normalizeSearchQuery(q);
    return entries.filter((e) => {
      if (month !== 'all' && localMonth(e.occurredAt) !== month) return false;
      if (kind && e.kind !== kind) return false;
      if (category && e.categoryId !== category) return false;
      if (account && e.accountId !== account && e.toAccountId !== account) return false;
      if (friend && e.friendId !== friend && !e.shares.some((s) => s.friendId === friend)) return false;
      return !nq || matchesEntryQuery(e, nq, lookups);
    });
  }, [entries, q, month, kind, category, account, friend, lookups]);

  const totals = useMemo(() => {
    if (month === 'all') return rangeTotals(filtered);
    const [y, m] = month.split('-').map(Number);
    return rangeTotals(filtered, monthRange(y, m - 1));
  }, [filtered, month]);

  const days = useMemo(() => {
    const groups: { day: string; items: Entry[] }[] = [];
    for (const e of filtered.slice(0, limit)) {
      const day = localDay(e.occurredAt);
      const last = groups[groups.length - 1];
      if (last?.day === day) last.items.push(e); else groups.push({ day, items: [e] });
    }
    return groups;
  }, [filtered, limit]);

  const monthText = month === 'all' ? 'All time'
    : new Date(`${month}-01T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen pb-28 bg-neo-bg dark:bg-zinc-950">
      <header className="sticky top-0 z-20 bg-neo-bg/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b-2 border-black px-5 pt-5 pb-3 space-y-3">
        <h1 className="text-3xl font-black uppercase leading-none dark:text-zinc-100">Ledger</h1>

        <div className="flex items-center justify-between bg-white dark:bg-zinc-900 border-2 border-black shadow-neo-sm">
          <button type="button" aria-label="Previous month" disabled={month === 'all'} onClick={() => set('month', shiftMonth(month, -1))} className="p-3 disabled:opacity-20 dark:text-zinc-100"><ChevronLeft size={20} /></button>
          <button type="button" onClick={() => set('month', month === 'all' ? thisMonth() : 'all')} className="font-black uppercase text-sm dark:text-zinc-100" title="Toggle all time">
            {monthText}
          </button>
          <button type="button" aria-label="Next month" disabled={month === 'all'} onClick={() => set('month', shiftMonth(month, 1))} className="p-3 disabled:opacity-20 dark:text-zinc-100"><ChevronRight size={20} /></button>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => set('q', e.target.value)}
              placeholder="Search title, note, amount…"
              aria-label="Search entries"
              className="w-full pl-9 pr-3 py-2.5 border-2 border-black font-bold text-sm bg-white dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-label="Filters"
            aria-expanded={showFilters}
            className={`relative w-11 border-2 border-black grid place-items-center ${filterCount ? 'bg-neo-yellow' : 'bg-white dark:bg-zinc-900 dark:text-zinc-100'}`}
          >
            <SlidersHorizontal size={18} />
            {filterCount > 0 && <span className="absolute -top-2 -right-2 bg-black text-white text-[10px] font-black w-5 h-5 rounded-full grid place-items-center">{filterCount}</span>}
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 gap-2">
            <select aria-label="Kind" className={SELECT_CLASS} value={kind} onChange={(e) => set('kind', e.target.value)}>
              <option value="">All kinds</option>
              {(Object.keys(KIND_LABEL) as EntryKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
            <select aria-label="Category" className={SELECT_CLASS} value={category} onChange={(e) => set('category', e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
            <select aria-label="Account" className={SELECT_CLASS} value={account} onChange={(e) => set('account', e.target.value)}>
              <option value="">All accounts</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.archived ? ' (archived)' : ''}</option>)}
            </select>
            <select aria-label="Friend" className={SELECT_CLASS} value={friend} onChange={(e) => set('friend', e.target.value)}>
              <option value="">All friends</option>
              {friends.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        )}

        <p className="text-xs font-black uppercase tracking-wide dark:text-zinc-100">
          <span className="dark:text-zinc-100">Spent {formatCurrency(totals.expense)}</span>
          <span className="mx-2 text-gray-400">·</span>
          <span className="text-neo-greenDark">In {formatCurrency(totals.income)}</span>
          <span className="ml-2 text-gray-400">{filtered.length} entries</span>
        </p>
      </header>

      <DataLoadErrorBanner error={error} loading={loading} onRetry={refetch} />

      <main className="p-5 space-y-5">
        {loading ? (
          [1, 2, 3, 4].map((i) => <TransactionSkeleton key={i} />)
        ) : days.length === 0 ? (
          <p className="text-center py-16 font-black uppercase text-gray-400 dark:text-zinc-600">Nothing here</p>
        ) : (
          days.map(({ day, items }) => {
            const spent = items.reduce((s, e) => s + myExpense(e), 0);
            const earned = items.reduce((s, e) => s + incomeAmount(e), 0);
            return (
              <section key={day} aria-label={dayLabel(day)}>
                <div className="flex items-baseline justify-between mb-1 px-1">
                  <h2 className="text-xs font-black uppercase tracking-widest dark:text-zinc-100">{dayLabel(day)}</h2>
                  <span className="text-xs font-black">
                    {spent > 0 && <span className="dark:text-zinc-100">-{formatCurrency(spent)}</span>}
                    {earned > 0 && <span className="text-neo-greenDark ml-2">+{formatCurrency(earned)}</span>}
                  </span>
                </div>
                <div className="border-2 border-black shadow-neo-sm divide-y-2 divide-black/10">
                  {items.map((e) => <EntryRow key={e.id} entry={e} lookups={lookups} />)}
                </div>
              </section>
            );
          })
        )}
        {filtered.length > limit && (
          <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="w-full py-3 border-2 border-black bg-white dark:bg-zinc-900 font-black uppercase text-sm shadow-neo-sm dark:text-zinc-100">
            Show more ({filtered.length - limit})
          </button>
        )}
      </main>
    </div>
  );
};
