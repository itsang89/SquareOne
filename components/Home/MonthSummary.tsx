import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { NeoCard } from '../NeoCard';
import { useAppContext } from '../../context/AppContext';
import { monthRange, rangeTotals } from '../../utils/calculations';
import { hkd } from '../Charts/format';

/** This month's spent / income / net vs last month, plus what friends owe me. Taps through to /charts. */
export const MonthSummary: React.FC = () => {
  const { entries } = useAppContext();
  const now = new Date();
  const cur = rangeTotals(entries, monthRange(now.getFullYear(), now.getMonth()));
  // Compare like for like: last month up to the same day, not the full month.
  const prevMonth = monthRange(now.getFullYear(), now.getMonth() - 1);
  const sameDay = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate() + 1);
  const prev = rangeTotals(entries, { from: prevMonth.from, to: sameDay < prevMonth.to ? sameDay : prevMonth.to });
  const diff = cur.expense - prev.expense;

  return (
    <Link to="/charts" aria-label="Open charts" className="block">
      <NeoCard color="bg-white dark:bg-zinc-900 text-black dark:text-zinc-100" className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider">This month</span>
          <ChevronRight size={18} />
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-zinc-400">You spent</div>
          <div className="text-3xl font-black">{hkd(cur.expense)}</div>
          {prev.expense > 0 && (
            <div className="text-sm font-medium text-gray-600 dark:text-zinc-400">
              {diff === 0 ? 'Same as' : `${hkd(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'} than`} this time last month
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 border-t-2 border-black dark:border-zinc-600 pt-3">
          <div><div className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-zinc-400">Income</div><div className="font-black text-neo-greenDark">{hkd(cur.income)}</div></div>
          <div><div className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-zinc-400">Income − spent</div><div className={`font-black ${cur.net < 0 ? 'text-neo-danger' : 'text-neo-greenDark'}`}>{hkd(cur.net, true)}</div></div>
        </div>
      </NeoCard>
    </Link>
  );
};
