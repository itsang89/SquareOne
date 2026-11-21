import React from 'react';

interface ChipProps {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string;
  className?: string;
}

/** Selectable pill used for kinds, accounts, friends and filters. */
export const Chip: React.FC<ChipProps> = ({ active, onClick, children, color = 'bg-neo-yellow', className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`shrink-0 px-3 py-2 border-2 border-black text-sm font-bold flex items-center gap-2 transition-all ${
      active ? `${color} shadow-neo-sm text-black` : 'bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-400 hover:border-black'
    } ${className}`}
  >
    {children}
  </button>
);

export const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-xs font-bold uppercase tracking-widest text-gray-600 dark:text-zinc-400 mb-2">{children}</label>
);

export const SELECT_CLASS =
  'w-full border-2 border-black p-3 font-bold bg-white dark:bg-zinc-900 dark:text-zinc-100 focus:outline-none focus:shadow-neo-sm';
