import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import type { Category } from '../../types';
import { CategoryTile } from '../CategoryTile';

interface Props {
  categories: Category[]; // already most-used first
  selectedId?: string;
  onSelect: (id: string) => void;
  /** Create a category; resolves to its id. */
  onCreate: (name: string) => Promise<string | undefined>;
}

const VISIBLE = 11;

export const CategoryGrid: React.FC<Props> = ({ categories, selectedId, onSelect, onCreate }) => {
  const [all, setAll] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const shown = all ? categories : categories.slice(0, VISIBLE);
  // A selected category beyond the cut stays visible.
  const picked = categories.find((c) => c.id === selectedId);
  if (picked && !shown.includes(picked)) shown.push(picked);

  const create = async () => {
    if (!name.trim()) return;
    const id = await onCreate(name);
    if (id) {
      onSelect(id);
      setName('');
      setAdding(false);
    }
  };

  return (
    <div>
      <div className="grid grid-cols-4 gap-2">
        {shown.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            aria-pressed={c.id === selectedId}
            className={`flex flex-col items-center justify-center gap-1 py-2 px-1 border-2 border-black min-h-[68px] ${
              c.id === selectedId ? 'shadow-neo-sm -translate-y-0.5 bg-neo-yellow' : 'bg-white dark:bg-zinc-900'
            }`}
          >
            <CategoryTile category={c} size="sm" />
            <span className={`text-[10px] font-bold uppercase leading-tight text-center truncate w-full ${c.id === selectedId ? 'text-black' : 'dark:text-zinc-100'}`}>{c.name}</span>
          </button>
        ))}
        {!all && categories.length > VISIBLE && (
          <button type="button" onClick={() => setAll(true)} className="border-2 border-dashed border-black text-[10px] font-black uppercase dark:text-zinc-100">
            All {categories.length}
          </button>
        )}
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          aria-label="New category"
          className="border-2 border-dashed border-black flex flex-col items-center justify-center gap-1 min-h-[68px] dark:text-zinc-100"
        >
          <Plus size={20} />
          <span className="text-[10px] font-bold uppercase">New</span>
        </button>
      </div>
      {adding && (
        <div className="flex gap-2 mt-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void create()}
            placeholder="Category name"
            className="flex-1 border-2 border-black p-2 font-bold bg-white dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button type="button" onClick={() => void create()} className="px-4 border-2 border-black bg-neo-green font-black uppercase text-sm shadow-neo-sm">
            Add
          </button>
        </div>
      )}
    </div>
  );
};
