import React, { useState } from 'react';
import { Pause, Play, Plus } from 'lucide-react';
import { BackButton } from '../components/BackButton';
import { NeoButton } from '../components/NeoButton';
import { NeoInput } from '../components/NeoInput';
import { NeoModal } from '../components/NeoModal';
import { DeleteConfirmButton } from '../components/DeleteConfirmButton';
import { FieldLabel, SELECT_CLASS } from '../components/Chip';
import { useAppContext } from '../context/AppContext';
import { useToast } from '../components/ToastContext';
import { localDay, round2 } from '../utils/calculations';
import { latestFx } from '../utils/entryUi';
import { formatCurrency } from '../utils/formatters';
import type { Cadence, Subscription } from '../types';

const PER_MONTH: Record<Cadence, number> = { weekly: 52 / 12, monthly: 1, yearly: 1 / 12 };

export const Subscriptions: React.FC = () => {
  const { subscriptions, accounts, categories, entries, addSubscription, updateSubscription, deleteSubscription, isProcessing } = useAppContext();
  const { success, error: showError } = useToast();
  const [editing, setEditing] = useState<Subscription | 'new' | null>(null);
  const [f, setF] = useState({ title: '', amount: '', categoryId: '', accountId: '', cadence: 'monthly' as Cadence, nextDate: '' });

  const monthly = round2(subscriptions.filter((s) => s.active).reduce((t, s) => t + s.amount * s.fxRate * PER_MONTH[s.cadence], 0));
  const expenseCats = categories.filter((c) => c.kind === 'expense' && !c.archived);

  const open = (s: Subscription | 'new') => {
    setEditing(s);
    setF(s === 'new'
      ? { title: '', amount: '', categoryId: '', accountId: accounts.find((a) => !a.archived)?.id ?? '', cadence: 'monthly', nextDate: localDay(new Date().toISOString()) }
      : { title: s.title, amount: String(s.amount), categoryId: s.categoryId ?? '', accountId: s.accountId ?? '', cadence: s.cadence, nextDate: s.nextDate });
  };

  const done = (r: { success: boolean; error?: Error }, msg: string) => {
    if (r.success) { success(msg); setEditing(null); } else showError('Could not save subscription', r.error?.message);
  };

  const amount = parseFloat(f.amount);
  const valid = f.title.trim() && amount > 0 && f.nextDate;

  const save = async () => {
    if (!valid || !editing) return;
    const currency = accounts.find((a) => a.id === f.accountId)?.currency ?? 'HKD';
    const data = {
      title: f.title.trim(), amount, cadence: f.cadence, nextDate: f.nextDate, currency,
      fxRate: currency === 'HKD' ? 1 : latestFx(entries)[currency] ?? 1,
      categoryId: f.categoryId || undefined, accountId: f.accountId || undefined,
    };
    done(editing === 'new' ? await addSubscription(data) : await updateSubscription(editing.id, data), 'Subscription saved');
  };

  const toggle = async (s: Subscription) => {
    const r = await updateSubscription(s.id, { active: !s.active });
    if (!r.success) showError('Could not update', r.error?.message);
  };

  return (
    <div className="min-h-screen pb-28 bg-neo-bg dark:bg-zinc-950">
      <header className="sticky top-0 z-20 bg-neo-bg/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b-2 border-black px-5 py-3 flex items-center justify-between">
        <BackButton to="/profile" />
        <h1 className="text-lg font-black uppercase tracking-widest dark:text-zinc-100">Subscriptions</h1>
        <button type="button" onClick={() => open('new')} aria-label="Add subscription" className="w-11 h-11 bg-neo-yellow border-2 border-black shadow-neo-sm grid place-items-center"><Plus size={20} /></button>
      </header>

      <main className="p-5 space-y-4">
        <div className="bg-white dark:bg-zinc-900 dark:text-zinc-100 border-2 border-black shadow-neo p-4">
          <p className="text-xs font-bold uppercase tracking-widest opacity-70">Per month</p>
          <p className="text-3xl font-black tracking-tighter">{formatCurrency(monthly)}</p>
        </div>

        <ul className="space-y-3">
          {subscriptions.map((s) => (
            <li key={s.id} className={`flex items-stretch bg-white dark:bg-zinc-900 border-2 border-black shadow-neo-sm ${s.active ? '' : 'opacity-50'}`}>
              <button type="button" onClick={() => open(s)} className="flex-1 min-w-0 p-3 flex items-center justify-between gap-3 text-left">
                <span className="min-w-0">
                  <span className="block font-bold truncate dark:text-zinc-100">{s.title}</span>
                  <span className="block text-[11px] font-bold uppercase text-gray-600">
                    {s.cadence} · {s.active ? `next ${s.nextDate}` : 'paused'}
                  </span>
                </span>
                <span className="font-black dark:text-zinc-100">{formatCurrency(s.amount, s.currency)}</span>
              </button>
              <button type="button" onClick={() => void toggle(s)} aria-label={s.active ? `Pause ${s.title}` : `Resume ${s.title}`} className="px-3 border-l-2 border-black dark:text-zinc-100 hover:bg-neo-yellow/40">
                {s.active ? <Pause size={16} /> : <Play size={16} />}
              </button>
            </li>
          ))}
          {subscriptions.length === 0 && (
            <li className="text-center py-10 px-4 space-y-3">
              <p className="font-bold dark:text-zinc-100">No subscriptions yet</p>
              <p className="text-sm text-gray-600 dark:text-zinc-400">Add rent, phone or streaming once and SquareOne logs it on each due date.</p>
              <button type="button" onClick={() => open('new')} className="px-4 py-2 bg-neo-yellow text-black border-2 border-black shadow-neo-sm font-bold">Add subscription</button>
            </li>
          )}
        </ul>
      </main>

      <NeoModal isOpen={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'New subscription' : 'Edit subscription'}>
        <NeoInput label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Netflix" autoFocus />
        <NeoInput label="Amount" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^0-9.]/g, '') })} />
        <FieldLabel>Repeats</FieldLabel>
        <select aria-label="Cadence" className={`${SELECT_CLASS} mb-4`} value={f.cadence} onChange={(e) => setF({ ...f, cadence: e.target.value as Cadence })}>
          <option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option>
        </select>
        <FieldLabel>Next date</FieldLabel>
        <input type="date" aria-label="Next date" className={`${SELECT_CLASS} mb-4`} value={f.nextDate} onChange={(e) => setF({ ...f, nextDate: e.target.value })} />
        <FieldLabel>Category</FieldLabel>
        <select aria-label="Category" className={`${SELECT_CLASS} mb-4`} value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
          <option value="">None</option>
          {expenseCats.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
        <FieldLabel>Account</FieldLabel>
        <select aria-label="Account" className={`${SELECT_CLASS} mb-6`} value={f.accountId} onChange={(e) => setF({ ...f, accountId: e.target.value })}>
          <option value="">None</option>
          {accounts.filter((a) => !a.archived || a.id === f.accountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <div className="flex gap-3">
          {editing && editing !== 'new' && (
            <DeleteConfirmButton size="expanded" ariaLabel="Delete subscription" onConfirm={async () => done(await deleteSubscription(editing.id), 'Subscription deleted')} />
          )}
          <NeoButton fullWidth variant="primary" isLoading={isProcessing} disabled={!valid} onClick={() => void save()}>Save</NeoButton>
        </div>
      </NeoModal>
    </div>
  );
};
