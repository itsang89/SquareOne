import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { NeoCard } from '../NeoCard';
import { useAppContext } from '../../context/AppContext';
import { categoryName, monthRange, pctChange, rangeTotals, subscriptionsDue, totalsByCategory } from '../../utils/calculations';
import { hkd } from '../Charts/format';
import { formatCurrency } from '../../utils/formatters';

/** Monthly recap: spent vs last month, top categories (→ /charts), subscriptions due in 7 days (→ /subscriptions). */
export const MonthSummary: React.FC = () => {
  const { entries, categories, subscriptions } = useAppContext();
  const now = new Date();
  const cur = rangeTotals(entries, monthRange(now.getFullYear(), now.getMonth()));
  // Compare like for like: last month up to the same day, not the full month.
  const prevMonth = monthRange(now.getFullYear(), now.getMonth() - 1);
  const sameDay = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate() + 1);
  const prev = rangeTotals(entries, { from: prevMonth.from, to: sameDay < prevMonth.to ? sameDay : prevMonth.to });
  const diff = cur.expense - prev.expense;
  const pct = pctChange(cur.expense, prev.expense);
  const top = totalsByCategory(entries, 'expense', monthRange(now.getFullYear(), now.getMonth())).slice(0, 3);
  const due = subscriptionsDue(subscriptions, now);
  const label = 'text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-zinc-400';

  return (
    <NeoCard color="bg-white dark:bg-zinc-900 text-black dark:text-zinc-100" className="space-y-3">
      <Link to="/charts" aria-label="Open charts" className="block space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider">This month</span>
          <ChevronRight size={18} />
        </div>
        <div>
          <div className={label}>You spent</div>
          <div className="text-3xl font-black">{hkd(cur.expense)}</div>
          {prev.expense > 0 && (
            <div className="text-sm font-medium text-gray-600 dark:text-zinc-400">
              {diff === 0 ? 'Same as' : `${hkd(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'} than`} this time last month
              {pct !== null && diff !== 0 && <span className={`font-black ml-1 ${diff > 0 ? 'text-neo-danger' : 'text-neo-greenDark'}`}>({pct > 0 ? '+' : ''}{pct}%)</span>}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 border-t-2 border-black pt-3">
          <div><div className={label}>Income</div><div className="font-black text-neo-greenDark">{hkd(cur.income)}</div></div>
          <div><div className={label}>Income − spent</div><div className={`font-black ${cur.net < 0 ? 'text-neo-danger' : 'text-neo-greenDark'}`}>{hkd(cur.net, true)}</div></div>
        </div>
        {top.length > 0 && (
          <div className="border-t-2 border-black pt-3">
            <div className={label}>Top categories</div>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {top.map((t) => (
                <div key={t.categoryId ?? 'none'} className="min-w-0">
                  <div className="text-xs font-bold truncate">{categoryName(categories, t.categoryId)}</div>
                  <div className="font-black text-sm">{hkd(t.total)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Link>
      {due.length > 0 && (
        <Link to="/subscriptions" aria-label="Open subscriptions" className="block border-t-2 border-black pt-3">
          <div className={label}>Due in 7 days</div>
          {due.slice(0, 2).map((s) => (
            <div key={s.id} className="flex items-baseline justify-between gap-2 text-sm font-bold">
              <span className="truncate">{s.title} <span className="font-medium text-gray-600 dark:text-zinc-400">· {new Date(`${s.nextDate}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span></span>
              <span className="tabular-nums shrink-0">{formatCurrency(s.amount, s.currency)}</span>
            </div>
          ))}
          {due.length > 2 && <div className="text-xs font-bold text-gray-600 dark:text-zinc-400">+{due.length - 2} more</div>}
        </Link>
      )}
    </NeoCard>
  );
};
