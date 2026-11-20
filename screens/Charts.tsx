import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { NeoCard } from '../components/NeoCard';
import { useAppContext } from '../context/AppContext';
import { CategoryBreakdown } from '../components/Charts/CategoryBreakdown';
import { TrendChart } from '../components/Charts/TrendChart';
import { NetWorthChart, type NWPoint } from '../components/Charts/NetWorthChart';
import {
  dailySeries, monthlySeries, monthRange, netWorthSeries, totalsByCategory, yearRange,
} from '../utils/calculations';
import { latestFx } from '../utils/entryUi';

type Tab = 'expense' | 'income' | 'trend' | 'networth';
const TABS: [Tab, string][] = [['expense', 'Expenses'], ['income', 'Income'], ['trend', 'Trend'], ['networth', 'Net worth']];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const endOf = (d: Date) => new Date(d.getTime() - 1); // last ms before d

export const Charts: React.FC = () => {
  const { entries, categories, accounts, loading } = useAppContext();
  const today = new Date();
  const [tab, setTab] = useState<Tab>('expense');
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState<number | null>(today.getMonth()); // null = whole year

  const range = useMemo(() => (month === null ? yearRange(year) : monthRange(year, month)), [year, month]);
  const isCurrent = year === today.getFullYear() && (month === null || month === today.getMonth());
  const step = (dir: -1 | 1) => {
    if (month === null) return setYear(year + dir);
    const d = new Date(year, month + dir, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };
  const switchTo = (m: boolean) => setMonth(m ? (year === today.getFullYear() ? today.getMonth() : 0) : null);

  const data = useMemo(() => {
    const now = new Date(); // re-read on every entries refresh, so the "now" point includes just-recorded entries
    const cats = (k: 'expense' | 'income') => totalsByCategory(entries, k, range);
    const series = month === null ? monthlySeries(entries, year) : dailySeries(entries, year, month);
    const elapsed = Math.ceil((Math.min(now.getTime(), range.to.getTime()) - range.from.getTime()) / 86_400_000);
    // Net worth: opening value (before the period) + one point per month-end (year) or day-end (month), none in the future.
    const ends: { at: Date; label: string }[] = [];
    if (month === null) for (let m = 0; m < 12; m++) ends.push({ at: endOf(new Date(year, m + 1, 1)), label: MONTHS[m] });
    else for (let d = 1; d <= new Date(year, month + 1, 0).getDate(); d++) ends.push({ at: endOf(new Date(year, month, d + 1)), label: String(d) });
    const past = ends.filter((e) => e.at.getTime() <= now.getTime());
    // keep the period containing "now" (its end is in the future) so the latest point shows current value
    const cur = ends.find((e) => e.at.getTime() > now.getTime());
    const pts = cur && range.from.getTime() <= now.getTime() ? [...past, { ...cur, at: now }] : past;
    const nw = netWorthSeries(accounts, entries, [endOf(range.from), ...pts.map((p) => p.at)], latestFx(entries));
    const points: NWPoint[] = nw.map((p, i) => ({ label: i === 0 ? '' : pts[i - 1].label, value: p.value }));
    return { expense: cats('expense'), income: cats('income'), series, elapsed, points };
  }, [entries, accounts, year, month, range]);

  const title = month === null ? String(year) : `${MONTHS[month]} ${year}`;
  const arrow = 'w-11 h-11 bg-white dark:bg-zinc-900 border-2 border-black shadow-neo-sm flex items-center justify-center active:shadow-neo-pressed disabled:opacity-30 text-black dark:text-zinc-100';

  return (
    <div className="min-h-screen pb-28 bg-neo-bg dark:bg-zinc-950 text-black dark:text-zinc-100">
      <header className="sticky top-0 z-20 bg-neo-bg/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b-2 border-black px-5 py-4">
        <h1 className="text-3xl font-black uppercase leading-none">Charts</h1>
      </header>
      <div className="max-w-md mx-auto p-5 space-y-4">

      <div className="flex items-center gap-2">
        <button className={arrow} onClick={() => step(-1)} aria-label="Previous period"><ChevronLeft /></button>
        <div className="flex-1 text-center font-black text-lg">{title}</div>
        <button className={arrow} onClick={() => step(1)} disabled={isCurrent} aria-label="Next period"><ChevronRight /></button>
      </div>

      <div className="grid grid-cols-2 border-2 border-black shadow-neo-sm bg-white dark:bg-zinc-900" role="tablist" aria-label="Period type">
        {([true, false] as const).map((m) => (
          <button
            key={String(m)}
            role="tab"
            aria-selected={(month !== null) === m}
            onClick={() => switchTo(m)}
            className={`py-2 font-bold ${(month !== null) === m ? 'bg-neo-yellow text-black' : ''}`}
          >
            {m ? 'Month' : 'Year'}
          </button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4" role="tablist" aria-label="Chart type">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`shrink-0 px-3 py-2 border-2 border-black font-bold text-sm ${tab === k ? 'bg-neo-yellow text-black shadow-neo-sm' : 'bg-white dark:bg-zinc-900'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && entries.length === 0 ? (
        <NeoCard className="h-56 animate-pulse" />
      ) : tab === 'expense' || tab === 'income' ? (
        <CategoryBreakdown kind={tab} rows={data[tab]} entries={entries} categories={categories} range={range} />
      ) : tab === 'trend' ? (
        <TrendChart series={data.series} daily={month !== null} days={data.elapsed} />
      ) : (
        <NetWorthChart points={data.points} hasData={accounts.length > 0 || entries.length > 0} table={month === null} />
      )}
      </div>
    </div>
  );
};
