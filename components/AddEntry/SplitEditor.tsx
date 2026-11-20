import React from 'react';
import type { Friend } from '../../types';
import { Avatar } from '../Avatar';
import { Chip } from '../Chip';
import { formatCurrency } from '../../utils/formatters';

export type SplitMode = 'equal' | 'custom';

interface Props {
  friends: Friend[];
  ids: string[];
  onToggle: (id: string) => void;
  mode: SplitMode;
  onMode: (m: SplitMode) => void;
  /** Custom amounts as typed, by friend id. */
  custom: Record<string, string>;
  onCustom: (id: string, value: string) => void;
  /** Resolved equal share per friend. */
  each: number;
  mine: number;
  owe: number;
  currency: string;
}

export const SplitEditor: React.FC<Props> = ({ friends, ids, onToggle, mode, onMode, custom, onCustom, each, mine, owe, currency }) => (
  <div className="border-2 border-black bg-white dark:bg-zinc-900 p-3 space-y-3 shadow-neo-sm">
    {friends.length === 0 ? (
      <p className="text-xs font-bold uppercase text-gray-600">No friends yet. Add one in Friends first.</p>
    ) : (
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {friends.map((f) => (
          <Chip key={f.id} active={ids.includes(f.id)} onClick={() => onToggle(f.id)} color="bg-neo-orange">
            <Avatar src={f.avatar} alt={f.name} size="sm" />
            {f.name.split(' ')[0]}
          </Chip>
        ))}
      </div>
    )}
    {ids.length > 0 && (
      <>
        <div className="grid grid-cols-2 gap-2">
          <Chip active={mode === 'equal'} onClick={() => onMode('equal')} className="justify-center">Split equally</Chip>
          <Chip active={mode === 'custom'} onClick={() => onMode('custom')} className="justify-center">Custom amounts</Chip>
        </div>
        <ul className="space-y-2">
          {ids.map((id) => {
            const f = friends.find((x) => x.id === id);
            return (
              <li key={id} className="flex items-center gap-3">
                <span className="flex-1 font-bold text-sm truncate dark:text-zinc-100">{f?.name}</span>
                {mode === 'equal' ? (
                  <span className="font-black dark:text-zinc-100">{formatCurrency(each, currency)}</span>
                ) : (
                  <input
                    inputMode="decimal"
                    aria-label={`${f?.name} owes`}
                    value={custom[id] ?? ''}
                    onChange={(e) => onCustom(id, e.target.value.replace(/[^0-9.]/g, ''))}
                    className="w-28 border-2 border-black p-2 text-right font-bold bg-white dark:bg-zinc-800 dark:text-zinc-100"
                  />
                )}
              </li>
            );
          })}
        </ul>
        <div className="grid grid-cols-2 gap-2 pt-2 border-t-2 border-black text-center">
          <div>
            <p className="text-[10px] font-black uppercase text-gray-600">Your share</p>
            <p className={`font-black ${mine < 0 ? 'text-neo-danger' : 'dark:text-zinc-100'}`}>{formatCurrency(mine, currency)}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-gray-600">Friends owe you</p>
            <p className="font-black text-neo-greenDark">{formatCurrency(owe, currency)}</p>
          </div>
        </div>
      </>
    )}
  </div>
);
