import React from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { NeoCard } from '../NeoCard';
import { useReducedMotion } from '../../hooks/useAnimations';
import type { SeriesPoint } from '../../utils/calculations';
import { compact, EXPENSE_COLOR, hkd, INCOME_COLOR } from './format';

interface Props {
  series: SeriesPoint[];
  daily: boolean; // true: keys are days, false: months
  /** Number of days that count for the per-day average (elapsed days). */
  days: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const TrendChart: React.FC<Props> = ({ series, daily, days }) => {
  const reduced = useReducedMotion();
  const income = series.reduce((s, p) => s + p.income, 0);
  const expense = series.reduce((s, p) => s + p.expense, 0);
  const label = (k: string) => (daily ? String(Number(k.slice(8))) : MONTHS[Number(k.slice(5)) - 1]);

  if (income === 0 && expense === 0) {
    return (
      <NeoCard className="text-center py-10">
        <p className="font-bold">Nothing to compare yet</p>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Log some income and expenses to see the trend.</p>
      </NeoCard>
    );
  }

  const stat = (name: string, v: number, cls = '') => (
    <div className="flex-1 min-w-0">
      <div className="text-[10px] font-bold uppercase text-gray-500 dark:text-zinc-400">{name}</div>
      <div className={`font-black truncate ${cls}`}>{hkd(v)}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <NeoCard className="grid grid-cols-2 gap-3">
        {stat('Income', income, 'text-neo-greenDark')}
        {stat('Spent', expense, 'text-neo-ink dark:text-zinc-100')}
        {stat('Net', income - expense)}
        {stat('Avg / day', expense / Math.max(days, 1))}
      </NeoCard>
      <NeoCard className="h-64 px-1 text-black dark:text-zinc-300">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" strokeOpacity={0.2} />
            <XAxis
              dataKey="key"
              tickFormatter={label}
              tick={{ fill: 'currentColor', fontSize: 10 }}
              interval={daily ? 4 : 0}
              tickLine={false}
            />
            <YAxis tickFormatter={compact} tick={{ fill: 'currentColor', fontSize: 10 }} tickLine={false} width={44} />
            <Tooltip
              formatter={(v) => hkd(Number(v))}
              labelFormatter={(k) => String(k)}
              contentStyle={{ border: '2px solid #000', borderRadius: 0, color: '#000' }}
            />
            <Bar dataKey="income" name="Income" fill={INCOME_COLOR} stroke="#000" isAnimationActive={!reduced} />
            <Bar dataKey="expense" name="Spent" fill={EXPENSE_COLOR} stroke="#000" isAnimationActive={!reduced} />
          </BarChart>
        </ResponsiveContainer>
      </NeoCard>
    </div>
  );
};
