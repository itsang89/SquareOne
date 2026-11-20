import React, { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { ChevronDown } from 'lucide-react';
import { NeoCard } from '../NeoCard';
import { useReducedMotion } from '../../hooks/useAnimations';
import { categoryEntries, categoryName, incomeAmount, myExpense, type DateRange } from '../../utils/calculations';
import { formatDate } from '../../utils/formatters';
import type { Category, CategoryKind, Entry } from '../../types';
import type { CategoryTotal } from '../../utils/calculations';
import { hkd, INCOME_PALETTE, PALETTE, UNCAT_COLOR } from './format';

interface Props {
  kind: CategoryKind;
  rows: CategoryTotal[];
  entries: Entry[];
  categories: Category[];
  range: DateRange;
}

export const CategoryBreakdown: React.FC<Props> = ({ kind, rows, entries, categories, range }) => {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState<string | null | undefined>(undefined); // undefined = none open
  const total = rows.reduce((s, r) => s + r.total, 0);
  const pal = kind === 'income' ? INCOME_PALETTE : PALETTE;
  const color = (r: CategoryTotal, i: number) => (r.categoryId ? pal[i % pal.length] : UNCAT_COLOR);

  if (rows.length === 0) {
    return (
      <NeoCard className="text-center py-10">
        <p className="font-bold">No {kind === 'expense' ? 'expenses' : 'income'} in this period</p>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
          Tap the + button to log {kind === 'expense' ? 'a purchase' : 'some income'}, or switch period above.
        </p>
      </NeoCard>
    );
  }

  return (
    <div className="space-y-4">
      <NeoCard className="relative h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows.map((r) => ({ ...r }))}
              dataKey="total"
              startAngle={90}
              endAngle={-270}
              innerRadius="62%"
              outerRadius="95%"
              stroke="#000"
              strokeWidth={2}
              isAnimationActive={!reduced}
              onClick={(d) => setOpen((d as unknown as CategoryTotal).categoryId)}
            >
              {rows.map((r, i) => (
                <Cell key={r.categoryId ?? 'none'} fill={color(r, i)} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xs font-bold uppercase text-gray-500 dark:text-zinc-400">
            {kind === 'expense' ? 'Spent' : 'Earned'}
          </span>
          <span className="text-2xl font-black">{hkd(total)}</span>
        </div>
      </NeoCard>

      <NeoCard className="p-0 divide-y-2 divide-black">
        {rows.map((r, i) => {
          const isOpen = open === r.categoryId;
          const list = isOpen ? categoryEntries(entries, kind, r.categoryId, range) : [];
          return (
            <div key={r.categoryId ?? 'none'}>
              <button
                className="w-full flex items-center gap-3 p-3 text-left active:bg-gray-100 dark:active:bg-zinc-800"
                onClick={() => setOpen(isOpen ? undefined : r.categoryId)}
                aria-expanded={isOpen}
              >
                <span className="w-4 h-4 border-2 border-black shrink-0" style={{ background: color(r, i) }} />
                <span className="flex-1 font-bold truncate">{categoryName(categories, r.categoryId)}</span>
                <span className="text-xs font-bold text-gray-500 dark:text-zinc-400">{r.percent}%</span>
                <span className="font-black tabular-nums">{hkd(r.total)}</span>
                <ChevronDown size={16} className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <ul className="bg-gray-50 dark:bg-zinc-800 border-t-2 border-black px-3 py-1">
                  {list.map((e) => (
                    <li key={e.id} className="flex items-center gap-2 py-2 text-sm">
                      <span className="w-14 shrink-0 text-xs text-gray-500 dark:text-zinc-400">
                        {formatDate(e.occurredAt, 'short')}
                      </span>
                      <span className="flex-1 truncate">{e.title || '—'}</span>
                      <span className="font-bold tabular-nums">{hkd(kind === 'expense' ? myExpense(e) : incomeAmount(e))}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </NeoCard>
    </div>
  );
};
