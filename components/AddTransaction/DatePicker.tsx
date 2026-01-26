import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { formatDate } from '../../utils/formatters';
import { NeoModal } from '../NeoModal';
import { NeoButton } from '../NeoComponents';

interface DatePickerProps {
  selectedDate: string;
  onSelect: (date: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  selectedDate,
  onSelect,
  isOpen,
  onClose,
}) => {
  const [viewDate, setViewDate] = useState(new Date(selectedDate));

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    const nextMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1);
    if (nextMonth <= new Date()) {
      setViewDate(nextMonth);
    }
  };

  return (
    <NeoModal
      isOpen={isOpen}
      onClose={onClose}
      title="Select Date"
    >
      <div className="space-y-4">
        {/* Calendar Header */}
        <div className="flex items-center justify-between bg-gray-50 border-2 border-black p-2">
          <button 
            onClick={handlePrevMonth}
            className="w-8 h-8 flex items-center justify-center hover:bg-white border border-transparent hover:border-black transition-all"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="font-black uppercase text-sm tracking-tight">
            {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </span>
          <button 
            onClick={handleNextMonth}
            disabled={new Date(viewDate.getFullYear(), viewDate.getMonth() + 1) > new Date()}
            className="w-8 h-8 flex items-center justify-center hover:bg-white border border-transparent hover:border-black transition-all disabled:opacity-20"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
            <div key={day} className="text-center text-[10px] font-black text-gray-400 pb-2">{day}</div>
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
            const isSelected = dateStr === selectedDate;
            const isFuture = d > new Date();
            
            return (
              <button
                key={day}
                disabled={isFuture}
                onClick={() => onSelect(dateStr)}
                className={`h-10 w-10 flex items-center justify-center font-bold text-xs transition-all border-2 
                  ${isSelected 
                    ? 'bg-neo-yellow border-black shadow-neo-sm -translate-y-0.5' 
                    : isToday 
                      ? 'border-neo-blue text-neo-blue' 
                      : isFuture 
                        ? 'text-gray-200 border-transparent cursor-not-allowed' 
                        : 'border-transparent hover:border-black hover:bg-gray-50'
                  }`}
              >
                {day}
              </button>
            );
          })}
        </div>

        <div className="flex gap-3">
          <NeoButton 
            fullWidth 
            onClick={() => onSelect(new Date().toISOString().split('T')[0])} 
            variant="accent"
          >
            Today
          </NeoButton>
          <NeoButton 
            fullWidth 
            onClick={onClose} 
            variant="neutral"
          >
            Cancel
          </NeoButton>
        </div>
      </div>
    </NeoModal>
  );
};
