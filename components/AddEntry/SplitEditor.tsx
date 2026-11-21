import React, { useState } from 'react';
import type { Friend } from '../../types';
import { Avatar } from '../Avatar';
import { Chip } from '../Chip';
import { formatCurrency } from '../../utils/formatters';
import { UserPlus } from 'lucide-react';

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
  /** Create a friend by name; resolves true on success. */
  onAddFriend: (name: string) => Promise<boolean>;
}

const COLLAPSED = 8; // friends shown before "show all"

export const SplitEditor: React.FC<Props> = ({ friends, ids, onToggle, mode, onMode, custom, onCustom, each, mine, owe, currency, onAddFriend }) => {
  const [expanded, setExpanded] = useState(false);
  const [newName, setNewName] = useState<string | null>(null); // null = add field closed
  const [saving, setSaving] = useState(false);
  // Collapsed: first N plus anything already picked, so a selection never hides.
  const shown = expanded ? friends : friends.filter((f, i) => i < COLLAPSED || ids.includes(f.id));
  const hidden = friends.length - shown.length;

  const add = async () => {
    const name = newName?.trim();
    if (!name || saving) return;
    setSaving(true);
    if (await onAddFriend(name)) setNewName(null);
    setSaving(false);
  };

  return (
  <div className="border-2 border-black bg-white dark:bg-zinc-900 p-3 space-y-3 shadow-neo-sm">
    <div className="flex flex-wrap gap-2">
      {shown.map((f) => (
        <Chip key={f.id} active={ids.includes(f.id)} onClick={() => onToggle(f.id)} color="bg-neo-orange">
          <Avatar src={f.avatar} alt={f.name} size="sm" />
          {f.name.split(' ')[0]}
        </Chip>
      ))}
      {(hidden > 0 || expanded) && friends.length > COLLAPSED && (
        <Chip onClick={() => setExpanded((v) => !v)} className="border-dashed">
          {expanded ? 'Show less' : `+${hidden} more`}
        </Chip>
      )}
      {newName === null && (
        <Chip onClick={() => setNewName('')} className="border-dashed">
          <UserPlus size={16} aria-hidden="true" /> New friend
        </Chip>
      )}
    </div>
    {newName !== null && (
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void add(); }}>
        <input
          autoFocus
          aria-label="New friend name"
          placeholder="Friend's name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setNewName(null)}
          className="flex-1 min-w-0 border-2 border-black p-2 font-bold bg-white dark:bg-zinc-800 dark:text-zinc-100"
        />
        <button type="submit" disabled={!newName.trim() || saving} className="px-3 border-2 border-black bg-neo-orange font-black uppercase text-xs disabled:opacity-50">
          {saving ? '…' : 'Add'}
        </button>
        <button type="button" onClick={() => setNewName(null)} aria-label="Cancel" className="px-2 border-2 border-black font-black dark:text-zinc-100">×</button>
      </form>
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
                    onChange={(e) => onCustom(id, e.target.value)}
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
        {mode === 'equal' && owe > 0 && mine !== each && (
          <p className="text-xs text-center text-gray-600 dark:text-zinc-400">Your share includes the rounding adjustment.</p>
        )}
      </>
    )}
  </div>
  );
};
