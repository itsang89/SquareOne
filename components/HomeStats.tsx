import React, { useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { monthRange, rangeTotals } from '../utils/calculations';
import { formatCurrency } from '../utils/formatters';

/**
 * Slot on Home for the stats widgets (phase 2b replaces this file's body).
 * Placeholder: this month's spent / income / net.
 */
export const HomeStats: React.FC = () => {
  const { entries } = useAppContext();
  const t = useMemo(() => {
    const now = new Date();
    return rangeTotals(entries, monthRange(now.getFullYear(), now.getMonth()));
  }, [entries]);
  return (
    <section className="grid grid-cols-3 gap-2" aria-label="This month">
      {[
        { label: 'Spent', value: t.expense, color: 'bg-neo-pink' },
        { label: 'Income', value: t.income, color: 'bg-neo-green' },
        { label: 'Net', value: t.net, color: 'bg-neo-yellow' },
      ].map(({ label, value, color }) => (
        <div key={label} className={`${color} border-2 border-black shadow-neo-sm p-3 text-black`}>
          <p className="text-[10px] font-black uppercase tracking-widest text-black/70">{label}</p>
          <p className="font-black text-lg leading-tight break-all">{formatCurrency(value)}</p>
        </div>
      ))}
    </section>
  );
};
