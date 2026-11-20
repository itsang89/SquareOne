import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { NeoCard } from '../NeoCard';
import { useAppContext } from '../../context/AppContext';
import { monthRange, rangeTotals, totalOwed } from '../../utils/calculations';
import { hkd } from '../Charts/format';

/** This month's spent / income / net vs last month, plus what friends owe me. Taps through to /charts. */
export const MonthSummary: React.FC = () => {
  const { entries } = useAppContext();
  const now = new Date();
  const cur = rangeTotals(entries, monthRange(now.getFullYear(), now.getMonth()));
  const prev = rangeTotals(entries, monthRange(now.getFullYear(), now.getMonth() - 1));
  const owed = totalOwed(entries);
  const diff = cur.expense - prev.expense;

  return (
    <Link to="/charts" aria-label="Open charts">
      <NeoCard color="bg-neo-yellow text-black" className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider">This month</span>
          <ChevronRight size={18} />
        </div>
        <div>
          <div className="text-xs font-bold uppercase opacity-70">Spent</div>
          <div className="text-3xl font-black">{hkd(cur.expense)}</div>
          {prev.expense > 0 && (
            <div className="text-xs font-bold">
              {diff === 0 ? 'Same as' : `${hkd(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'} than`} last month
            </div>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 border-t-2 border-black pt-3">
          <div><div className="text-[10px] font-bold uppercase opacity-70">Income</div><div className="font-black">{hkd(cur.income)}</div></div>
          <div><div className="text-[10px] font-bold uppercase opacity-70">Net</div><div className="font-black">{hkd(cur.net, true)}</div></div>
          <div><div className="text-[10px] font-bold uppercase opacity-70">Friends owe</div><div className="font-black">{hkd(owed)}</div></div>
        </div>
      </NeoCard>
    </Link>
  );
};
