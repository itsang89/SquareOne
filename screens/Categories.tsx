import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { BackButton } from '../components/BackButton';
import { NeoButton } from '../components/NeoButton';
import { NeoInput } from '../components/NeoInput';
import { NeoModal } from '../components/NeoModal';
import { Chip, FieldLabel } from '../components/Chip';
import { useAppContext } from '../context/AppContext';
import { useToast } from '../components/ToastContext';
import { categoriesByUse, CATEGORY_COLORS, CATEGORY_EMOJI, NO_COLOR } from '../utils/entryUi';
import type { Category, CategoryKind } from '../types';

export const Categories: React.FC = () => {
  const { categories, entries, addCategory, updateCategory, isProcessing } = useAppContext();
  const { success, error: showError } = useToast();
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState<string | undefined>();

  const list = categoriesByUse(categories, entries, kind, showArchived);
  const archivedCount = categories.filter((c) => c.kind === kind && c.archived).length;

  const open = (c: Category | 'new') => {
    setEditing(c);
    setName(c === 'new' ? '' : c.name);
    setIcon(c === 'new' ? '' : c.icon ?? '');
    setColor(c === 'new' ? CATEGORY_COLORS[0] : c.color);
  };

  const done = (r: { success: boolean; error?: Error }, msg: string) => {
    if (r.success) { success(msg); setEditing(null); } else showError('Could not save category', r.error?.message);
  };

  const save = async () => {
    if (!name.trim() || !editing) return;
    const fields = { name, icon: icon.trim() || undefined, color };
    done(editing === 'new' ? await addCategory({ ...fields, kind }) : await updateCategory(editing.id, fields), 'Category saved');
  };

  return (
    <div className="min-h-screen pb-28 bg-neo-bg dark:bg-zinc-950">
      <header className="sticky top-0 z-20 bg-neo-bg/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b-2 border-black px-5 py-3 flex items-center justify-between">
        <BackButton to="/profile" />
        <h1 className="text-lg font-black uppercase tracking-widest dark:text-zinc-100">Categories</h1>
        <button type="button" onClick={() => open('new')} aria-label="Add category" className="w-10 h-10 bg-neo-yellow border-2 border-black shadow-neo-sm grid place-items-center"><Plus size={20} /></button>
      </header>

      <main className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Chip active={kind === 'expense'} onClick={() => setKind('expense')} color="bg-neo-pink" className="justify-center">Expense</Chip>
          <Chip active={kind === 'income'} onClick={() => setKind('income')} color="bg-neo-green" className="justify-center">Income</Chip>
        </div>

        <ul className="border-2 border-black shadow-neo-sm divide-y-2 divide-black/10 bg-white dark:bg-zinc-900">
          {list.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => open(c)} className={`w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-zinc-800 ${c.archived ? 'opacity-50' : ''}`}>
                <span className="w-10 h-10 border-2 border-black grid place-items-center text-lg" style={{ backgroundColor: c.color ?? NO_COLOR }}>{c.icon || '🏷️'}</span>
                <span className="flex-1 font-bold dark:text-zinc-100">{c.name}</span>
                {c.archived && <span className="text-[10px] font-black uppercase text-gray-400">archived</span>}
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="p-6 text-center font-black uppercase text-gray-400">No categories</li>}
        </ul>

        {archivedCount > 0 && (
          <button type="button" onClick={() => setShowArchived((v) => !v)} className="text-xs font-black uppercase underline dark:text-zinc-100">
            {showArchived ? 'Hide' : 'Show'} archived ({archivedCount})
          </button>
        )}
      </main>

      <NeoModal isOpen={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? `New ${kind} category` : 'Edit category'}>
        <NeoInput label="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <FieldLabel>Icon (emoji)</FieldLabel>
        <input
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          aria-label="Icon"
          maxLength={8}
          className="w-full border-2 border-black p-3 font-bold text-xl bg-white dark:bg-zinc-900 mb-2"
        />
        <div className="flex flex-wrap gap-1 mb-4">
          {CATEGORY_EMOJI.map((e) => (
            <button key={e} type="button" onClick={() => setIcon(e)} className={`w-9 h-9 border-2 text-lg ${icon === e ? 'border-black bg-neo-yellow' : 'border-black/20'}`}>{e}</button>
          ))}
        </div>
        <FieldLabel>Color</FieldLabel>
        <div className="flex flex-wrap gap-2 mb-6">
          {CATEGORY_COLORS.map((c) => (
            <button key={c} type="button" aria-label={`Color ${c}`} onClick={() => setColor(c)} className={`w-9 h-9 border-2 ${color === c ? 'border-black shadow-neo-sm scale-110' : 'border-black/30'}`} style={{ backgroundColor: c }} />
          ))}
        </div>
        <div className="flex gap-3">
          {editing && editing !== 'new' && (
            <NeoButton fullWidth variant="neutral" isLoading={isProcessing} onClick={async () => done(await updateCategory(editing.id, { archived: !editing.archived }), editing.archived ? 'Category restored' : 'Category archived')}>
              {editing.archived ? 'Restore' : 'Archive'}
            </NeoButton>
          )}
          <NeoButton fullWidth variant="primary" isLoading={isProcessing} disabled={!name.trim()} onClick={() => void save()}>Save</NeoButton>
        </div>
      </NeoModal>
    </div>
  );
};
