import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus, Scale } from 'lucide-react';
import { NeoButton } from '../components/NeoButton';
import { NeoInput } from '../components/NeoInput';
import { NeoModal } from '../components/NeoModal';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { DataLoadErrorBanner } from '../components/DataLoadErrorBanner';
import { useAppContext } from '../context/AppContext';
import { useToast } from '../components/ToastContext';
import { accountBalances, netWorth, round2, totalOwed } from '../utils/calculations';
import { latestFx } from '../utils/entryUi';
import { adjustmentAccountName, isAdjustmentAccount } from '../utils/entryForm';
import { formatCurrency } from '../utils/formatters';
import type { Account } from '../types';

export const Wallet: React.FC = () => {
  const { accounts, entries, loading, error, refetch, addAccount, updateAccount, addEntry, isProcessing, online } = useAppContext();
  const { success, error: showError } = useToast();
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Account | 'new' | null>(null);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('HKD');
  const [recon, setRecon] = useState<Account | null>(null);
  // One id per reconcile session: a retry after a lost response upserts the same entry instead of adding the delta twice.
  const [reconId, setReconId] = useState('');
  const [actual, setActual] = useState('');

  const balances = useMemo(() => accountBalances(accounts, entries), [accounts, entries]);
  const worth = useMemo(() => netWorth(accounts, entries, latestFx(entries)), [accounts, entries]);
  const owed = useMemo(() => totalOwed(entries), [entries]);
  const live = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived && !isAdjustmentAccount(a)); // adjustment accounts are never restorable

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

  const target = Number(actual);
  const reconValid = actual.trim() !== '' && Number.isFinite(target);
  const reconDiff = recon && reconValid ? round2(target - (balances.get(recon.id) ?? 0)) : 0;
  const reconPending = !!recon && entries.some((e) => e.pending && (e.accountId === recon.id || e.toAccountId === recon.id));
  const reconFx = recon?.currency === 'HKD' ? 1 : recon ? latestFx(entries.filter((e) => !e.pending))[recon.currency] : undefined;
  const reconReason = !online ? 'You are offline. Reconcile needs a connection.'
    : reconPending ? 'Wait for pending entries on this account to sync.'
    : !reconFx ? `No ${recon?.currency} rate yet. Log an entry in ${recon?.currency} first.` : !reconValid ? 'Enter the actual balance.' : reconDiff === 0 ? 'Matches the app balance.' : '';

  // The difference is a transfer with a hidden archived "Balance adjustments" account (one per currency):
  // transfers are not income/spending, archived accounts are outside net worth, so only net worth moves.
  // ponytail: online-only; two devices reconciling at once can overshoot (single-user app, accepted).
  const reconcile = async () => {
    if (!recon || reconReason) return;
    const adjName = adjustmentAccountName(recon.currency);
    let adj = accounts.find((a) => isAdjustmentAccount(a) && a.currency === recon.currency)?.id;
    if (!adj) {
      const c = await addAccount({ name: adjName, currency: recon.currency, sort: accounts.length, archived: true });
      if (!c.success || !c.id) { showError('Could not adjust balance', c.error?.message); return; }
      adj = c.id;
    }
    const up = reconDiff > 0;
    const r = await addEntry({
      id: reconId, kind: 'transfer', amount: Math.abs(reconDiff), title: 'Balance adjustment', currency: recon.currency, fxRate: reconFx,
      accountId: up ? adj : recon.id, toAccountId: up ? recon.id : adj,
    }, { onlineOnly: true });
    if (r.success) { success('Balance adjusted', `${up ? '+' : '−'}${formatCurrency(Math.abs(reconDiff), recon.currency)}`); setRecon(null); }
    else showError('Could not adjust balance', r.error?.message);
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
      <button type="button" onClick={() => { setRecon(a); setReconId(crypto.randomUUID()); setActual(String(balances.get(a.id) ?? 0)); }} aria-label={`Reconcile ${a.name}`} className="w-12 grid place-items-center border-l-2 border-black dark:text-zinc-100 hover:bg-neo-yellow/40">
        <Scale size={16} />
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
        {!name.trim() && <p className="text-xs font-bold uppercase text-gray-600 dark:text-zinc-400">Enter a name to save.</p>}
        <div className="flex gap-3">
          {editing && editing !== 'new' && (
            <NeoButton fullWidth variant="neutral" isLoading={isProcessing} onClick={() => void setArchived(editing, !editing.archived)}>
              {editing.archived ? 'Restore' : 'Archive'}
            </NeoButton>
          )}
          <NeoButton fullWidth variant="primary" isLoading={isProcessing} disabled={!name.trim()} onClick={() => void save()}>Save</NeoButton>
        </div>
      </NeoModal>

      <NeoModal isOpen={recon !== null} onClose={() => setRecon(null)} title={`Reconcile ${recon?.name ?? ''}`}>
        <NeoInput label={`Actual balance (${recon?.currency ?? ''})`} type="number" inputMode="decimal" step="any" value={actual} onChange={(e) => setActual(e.target.value)} autoFocus />
        <p className="text-xs font-bold uppercase text-gray-600 dark:text-zinc-400">
          {reconReason || `Moves ${formatCurrency(Math.abs(reconDiff), recon?.currency)} ${reconDiff > 0 ? 'in' : 'out'} via “Balance adjustments” (not income or spending).`}
        </p>
        <NeoButton fullWidth variant="primary" isLoading={isProcessing} disabled={!!reconReason} onClick={() => void reconcile()}>Save</NeoButton>
      </NeoModal>
    </div>
  );
};
