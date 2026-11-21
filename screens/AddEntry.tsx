import React, { useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { BackButton } from '../components/BackButton';
import { NeoButton } from '../components/NeoButton';
import { NeoInput } from '../components/NeoInput';
import { Avatar } from '../components/Avatar';
import { Chip, FieldLabel } from '../components/Chip';
import { DeleteConfirmButton } from '../components/DeleteConfirmButton';
import { FullPageLoading } from '../components/LoadingSpinner';
import { AmountInput } from '../components/AddEntry/AmountInput';
import { CategoryGrid } from '../components/AddEntry/CategoryGrid';
import { SplitEditor, type SplitMode } from '../components/AddEntry/SplitEditor';
import { useAppContext } from '../context/AppContext';
import { useToast } from '../components/ToastContext';
import { localDay, round2 } from '../utils/calculations';
import { evaluateExpression } from '../utils/calculator';
import { isValidAmount } from '../utils/validation';
import { categoriesByUse, dayLabel, dayToIso, KIND_LABEL, lastUsedAccountId, latestFx, splitEqual, tooSmallToSplit } from '../utils/entryUi';
import { formatCurrency } from '../utils/formatters';
import { PRESET_AVATARS } from '../constants';
import type { Entry, EntryKind } from '../types';

const KINDS: { kind: EntryKind; color: string }[] = [
  { kind: 'expense', color: 'bg-neo-yellow' },
  { kind: 'income', color: 'bg-neo-green' },
  { kind: 'transfer', color: 'bg-neo-blue' },
  { kind: 'settlement', color: 'bg-neo-yellow' },
];

/** Router state other screens can pass: open on a kind, settle a friend, or pre-split with one. */
interface Preset { kind?: EntryKind; friendId?: string; splitFriendId?: string }

export const AddEntry: React.FC = () => {
  const { id } = useParams();
  const { entries, loading } = useAppContext();
  const entry = id ? entries.find((e) => e.id === id) : undefined;
  if (id && !entry) {
    return loading ? <FullPageLoading /> : (
      <div className="min-h-screen grid place-items-center p-6">
        <p className="font-black uppercase dark:text-zinc-100">Entry not found</p>
      </div>
    );
  }
  return <EntryForm key={entry?.id ?? 'new'} entry={entry} />;
};

const EntryForm: React.FC<{ entry?: Entry }> = ({ entry }) => {
  const nav = useNavigate();
  const loc = useLocation();
  const preset = (loc.state as Preset | null) ?? {};
  const { entries, accounts, categories, friends, addEntry, updateEntry, deleteEntry, addCategory, addFriend, isProcessing } = useAppContext();
  const { success, error: showError } = useToast();

  const [kind, setKind] = useState<EntryKind>(entry?.kind ?? preset.kind ?? 'expense');
  const presetBalance = friends.find((f) => f.id === preset.friendId)?.balance ?? 0;
  const [amount, setAmount] = useState(entry ? String(entry.amount) : presetBalance > 0 ? String(round2(presetBalance)) : '0');
  const [amountAuto, setAmountAuto] = useState(!entry); // true until the user types: lets picking a friend prefill
  const [showNumpad, setShowNumpad] = useState(!entry && presetBalance <= 0);
  const [categoryId, setCategoryId] = useState(entry?.categoryId);
  // accountId: undefined = not chosen yet (use last used), null = explicitly none
  const [accountId, setAccountId] = useState<string | null | undefined>(entry ? entry.accountId ?? null : undefined);
  const [toAccountId, setToAccountId] = useState(entry?.toAccountId);
  const [friendId, setFriendId] = useState(entry?.friendId ?? preset.friendId);
  const [day, setDay] = useState(localDay(entry?.occurredAt ?? new Date().toISOString()));
  const [title, setTitle] = useState(entry?.title ?? '');
  const [note, setNote] = useState(entry?.note ?? '');
  const [fx, setFx] = useState(entry ? String(entry.fxRate) : '');

  const [splitOn, setSplitOn] = useState(!!entry?.shares.length || !!preset.splitFriendId);
  const [shareIds, setShareIds] = useState<string[]>(entry?.shares.map((s) => s.friendId) ?? (preset.splitFriendId ? [preset.splitFriendId] : []));
  const [mode, setMode] = useState<SplitMode>(entry?.shares.length ? 'custom' : 'equal');
  const [custom, setCustom] = useState<Record<string, string>>(
    Object.fromEntries((entry?.shares ?? []).map((s) => [s.friendId, String(s.amount)]))
  );

  const liveAccounts = accounts.filter((a) => !a.archived || a.id === entry?.accountId || a.id === entry?.toAccountId);
  const fromId = accountId === undefined ? lastUsedAccountId(accounts, entries) : accountId ?? undefined;
  const account = accounts.find((a) => a.id === fromId);
  // Transfers only move money between accounts in the same currency.
  const sameCurrency = liveAccounts.filter((a) => a.id !== fromId && a.currency === account?.currency);
  const toId = toAccountId ?? sameCurrency[0]?.id;
  const currency = account && !(entry && entry.accountId === account.id) ? account.currency : entry?.currency ?? account?.currency ?? 'HKD';
  const fxRate = currency === 'HKD' ? 1 : parseFloat(fx) || latestFx(entries)[currency] || 1;

  const total = isValidAmount(amount) ? parseFloat(evaluateExpression(amount)) : 0;
  const each = splitEqual(total, shareIds.length);
  const shares = splitOn && kind === 'expense'
    ? shareIds.map((fid) => ({ friendId: fid, amount: mode === 'equal' ? each : round2(parseFloat(custom[fid]) || 0) })).filter((s) => s.amount > 0)
    : [];
  const owe = round2(shares.reduce((s, x) => s + x.amount, 0));
  const mine = round2(total - owe);

  const category = categories.find((c) => c.id === categoryId && c.kind === kind);
  const friend = friends.find((f) => f.id === friendId);
  const defaultTitle =
    kind === 'settlement' ? `${friend?.name ?? 'Friend'} repaid` : kind === 'transfer' ? 'Transfer' : category?.name ?? KIND_LABEL[kind];

  const problem =
    total <= 0 ? 'Enter an amount'
    : kind === 'settlement' && !friendId ? 'Pick a friend'
    : kind === 'transfer' && (!fromId || !toId || fromId === toId) ? 'Pick two different accounts'
    : (kind === 'income' || kind === 'transfer' || (kind === 'expense' && accountId !== null)) && !fromId ? 'Add an account in Wallet first'
    : kind === 'transfer' && accounts.find((a) => a.id === toId)?.currency !== account?.currency ? 'Transfers need two accounts in the same currency'
    : splitOn && kind === 'expense' && mode === 'equal' && tooSmallToSplit(total, shareIds.length) ? 'Too small to split equally'
    : splitOn && kind === 'expense' && shares.length === 0 ? 'Pick who to split with, or turn split off'
    : mine < 0 ? 'Friends\' shares exceed the total'
    : null;

  const pickFriend = (fid: string) => {
    setFriendId(fid);
    const bal = friends.find((f) => f.id === fid)?.balance ?? 0;
    if (amountAuto && bal > 0) setAmount(String(round2(bal)));
  };

  const switchMode = (m: SplitMode) => {
    if (m === 'custom' && mode === 'equal') setCustom(Object.fromEntries(shareIds.map((fid) => [fid, String(each)])));
    setMode(m);
  };

  const toggleShare = (fid: string) => setShareIds((ids) => (ids.includes(fid) ? ids.filter((x) => x !== fid) : [...ids, fid]));

  const createCategory = async (name: string) => {
    const r = await addCategory({ name, kind: kind === 'income' ? 'income' : 'expense' });
    if (!r.success) showError('Could not add category', r.error?.message);
    return r.id;
  };

  const createFriend = async (name: string) => {
    const r = await addFriend({ name, avatar: PRESET_AVATARS[0] });
    if (!r.success) showError('Could not add friend', r.error?.message);
    else if (r.id) setShareIds((ids) => [...ids, r.id!]);
    return r.success;
  };

  const dateRef = useRef<HTMLInputElement>(null);
  // Fixed when the form opens; a form left open past midnight keeps its original "today".
  const [[today, yesterday]] = useState(() => [localDay(new Date().toISOString()), localDay(new Date(Date.now() - 864e5).toISOString())]);
  const openPicker = () => {
    try { dateRef.current?.showPicker(); } catch { dateRef.current?.focus(); } // showPicker: Safari 16.4+, Chrome 99+
  };

  const back = () => (loc.key === 'default' ? nav('/dashboard', { replace: true }) : nav(-1));

  const save = async () => {
    if (problem) return;
    const money = kind === 'expense' || kind === 'income';
    const built = {
      kind, amount: total, title: title.trim() || defaultTitle, note: note.trim() || undefined,
      occurredAt: dayToIso(day, entry?.occurredAt), currency, fxRate,
      accountId: fromId,
      toAccountId: kind === 'transfer' ? toId : undefined,
      categoryId: money ? category?.id : undefined,
      friendId: kind === 'settlement' ? friendId : undefined,
      shares,
    };
    const r = entry
      ? await updateEntry({ ...built, id: entry.id, requestId: entry.requestId, subscriptionId: entry.subscriptionId })
      : await addEntry(built);
    if (r.success) {
      const queued = 'queued' in r && r.queued;
      success(entry ? 'Entry updated' : queued ? 'Saved offline' : 'Saved',
        `${KIND_LABEL[kind]} ${formatCurrency(total, currency)}${queued ? ' · syncs when back online' : ''}`);
      back();
    } else {
      showError('Could not save', r.error?.message);
    }
  };

  const remove = async () => {
    if (!entry) return;
    const r = await deleteEntry(entry.id);
    if (r.success) {
      success('Entry deleted');
      back();
    } else {
      showError('Could not delete', r.error?.message);
    }
  };

  const accountChips = ({ value, onPick, none, from = liveAccounts }: { value?: string; onPick: (id: string | null) => void; none?: string; from?: typeof liveAccounts }) => (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
      {from.map((a) => (
        <Chip key={a.id} active={a.id === value} onClick={() => onPick(a.id)} color="bg-neo-yellow">{a.name}</Chip>
      ))}
      {none && <Chip active={value === undefined} onClick={() => onPick(null)} color="bg-neo-orange">{none}</Chip>}
      {liveAccounts.length === 0 && <p className="text-xs font-bold uppercase text-gray-600">No accounts yet. Add one in Wallet.</p>}
    </div>
  );

  const owing = [...friends].sort((a, b) => b.balance - a.balance);

  return (
    <div className="min-h-screen pb-32 bg-neo-bg dark:bg-zinc-950">
      <header className="sticky top-0 z-30 bg-neo-bg/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b-2 border-black px-5 py-3 flex items-center justify-between">
        <BackButton />
        <h1 className="text-lg font-black uppercase tracking-widest dark:text-zinc-100">{entry ? 'Edit entry' : 'New entry'}</h1>
        {entry ? <DeleteConfirmButton size="expanded" onConfirm={() => void remove()} ariaLabel="Delete entry" /> : <div className="w-10" />}
      </header>

      <main className="p-5 space-y-6 max-w-md mx-auto">
        <div className="grid grid-cols-4 gap-2" role="group" aria-label="Entry type">
          {KINDS.map(({ kind: k, color }) => (
            <Chip key={k} active={kind === k} color={color} onClick={() => setKind(k)} className="justify-center !px-1 text-[11px] uppercase">
              {KIND_LABEL[k]}
            </Chip>
          ))}
        </div>

        <AmountInput
          amount={amount}
          onAmountChange={(v) => { setAmount(v); setAmountAuto(false); }}
          showNumpad={showNumpad}
          onToggleNumpad={() => setShowNumpad((v) => !v)}
          currency={currency}
        />

        {kind === 'settlement' && (
          <div>
            <FieldLabel>Who paid you back?</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {owing.map((f) => (
                <Chip key={f.id} active={f.id === friendId} onClick={() => pickFriend(f.id)} color="bg-neo-yellow">
                  <Avatar src={f.avatar} alt={f.name} size="sm" />
                  <span className="text-left leading-tight">{f.name.split(' ')[0]}
                    <span className={`block text-[10px] ${f.balance > 0 ? 'text-neo-greenDark' : 'text-gray-600'}`}>
                      {f.balance > 0 ? `owes ${formatCurrency(f.balance)}` : 'settled'}
                    </span>
                  </span>
                </Chip>
              ))}
              {friends.length === 0 && <p className="text-xs font-bold uppercase text-gray-600">No friends yet.</p>}
            </div>
          </div>
        )}

        {(kind === 'expense' || kind === 'income') && (
          <div>
            <FieldLabel>Category</FieldLabel>
            <CategoryGrid
              categories={categoriesByUse(categories, entries, kind === 'income' ? 'income' : 'expense')}
              selectedId={category?.id}
              onSelect={setCategoryId}
              onCreate={createCategory}
            />
          </div>
        )}

        <div>
          <FieldLabel>{kind === 'transfer' ? 'From account' : kind === 'settlement' ? 'Paid into' : 'Account'}</FieldLabel>
          {accountChips({
            value: fromId,
            onPick: (id) => setAccountId(id),
            none: kind === 'settlement' ? 'Offset (no money moved)' : kind === 'expense' && entry && !entry.accountId ? 'No account' : undefined,
          })}
          {currency !== 'HKD' && (
            <label className="flex items-center gap-2 mt-2 text-xs font-bold uppercase dark:text-zinc-100">
              1 {currency} =
              <input
                inputMode="decimal"
                value={fx || String(fxRate)}
                onChange={(e) => setFx(e.target.value.replace(/[^0-9.]/g, ''))}
                className="w-24 border-2 border-black p-1 text-right bg-white dark:bg-zinc-900"
              />
              HKD
            </label>
          )}
        </div>

        {kind === 'transfer' && (
          <div>
            <FieldLabel>To account</FieldLabel>
            {accountChips({ value: toId, from: sameCurrency, onPick: (id) => id && setToAccountId(id) })}
          </div>
        )}

        {kind === 'expense' && (
          <div>
            <button
              type="button"
              onClick={() => setSplitOn((v) => !v)}
              aria-pressed={splitOn}
              className={`w-full text-left px-4 py-3 border-2 border-black font-black uppercase text-sm shadow-neo-sm ${splitOn ? 'bg-neo-orange text-black' : 'bg-white dark:bg-zinc-900 dark:text-zinc-100'}`}
            >
              {splitOn ? '✓ Split with friends' : 'Split with friends'}
            </button>
            {splitOn && (
              <div className="mt-3">
                <SplitEditor
                  friends={friends} ids={shareIds} onToggle={toggleShare} mode={mode} onMode={switchMode}
                  custom={custom} onCustom={(fid, v) => setCustom((c) => ({ ...c, [fid]: v }))}
                  each={each} mine={mine} owe={owe} currency={currency} onAddFriend={createFriend}
                />
              </div>
            )}
          </div>
        )}

        <div>
          <FieldLabel>Date</FieldLabel>
          <div className="relative flex flex-wrap gap-2">
            <Chip active={day === today} onClick={() => setDay(today)}>Today</Chip>
            <Chip active={day === yesterday} onClick={() => setDay(yesterday)}>Yesterday</Chip>
            <Chip active={day !== today && day !== yesterday} onClick={openPicker}>
              <CalendarDays size={16} aria-hidden="true" />
              {day !== today && day !== yesterday ? dayLabel(day) : 'Pick date'}
            </Chip>
            {/* The phone's own date picker, opened by the chip above. */}
            <input
              ref={dateRef}
              type="date"
              tabIndex={-1}
              aria-label="Pick date"
              value={day}
              onChange={(e) => e.target.value && setDay(e.target.value)}
              className="sr-only"
            />
          </div>
        </div>

        <div>
          <FieldLabel>Title (optional)</FieldLabel>
          <NeoInput aria-label="Title" placeholder={defaultTitle} value={title} onChange={(e) => setTitle(e.target.value)} />
          <FieldLabel>Note</FieldLabel>
          <NeoInput aria-label="Note" placeholder="Anything to remember" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </main>

      <div className="fixed bottom-0 inset-x-0 z-40 bg-neo-bg dark:bg-zinc-950 border-t-2 border-black p-4">
        <div className="max-w-md mx-auto">
          {problem && total > 0 && <p className="text-xs font-black uppercase text-neo-danger mb-2 text-center">{problem}</p>}
          <NeoButton fullWidth variant="primary" disabled={!!problem} isLoading={isProcessing} onClick={() => void save()}>
            {entry ? 'Save changes' : `Save ${KIND_LABEL[kind].toLowerCase()}`}
            {total > 0 && ` · ${formatCurrency(total, currency)}`}
          </NeoButton>
        </div>
      </div>
    </div>
  );
};
