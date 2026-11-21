import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const pad = (n: number) => String(n).padStart(2, '0');

/** Month grid in the app's style. `value` / `today` are local YYYY-MM-DD. */
export const DatePicker: React.FC<{ value: string; today: string; onPick: (day: string) => void }> = ({ value, today, onPick }) => {
  const [year, setYear] = useState(() => Number(value.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(value.slice(5, 7)) - 1); // 0-11
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }); }, []);
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // Monday-first
  const days = new Date(year, month + 1, 0).getDate();
  const shift = (d: number) => {
    const m = new Date(year, month + d, 1);
    setYear(m.getFullYear());
    setMonth(m.getMonth());
  };

  return (
    <div ref={ref} className="mt-3 border-2 border-black bg-white dark:bg-zinc-900 p-3 shadow-neo-sm">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => shift(-1)} aria-label="Previous month" className="p-1 border-2 border-black dark:text-zinc-100"><ChevronLeft size={18} /></button>
        <span className="font-black uppercase text-sm dark:text-zinc-100">
          {first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </span>
        <button type="button" onClick={() => shift(1)} aria-label="Next month" className="p-1 border-2 border-black dark:text-zinc-100"><ChevronRight size={18} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w, i) => <span key={i} className="text-[10px] font-black text-gray-600 dark:text-zinc-400">{w}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={`x${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const day = `${year}-${pad(month + 1)}-${pad(i + 1)}`;
          const selected = day === value;
          return (
            <button
              key={day}
              type="button"
              onClick={() => onPick(day)}
              aria-pressed={selected}
              aria-label={day}
              className={`h-9 text-sm font-bold border-2 ${
                selected ? 'bg-neo-yellow border-black shadow-neo-sm text-black'
                : day === today ? 'border-black dark:text-zinc-100'
                : 'border-transparent hover:border-black dark:text-zinc-100'
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
};
