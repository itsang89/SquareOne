import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus } from 'lucide-react';
import { NeoButton } from '../components/NeoButton';
import { NeoInput } from '../components/NeoInput';
import { NeoModal } from '../components/NeoModal';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { DataLoadErrorBanner } from '../components/DataLoadErrorBanner';
import { useAppContext } from '../context/AppContext';
import { useToast } from '../components/ToastContext';
import { accountBalances, netWorth, totalOwed } from '../utils/calculations';
import { latestFx } from '../utils/entryUi';
import { formatCurrency } from '../utils/formatters';
import type { Account } from '../types';

export const Wallet: React.FC = () => {
  const { accounts, entries, loading, error, refetch, addAccount, updateAccount, isProcessing } = useAppContext();
  const { success, error: showError } = useToast();
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Account | 'new' | null>(null);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('HKD');

  const balances = useMemo(() => accountBalances(accounts, entries), [accounts, entries]);
  const worth = useMemo(() => netWorth(accounts, entries, latestFx(entries)), [accounts, entries]);
  const owed = useMemo(() => totalOwed(entries), [entries]);
  const live = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);

  const open = (a: Account | 'new') => {
    setEditing(a);
    setName(a === 'new' ? '' : a.name);
    setCurrency(a === 'new' ? 'HKD' : a.currency);
  };

  const save = async () => {
    if (!name.trim() || !editing) return;
    const r = editing === 'new'
      ? await addAccount({ name, currency: currency.trim().toUpperCase() || 'HKD', sort: accounts.length })
      : await updateAccount(editing.id, { name });
    if (r.success) { success(editing === 'new' ? 'Account added' : 'Account renamed'); setEditing(null); }
    else showError('Could not save account', r.error?.message);
  };

  const setArchived = async (a: Account, value: boolean) => {
    const r = await updateAccount(a.id, { archived: value });
    if (r.success) { success(value ? 'Account archived' : 'Account restored'); setEditing(null); }
    else showError('Could not update account', r.error?.message);
  };

  const row = (a: Account) => (
    <li key={a.id} className={`flex items-stretch bg-white dark:bg-zinc-900 border-2 border-black shadow-neo-sm ${a.archived ? 'opacity-60' : ''}`}>
      <Link to={`/ledger?account=${a.id}&month=all`} className="flex-1 min-w-0 flex items-center justify-between gap-3 p-4">
        <span className="min-w-0">
          <span className="block font-bold text-lg leading-tight truncate dark:text-zinc-100">{a.name}</span>
          <span className="block text-xs font-medium text-gray-600">{a.currency}{a.archived ? ' · archived' : ''}</span>
        </span>
        <span className={`font-black text-lg tabular-nums shrink-0 ${(balances.get(a.id) ?? 0) < 0 ? 'text-neo-danger' : 'dark:text-zinc-100'}`}>
          {formatCurrency(balances.get(a.id) ?? 0, a.currency)}
        </span>
      </Link>
      <button type="button" onClick={() => open(a)} aria-label={`Edit ${a.name}`} className="w-12 grid place-items-center border-l-2 border-black dark:text-zinc-100 hover:bg-neo-yellow/40">
        <Pencil size={16} />
      </button>
    </li>
  );

  return (
    <div className="min-h-screen pb-28 bg-neo-bg dark:bg-zinc-950">
      <header className="sticky top-0 z-20 bg-neo-bg/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b-2 border-black px-5 py-4 flex items-center justify-between">
        <h1 className="text-3xl font-black uppercase leading-none dark:text-zinc-100">Wallet</h1>
        <button type="button" onClick={() => open('new')} aria-label="Add account" className="w-12 h-12 bg-neo-yellow border-2 border-black shadow-neo-sm grid place-items-center active:shadow-none">
          <Plus />
        </button>
      </header>
      <DataLoadErrorBanner error={error} loading={loading} onRetry={refetch} />

      <main className="p-5 space-y-5">
        <section className="bg-neo-yellow border-2 border-black shadow-neo p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-black/70">Net worth</p>
          <p className="text-4xl font-black tracking-tighter text-black">
            <AnimatedNumber value={worth} decimals={2} prefix="HK$" />
          </p>
          <Link to="/friends" className="mt-4 pt-3 border-t-2 border-black/10 flex items-center justify-between text-black">
            <span className="text-xs font-black uppercase">Friends owe you (included)</span>
            <span className="font-black">{formatCurrency(owed)}</span>
          </Link>
        </section>

        <ul className="space-y-3">
          {live.map(row)}
          {!loading && live.length === 0 && (
            <li className="text-center py-8 font-black uppercase text-gray-600">No accounts yet. Tap + to add Bank, Cash…</li>
          )}
        </ul>

        {archived.length > 0 && (
          <>
            <button type="button" onClick={() => setShowArchived((v) => !v)} className="text-xs font-black uppercase underline dark:text-zinc-100">
              {showArchived ? 'Hide' : 'Show'} archived ({archived.length})
            </button>
            {showArchived && <ul className="space-y-3">{archived.map(row)}</ul>}
          </>
        )}
      </main>

      <NeoModal isOpen={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add account' : 'Edit account'}>
        <NeoInput label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bank, Octopus, Mox…" autoFocus />
        {editing === 'new' && (
          <NeoInput label="Currency" value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
        )}
        <div className="flex gap-3">
          {editing && editing !== 'new' && (
            <NeoButton fullWidth variant="neutral" isLoading={isProcessing} onClick={() => void setArchived(editing, !editing.archived)}>
              {editing.archived ? 'Restore' : 'Archive'}
            </NeoButton>
          )}
          <NeoButton fullWidth variant="primary" isLoading={isProcessing} disabled={!name.trim()} onClick={() => void save()}>Save</NeoButton>
        </div>
      </NeoModal>
    </div>
  );
};
