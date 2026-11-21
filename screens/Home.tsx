import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Search, Settings, Users } from 'lucide-react';
import { NeoCard } from '../components/NeoCard';
import { DayGroups } from '../components/DayGroups';
import { MonthSummary } from '../components/Home/MonthSummary';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { DataLoadErrorBanner } from '../components/DataLoadErrorBanner';
import { TransactionSkeleton } from '../components/LoadingSkeleton';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useSearch } from '../context/SearchContext';
import { rangeTotals, totalOwed, weekRange } from '../utils/calculations';
import { formatCurrency } from '../utils/formatters';

const iconBtn =
  'w-12 h-12 bg-white dark:bg-zinc-900 border-2 border-black shadow-neo-sm active:shadow-none active:translate-y-0.5 flex flex-col items-center justify-center gap-0.5 text-black dark:text-zinc-100';
const iconLabel = 'text-[9px] font-black uppercase leading-none';

export const Home: React.FC = () => {
  const { friends, entries, accounts, categories, loading, error, refetch } = useAppContext();
  const { user } = useAuth();
  const { openSearch } = useSearch();

  const owed = useMemo(() => totalOwed(entries), [entries]);
  const lookups = useMemo(() => ({ accounts, categories, friends }), [accounts, categories, friends]);
  const [week, setWeek] = useState(0); // 0 = this week, -1 = last week…
  const range = useMemo(() => weekRange(week), [week]);
  const weekEntries = useMemo(() => {
    const from = range.from.getTime(), to = range.to.getTime();
    return entries.filter((e) => { const t = new Date(e.occurredAt).getTime(); return t >= from && t < to; });
  }, [entries, range]);
  const totals = useMemo(() => rangeTotals(weekEntries), [weekEntries]);
  const short = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const weekLabel = week === 0 ? 'This week' : week === -1 ? 'Last week' : `${-week} weeks ago`;
  const weekDates = `${short(range.from)} – ${short(new Date(range.to.getTime() - 864e5))}`;

  return (
    <div className="min-h-screen pb-28 bg-neo-bg dark:bg-zinc-950 transition-colors duration-300">
      <header className="sticky top-0 z-20 bg-neo-bg/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b-2 border-black px-5 py-3 flex items-center justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-black uppercase leading-none dark:text-zinc-100">SquareOne</h2>
          <p className="text-xs font-bold text-gray-600 dark:text-zinc-400 uppercase tracking-widest mt-1 truncate">Hi, {user?.name || 'there'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={openSearch} className={iconBtn} ><Search size={18} strokeWidth={2.5} aria-hidden="true" /><span className={iconLabel}>Search</span></button>
          <Link to="/friends" className={iconBtn} ><Users size={18} strokeWidth={2.5} aria-hidden="true" /><span className={iconLabel}>Friends</span></Link>
          <Link to="/profile" className={iconBtn} ><Settings size={18} strokeWidth={2.5} aria-hidden="true" /><span className={iconLabel}>Settings</span></Link>
        </div>
      </header>

      <DataLoadErrorBanner error={error} loading={loading} onRetry={refetch} />

      <div className="p-5 space-y-6">
        <MonthSummary />

        <section>
          <Link to="/friends" className="block bg-neo-orange border-2 border-black shadow-neo p-4 text-black">
            <p className="text-xs font-bold uppercase tracking-widest text-black/70">Friends owe you</p>
            <p className="text-3xl font-black tracking-tighter"><AnimatedNumber value={owed} decimals={2} prefix="HK$" /></p>
          </Link>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between bg-white dark:bg-zinc-900 border-2 border-black shadow-neo-sm">
            <button type="button" aria-label="Previous week" onClick={() => setWeek((w) => w - 1)} className="p-3 dark:text-zinc-100"><ChevronLeft size={22} /></button>
            <div className="text-center" aria-live="polite">
              <p className="font-black uppercase text-sm leading-tight dark:text-zinc-100">{weekLabel}</p>
              <p className="text-xs font-medium text-gray-600 dark:text-zinc-400">{weekDates}</p>
            </div>
            <button type="button" aria-label="Next week" disabled={week === 0} onClick={() => setWeek((w) => w + 1)} className="p-3 disabled:opacity-20 dark:text-zinc-100"><ChevronRight size={22} /></button>
          </div>

          <div className="flex items-baseline justify-between px-1 text-sm font-bold tabular-nums">
            <span className="dark:text-zinc-100">
              Spent {formatCurrency(totals.expense)}
              {totals.income > 0 && <span className="text-neo-greenDark ml-3">Income {formatCurrency(totals.income)}</span>}
            </span>
            <Link to="/ledger" className="text-xs font-bold uppercase underline decoration-2 dark:text-zinc-100">Ledger</Link>
          </div>

          {loading ? (
            [1, 2, 3, 4].map((i) => <TransactionSkeleton key={i} />)
          ) : weekEntries.length > 0 ? (
            <div className="space-y-5"><DayGroups entries={weekEntries} lookups={lookups} /></div>
          ) : (
            <NeoCard className="text-center py-8">
              <p className="font-bold dark:text-zinc-100">No entries {week === 0 ? 'this week yet' : 'this week'}</p>
              <p className="text-sm text-gray-600 dark:text-zinc-400 mt-1">{week === 0 ? 'Tap + to log an expense.' : 'Use the arrows to check another week.'}</p>
            </NeoCard>
          )}
        </section>
      </div>
    </div>
  );
};
