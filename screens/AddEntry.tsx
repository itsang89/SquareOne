import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import { NeoButton } from '../components/NeoButton';
import { NeoModal } from '../components/NeoModal';
import { NeoInput } from '../components/NeoInput';
import { Avatar } from '../components/Avatar';
import { Chip, FieldLabel } from '../components/Chip';
import { DeleteConfirmButton } from '../components/DeleteConfirmButton';
import { FullPageLoading } from '../components/LoadingSpinner';
import { AmountInput } from '../components/AddEntry/AmountInput';
import { CategoryGrid } from '../components/AddEntry/CategoryGrid';
import { SplitEditor, type SplitMode } from '../components/AddEntry/SplitEditor';
import { DatePicker } from '../components/AddEntry/DatePicker';
import { useDraftBack } from '../components/AddEntry/useDraftBack';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { useToast } from '../components/ToastContext';
import { localDay, round2 } from '../utils/calculations';
import { calculateExpression } from '../utils/calculator';
import { entryFxKey, fetchEntryFx, parseEntryFxRate, type EntryFx } from '../utils/entryFx';
import { canRepeatEntry, offsetAmount, recentEntryTemplates, settlementAmount } from '../utils/entryForm';
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
interface Preset { kind?: EntryKind; friendId?: string; splitFriendId?: string; templateId?: string }

export const AddEntry: React.FC = () => {
  const { id } = useParams();
  const { entries, loading } = useAppContext();
  const entry = id ? entries.find((e) => e.id === id) : undefined;
  const loc = useLocation();
  if (id && !entry) {
    return loading ? <FullPageLoading /> : (
      <div className="min-h-screen grid place-items-center p-6">
        <p className="font-black uppercase dark:text-zinc-100">Entry not found</p>
      </div>
    );
  }
  // Remount per entry and per navigation: jumping from a dirty New entry to an existing one must not carry the draft.
  return <EntryForm key={`${entry?.id ?? 'new'}:${loc.key}`} entry={entry} />;
};

const EntryForm: React.FC<{ entry?: Entry }> = ({ entry }) => {
  const nav = useNavigate();
  const loc = useLocation();
  const preset = (loc.state as Preset | null) ?? {};
  const { user } = useAuth();
  const { entries, accounts, categories, friends, addEntry, updateEntry, deleteEntry, restoreEntry, addCategory, addFriend, isProcessing } = useAppContext();
  const { success, show, error: showError } = useToast();

  const source = entry ?? entries.find((e) => e.id === preset.templateId && canRepeatEntry(e, accounts));
  const [kind, setKind] = useState<EntryKind>(source?.kind ?? preset.kind ?? 'expense');
  const presetBalance = friends.find((f) => f.id === preset.friendId)?.balance ?? 0;
  const [amountText, setAmount] = useState(() => String(source
    ? source.kind === 'settlement' && !source.accountId ? offsetAmount(source.amount, source.fxRate) : source.amount
    : 0));
  const [amountAuto, setAmountAuto] = useState(!source); // true until the user types: lets picking a friend prefill
  const [showNumpad, setShowNumpad] = useState(!source && presetBalance <= 0);
  const [categoryId, setCategoryId] = useState(source?.categoryId);
  // accountId: undefined = not chosen yet (use last used), null = explicitly none
  const [accountId, setAccountId] = useState<string | null | undefined>(source ? source.accountId ?? null : undefined);
  const [toAccountId, setToAccountId] = useState(source?.toAccountId);
  const [friendId, setFriendId] = useState(source?.friendId ?? preset.friendId);
  // A form left open past midnight keeps its original "today".
  const [[today, yesterday]] = useState(() => [localDay(new Date().toISOString()), localDay(new Date(Date.now() - 864e5).toISOString())]);
  const [day, setDay] = useState(entry ? localDay(entry.occurredAt) : today);
  const [title, setTitle] = useState(source?.title ?? '');
  const [note, setNote] = useState(source?.note ?? '');
  const [fx, setFx] = useState<{ key: string; text: string }>();
  const [offsetPending, setOffsetPending] = useState(false);
  const [rateLookup, setRateLookup] = useState<{ key: string; rate?: EntryFx }>();

  const [splitOn, setSplitOn] = useState(!!source?.shares.length || !!preset.splitFriendId);
  const [shareIds, setShareIds] = useState<string[]>(source?.shares.map((s) => s.friendId) ?? (preset.splitFriendId ? [preset.splitFriendId] : []));
  const [mode, setMode] = useState<SplitMode>(source?.shares.length ? 'custom' : 'equal');
  const [custom, setCustom] = useState<Record<string, string>>(
    Object.fromEntries((source?.shares ?? []).map((s) => [s.friendId, String(s.amount)]))
  );

  const liveAccounts = accounts.filter((a) => !a.archived || a.id === source?.accountId || a.id === source?.toAccountId);
  const fromId = accountId === undefined ? lastUsedAccountId(accounts, entries) : accountId ?? undefined;
  const account = accounts.find((a) => a.id === fromId);
  // Transfers only move money between accounts in the same currency.
  const sameCurrency = liveAccounts.filter((a) => a.id !== fromId && a.currency === account?.currency);
  const toId = toAccountId ?? sameCurrency[0]?.id;
  const currency = kind === 'settlement' && !account ? 'HKD'
    : source && source.accountId === fromId ? source.currency
    : account?.currency ?? 'HKD';
  const lastFx = latestFx(entries)[currency];
  const savedFx = entry && currency === entry.currency && fromId === entry.accountId && day === localDay(entry.occurredAt)
    ? String(entry.fxRate) : undefined;
  const fxKey = entryFxKey(currency, day);
  const fxDraft = fx?.key === fxKey ? fx.text : undefined;
  const autoFx = rateLookup?.key === fxKey ? rateLookup.rate : undefined;
  const lookingUpFx = currency !== 'HKD' && fxDraft === undefined && savedFx === undefined && rateLookup?.key !== fxKey;
  const resolvedFxText = fxDraft ?? savedFx ?? (autoFx ? String(autoFx.rate) : undefined);
  const fxText = resolvedFxText ?? (lastFx ? String(lastFx) : '');
  const fxLabel = fxDraft !== undefined || savedFx !== undefined ? null
    : autoFx ? `(ECB ${autoFx.date})` : lastFx ? '(last used)' : null;
  const fxRate = currency === 'HKD' ? 1 : parseEntryFxRate(fxText);
  const offsetRate = currency === 'HKD' ? 1 : parseEntryFxRate(resolvedFxText ?? '');

  useEffect(() => {
    if (currency === 'HKD' || fxDraft !== undefined || savedFx !== undefined) return;
    let current = true;
    void fetchEntryFx(currency, day).then((rate) => {
      if (current) setRateLookup({ key: fxKey, rate });
    });
    return () => { current = false; };
  }, [currency, day, fxDraft, fxKey, savedFx]);

  // When editing a repayment, add it back: the balance already includes it.
  const friend = friends.find((f) => f.id === friendId);
  const balance = (friend?.balance ?? 0)
    + (entry?.kind === 'settlement' && entry.friendId === friendId ? offsetAmount(entry.amount, entry.fxRate) : 0);
  const fullOwed = settlementAmount(balance, fxRate);
  const residual = round2(balance - offsetAmount(fullOwed, fxRate));
  const amount = !offsetPending && kind === 'settlement' && amountAuto && friendId ? String(Math.max(0, fullOwed)) : amountText;
  const evaluated = calculateExpression(amount);
  const total = evaluated.status === 'valid' ? evaluated.value : 0;
  // A fetched rate can complete the conversion immediately. Confirm a typed rate by tapping Offset again.
  if (offsetPending && offsetRate > 0 && fxDraft === undefined && evaluated.status === 'valid') {
    setOffsetPending(false);
    setAccountId(null);
    setAmount(String(offsetAmount(total, offsetRate)));
    setFx(undefined);
  }

  const each = splitEqual(total, shareIds.length);
  const shares = splitOn && kind === 'expense'
    ? shareIds.map((fid) => ({ friendId: fid, amount: mode === 'equal' ? each : round2(parseFloat(custom[fid]) || 0) })).filter((s) => s.amount > 0)
    : [];
  const owe = round2(shares.reduce((s, x) => s + x.amount, 0));
  const mine = round2(total - owe);

  const category = categories.find((c) => c.id === categoryId && c.kind === kind);
  const defaultTitle =
    kind === 'settlement' ? `${friend?.name ?? 'Friend'} repaid` : kind === 'transfer' ? 'Transfer' : category?.name ?? KIND_LABEL[kind];

  const amountProblem =
    evaluated.status === 'incomplete' ? 'Finish the expression'
    : evaluated.status === 'invalid' ? evaluated.reason === 'division-by-zero' ? "Can't divide by zero" : 'Check the expression'
    : evaluated.value < 0 ? 'Amount must be positive'
    : 'Enter an amount';

  const problem =
    offsetPending && lookingUpFx ? 'Looking up exchange rate for Offset…'
    : offsetPending && !offsetRate ? `Enter the ${currency} → HKD rate to use Offset`
    : offsetPending && evaluated.status === 'valid' ? 'Tap Offset to convert at this rate'
    : offsetPending ? amountProblem
    : total <= 0 && !(amountAuto && balance > 0 && kind === 'settlement') ? amountProblem
    : lookingUpFx ? 'Looking up exchange rate…'
    : currency !== 'HKD' && !fxRate ? `Enter the ${currency} → HKD rate`
    : total <= 0 ? amountProblem
    : (kind === 'expense' || kind === 'income') && !entry && !category && !(source?.kind === kind && !source.categoryId) ? 'Pick a category'
    : splitOn && kind === 'expense' && mode === 'custom' && shareIds.some((fid) => /^\s*[-−]/.test(custom[fid] ?? '')) ? 'Shares can\'t be negative'
    : splitOn && kind === 'expense' && mode === 'custom' && shareIds.some((fid) => (custom[fid] ?? '').trim() !== '' && !/^\d+(\.\d{1,2})?$/.test(custom[fid].trim())) ? 'Check friends\' shares'
    : kind === 'settlement' && !friendId ? 'Pick a friend'
    : kind === 'transfer' && (!fromId || !toId || fromId === toId) ? 'Pick two different accounts'
    : (kind === 'income' || kind === 'transfer' || (kind === 'expense' && accountId !== null)) && !fromId ? 'Add an account in Wallet first'
    : kind === 'transfer' && accounts.find((a) => a.id === toId)?.currency !== account?.currency ? 'Transfers need two accounts in the same currency'
    : splitOn && kind === 'expense' && mode === 'equal' && tooSmallToSplit(total, shareIds.length) ? 'Too small to split equally'
    : splitOn && kind === 'expense' && shares.length === 0 ? 'Pick who to split with, or turn split off'
    : mine < 0 ? 'Friends\' shares exceed the total'
    : null;

  const pickAccount = (id: string | null) => {
    if (id === null && kind === 'settlement' && currency !== 'HKD') {
      if (!offsetRate || evaluated.status !== 'valid') {
        setAmount(amount);
        setOffsetPending(true);
        return;
      }
      setAmount(String(offsetAmount(total, offsetRate)));
    }
    setOffsetPending(false);
    if ((id ? accounts.find((a) => a.id === id)?.currency : 'HKD') !== currency) setFx(undefined);
    setAccountId(id);
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

  const [calendarOpen, setCalendarOpen] = useState(false);
  const pickDay = (next: string) => {
    if (next !== day) {
      setFx(undefined);
      setRateLookup(undefined);
      setDay(next);
    }
    setCalendarOpen(false);
  };

  const dirty = !entry && (
    !!source || amount !== '0' || kind !== (preset.kind ?? 'expense') || categoryId !== undefined
    || accountId !== undefined || toAccountId !== undefined || friendId !== preset.friendId
    || offsetPending || day !== today || title !== '' || note !== '' || fx !== undefined || splitOn !== !!preset.splitFriendId
    || shareIds.join(',') !== (preset.splitFriendId ?? '') || mode !== 'equal' || Object.keys(custom).length > 0
  );
  const { back, leave, confirming, keepEditing } = useDraftBack(dirty);
  const recent = !entry && !dirty && !preset.friendId && !preset.splitFriendId && !preset.kind
    ? recentEntryTemplates(entries, accounts) : [];
  const repeat = (source: Entry, replace = false) => void nav('/add', { replace, state: { templateId: source.id } });

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
      leave();
    } else {
      showError('Could not save', r.error?.message);
    }
  };

  const remove = async () => {
    if (!entry || !user) return;
    const ownerId = user.id;
    const r = await deleteEntry(entry.id);
    if (r.success) {
      show({
        type: 'success', title: 'Entry deleted', duration: 7000,
        action: r.undoable && !entry.pending && navigator.onLine ? {
          label: 'Undo',
          onClick: () => void restoreEntry(entry, ownerId).then((u) => {
            if (!u.success) showError('Could not undo', u.error?.message);
          }),
        } : undefined,
      });
      leave();
    } else {
      showError('Could not delete', r.error?.message);
    }
  };

  const accountChips = ({ value, onPick, none, from = liveAccounts }: { value?: string; onPick: (id: string | null) => void; none?: string; from?: typeof liveAccounts }) => (
    <div className={`flex gap-2 pb-1 ${kind === 'settlement' ? 'flex-wrap' : 'overflow-x-auto no-scrollbar'}`}>
      {from.map((a) => (
        <Chip key={a.id} active={a.id === value} onClick={() => onPick(a.id)} color="bg-neo-yellow">{a.name}</Chip>
      ))}
      {none && <Chip active={value === undefined} onClick={() => onPick(null)} color="bg-neo-orange">{none}</Chip>}
      {liveAccounts.length === 0 && (
        <p className="text-xs font-bold uppercase text-gray-600">No accounts yet. <Link to="/wallet" className="underline">Add one in Wallet</Link></p>
      )}
    </div>
  );

  const owing = [...friends].sort((a, b) => b.balance - a.balance);

  return (
    <div className="min-h-screen pb-32 bg-neo-bg dark:bg-zinc-950">
      <header className="sticky top-0 z-30 bg-neo-bg/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b-2 border-black px-5 py-3 flex items-center justify-between">
        <button
          type="button"
          onClick={back}
          aria-label="Go back"
          className="w-11 h-11 bg-white dark:bg-zinc-900 border-2 border-black shadow-neo-sm grid place-items-center text-black dark:text-zinc-100"
        >
          <ArrowLeft size={24} aria-hidden="true" />
        </button>
        <h1 className="text-lg font-black uppercase tracking-widest dark:text-zinc-100">{entry ? 'Edit entry' : 'New entry'}</h1>
        {entry ? <DeleteConfirmButton size="expanded" onConfirm={() => void remove()} ariaLabel="Delete entry" /> : <div className="w-10" />}
      </header>

      <main className="p-5 space-y-6 max-w-md mx-auto">
        {entry && canRepeatEntry(entry, accounts) && <Chip onClick={() => repeat(entry)}>Repeat</Chip>}
        {recent.length > 0 && (
          <div>
            <FieldLabel>Recent</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {recent.map((item) => (
                <Chip key={item.id} onClick={() => repeat(item, true)} className="min-w-0 max-w-full">
                  <span className="truncate">{item.title || KIND_LABEL[item.kind]}</span>
                  <span className="shrink-0">{formatCurrency(item.amount, item.currency)}</span>
                </Chip>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-4 gap-2" role="group" aria-label="Entry type">
          {KINDS.map(({ kind: k, color }) => (
            <Chip key={k} active={kind === k} color={color} onClick={() => { if (k !== kind) setOffsetPending(false); setKind(k); }} className="justify-center !px-1 text-[11px] uppercase">
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
                <Chip key={f.id} active={f.id === friendId} onClick={() => setFriendId(f.id)} color="bg-neo-yellow">
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
            {friend && balance > 0 && offsetRate > 0 && !offsetPending && (
              <div className="mt-2">
                {fullOwed > 0 && (
                  <Chip active={total === fullOwed} color="bg-neo-green" onClick={() => { setAmount(String(fullOwed)); setAmountAuto(false); }}>
                    {residual > 0 ? 'Up to' : 'Full'} {formatCurrency(fullOwed, currency)}
                  </Chip>
                )}
                {residual > 0 && (
                  <p className="mt-1 text-xs font-bold text-gray-600 dark:text-zinc-400">
                    {fullOwed > 0 ? `Leaves ${formatCurrency(residual)}` : `Smallest ${currency} amount would overpay`}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {(kind === 'expense' || kind === 'income') && (
          <div>
            <FieldLabel>Category</FieldLabel>
            <CategoryGrid
              categories={categoriesByUse(categories, entries, kind === 'income' ? 'income' : 'expense').concat(category?.archived ? [category] : [])}
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
            onPick: pickAccount,
            none: kind === 'settlement' ? 'Offset (no money moved)' : kind === 'expense' && source && !source.accountId ? 'No account' : undefined,
          })}
          {currency !== 'HKD' && (
            <label className="flex flex-wrap items-center gap-2 mt-2 text-xs font-bold uppercase dark:text-zinc-100">
              1 {currency} =
              <input
                inputMode="decimal"
                aria-label={`${currency} to HKD rate`}
                placeholder="rate"
                value={fxText}
                onChange={(e) => setFx({ key: fxKey, text: e.target.value })}
                className="w-24 border-2 border-black p-1 text-right bg-white dark:bg-zinc-900"
              />
              HKD
              {fxLabel && <span className="text-gray-600 dark:text-zinc-400">{fxLabel}</span>}
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
          <div className="flex flex-wrap gap-2">
            <Chip active={!calendarOpen && day === today} onClick={() => pickDay(today)}>Today</Chip>
            <Chip active={!calendarOpen && day === yesterday} onClick={() => pickDay(yesterday)}>Yesterday</Chip>
            <Chip active={calendarOpen || (day !== today && day !== yesterday)} onClick={() => setCalendarOpen((v) => !v)}>
              <CalendarDays size={16} aria-hidden="true" />
              {day !== today && day !== yesterday ? dayLabel(day) : 'Pick date'}
            </Chip>
          </div>
          {calendarOpen && <DatePicker value={day} today={today} onPick={pickDay} />}
        </div>

        <div>
          <FieldLabel>Title (optional)</FieldLabel>
          <NeoInput aria-label="Title" placeholder={defaultTitle} value={title} onChange={(e) => setTitle(e.target.value)} />
          <FieldLabel>Note</FieldLabel>
          <NeoInput aria-label="Note" placeholder="Anything to remember" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </main>

      <NeoModal
        isOpen={confirming}
        onClose={keepEditing}
        title="Discard this entry?"
        footer={
          <>
            <NeoButton className="!px-3" variant="neutral" onClick={keepEditing}>Keep editing</NeoButton>
            <NeoButton className="!px-3" onClick={leave}>Discard</NeoButton>
          </>
        }
      >
        <p>Your unsaved changes will be lost.</p>
      </NeoModal>

      <div className="fixed bottom-0 inset-x-0 z-40 bg-neo-bg dark:bg-zinc-950 border-t-2 border-black p-4">
        <div className="max-w-md mx-auto">
          {problem && <p className="text-xs font-black uppercase text-neo-danger mb-2 text-center">{problem}</p>}
          <NeoButton fullWidth variant="primary" disabled={!!problem} isLoading={isProcessing} onClick={() => void save()}>
            {entry ? 'Save changes' : `Save ${KIND_LABEL[kind].toLowerCase()}`}
            {total > 0 && ` · ${formatCurrency(total, currency)}`}
          </NeoButton>
        </div>
      </div>
    </div>
  );
};
