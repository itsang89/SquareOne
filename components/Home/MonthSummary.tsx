import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { NeoCard } from '../NeoCard';
import { useAppContext } from '../../context/AppContext';
import { categoryName, monthRange, pctChange, rangeTotals, totalsByCategory } from '../../utils/calculations';
import { hkd } from '../Charts/format';

const KEY = 'squareone_month_summary_collapsed';

/** Monthly recap: spent vs last month and top categories (→ /charts). Collapses to one row; choice is remembered. */
export const MonthSummary: React.FC = () => {
  const { entries, categories } = useAppContext();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(KEY) === '1');
  const toggle = () => setCollapsed((c) => { localStorage.setItem(KEY, c ? '0' : '1'); return !c; });
  const now = new Date();
  const cur = rangeTotals(entries, monthRange(now.getFullYear(), now.getMonth()));
  // Compare like for like: last month up to the same day, not the full month.
  const prevMonth = monthRange(now.getFullYear(), now.getMonth() - 1);
  const sameDay = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate() + 1);
  const prev = rangeTotals(entries, { from: prevMonth.from, to: sameDay < prevMonth.to ? sameDay : prevMonth.to });
  const diff = cur.expense - prev.expense;
  const pct = pctChange(cur.expense, prev.expense);
  const top = totalsByCategory(entries, 'expense', monthRange(now.getFullYear(), now.getMonth())).slice(0, 3);
  const label = 'text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-zinc-400';

  return (
    <NeoCard color="bg-white dark:bg-zinc-900 text-black dark:text-zinc-100" className="space-y-3">
      <button type="button" onClick={toggle} aria-expanded={!collapsed} className="w-full flex items-center justify-between gap-2 text-left">
        <span className="text-xs font-black uppercase tracking-wider">This month</span>
        <span className="flex items-center gap-2">
          {collapsed && <span className="font-black">{hkd(cur.expense)} spent</span>}
          <ChevronDown size={18} aria-hidden="true" className={`transition-transform ${collapsed ? '-rotate-90' : ''}`} />
        </span>
      </button>
      {!collapsed && (
      <Link to="/charts" aria-label="Open charts" className="block space-y-3">
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
      )}
    </NeoCard>
  );
};
