import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { NeoModal } from '../NeoModal';
import { NeoButton } from '../NeoButton';

interface DateRangePickerProps {
  startDate: string | null;
  endDate: string | null;
  onSelect: (start: string | null, end: string | null) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onSelect,
  isOpen,
  onClose,
}) => {
  const [viewDate, setViewDate] = useState(() => {
    if (startDate) return new Date(startDate);
    if (endDate) return new Date(endDate);
    return new Date();
  });

  const [pickingField, setPickingField] = useState<'start' | 'end'>('start');

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1));
  };

  const handleDayClick = (d: Date) => {
    const dateStr = d.toISOString().split('T')[0];
    if (pickingField === 'start') {
      onSelect(dateStr, null);
      setPickingField('end');
    } else {
      onSelect(startDate, dateStr);
      setPickingField('start');
    }
  };

  const isSelected = (d: Date) => {
    const s = startDate ? new Date(startDate) : null;
    const e = endDate ? new Date(endDate) : null;
    if (!s) return false;
    const ds = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const ss = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    if (ds.getTime() === ss.getTime()) return true;
    if (e && ds.getTime() === new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime()) return true;
    if (s && e && ds > ss && ds < new Date(e.getFullYear(), e.getMonth(), e.getDate())) return true;
    return false;
  };

  const isRangeStart = (d: Date) => {
    if (!startDate) return false;
    const ds = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const ss = new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth(), new Date(startDate).getDate());
    return ds.getTime() === ss.getTime();
  };

  const isRangeEnd = (d: Date) => {
    if (!endDate) return false;
    const ds = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const es = new Date(new Date(endDate).getFullYear(), new Date(endDate).getMonth(), new Date(endDate).getDate());
    return ds.getTime() === es.getTime();
  };

  return (
    <NeoModal
      isOpen={isOpen}
      onClose={onClose}
      title="Select Date Range"
    >
      <div className="space-y-4">
        {/* Field indicator */}
        <div className="flex gap-2">
          <button
            onClick={() => { setPickingField('start'); setViewDate(startDate ? new Date(startDate) : new Date()); }}
            className={`flex-1 py-2 px-3 rounded-md border-2 font-bold text-xs transition-all ${pickingField === 'start' ? 'bg-black text-white dark:bg-zinc-100 dark:text-black border-black' : 'bg-white dark:bg-zinc-800 text-black dark:text-zinc-100 border-black/30 hover:border-black'}`}
          >
            Start: {startDate ? new Date(startDate).toLocaleDateString() : 'Not set'}
          </button>
          <button
            onClick={() => { setPickingField('end'); setViewDate(endDate ? new Date(endDate) : (startDate ? new Date(startDate) : new Date())); }}
            className={`flex-1 py-2 px-3 rounded-md border-2 font-bold text-xs transition-all ${pickingField === 'end' ? 'bg-black text-white dark:bg-zinc-100 dark:text-black border-black' : 'bg-white dark:bg-zinc-800 text-black dark:text-zinc-100 border-black/30 hover:border-black'}`}
          >
            End: {endDate ? new Date(endDate).toLocaleDateString() : 'Not set'}
          </button>
        </div>

        {/* Calendar Header */}
        <div className="flex items-center justify-between bg-gray-50 dark:bg-zinc-800 border-2 border-black p-2">
          <button
            onClick={handlePrevMonth}
            className="w-8 h-8 flex items-center justify-center hover:bg-white dark:hover:bg-zinc-700 border border-transparent hover:border-black dark:hover:border-zinc-500 transition-all dark:text-zinc-100"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="font-black uppercase text-sm tracking-tight dark:text-zinc-100">
            {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </span>
          <button
            onClick={handleNextMonth}
            className="w-8 h-8 flex items-center justify-center hover:bg-white dark:hover:bg-zinc-700 border border-transparent hover:border-black dark:hover:border-zinc-500 transition-all dark:text-zinc-100"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
            <div key={day} className="text-center text-[10px] font-black text-gray-400 dark:text-zinc-500 pb-2">{day}</div>
          ))}

          {Array.from({ length: getFirstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth()) }).map((_, i) => (
            <div key={`empty-${i}`} className="h-10 w-10" />
          ))}

          {Array.from({ length: getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth()) }).map((_, i) => {
            const day = i + 1;
            const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
            const dateStr = d.toISOString().split('T')[0];
            const todayStr = new Date().toISOString().split('T')[0];
            const isToday = dateStr === todayStr;
            const isInRange = isSelected(d);
            const isStart = isRangeStart(d);
            const isEnd = isRangeEnd(d);
            const isFuture = d > new Date();

            let cls = 'border-transparent';
            if (isStart || isEnd) {
              cls = 'bg-neo-yellow border-black shadow-neo-sm text-black font-black';
            } else if (isInRange) {
              cls = 'bg-neo-yellow/30 border-transparent dark:bg-zinc-700';
            } else if (isToday) {
              cls = 'border-neo-blue text-neo-blue';
            } else if (isFuture) {
              cls = 'text-gray-200 dark:text-zinc-800 border-transparent cursor-not-allowed';
            } else {
              cls = 'border-transparent hover:border-black dark:hover:border-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 dark:text-zinc-100';
            }

            return (
              <button
                key={day}
                disabled={isFuture}
                onClick={() => !isFuture && handleDayClick(d)}
                className={`h-10 w-10 flex items-center justify-center font-bold text-xs transition-all border-2 rounded-none first:rounded-l-md last:rounded-r-md ${cls}`}
              >
                {day}
              </button>
            );
          })}
        </div>

        <div className="flex gap-3">
          <NeoButton
            fullWidth
            onClick={() => { onSelect(null, null); onClose(); }}
            variant="neutral"
          >
            Clear
          </NeoButton>
          <NeoButton
            fullWidth
            onClick={onClose}
            variant="accent"
          >
            Done
          </NeoButton>
        </div>
      </div>
    </NeoModal>
  );
};
