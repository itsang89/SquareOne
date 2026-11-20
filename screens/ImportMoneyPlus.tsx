import { useState, type ChangeEvent } from 'react';
import { BackButton } from '../components/BackButton';
import { NeoButton } from '../components/NeoButton';
import { NeoCard } from '../components/NeoCard';
import { useAppContext as useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { ARCHIVED_ACCOUNTS, parseMoneyPlus, previewImport, toEntryRow, type MoneyPlusRow } from '../utils/moneyPlusImport';
import { supabase } from '../utils/supabase';

const BATCH = 500;
const fmt = (n: number) => n.toLocaleString('en-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ImportMoneyPlus() {
  const { user } = useAuth();
  const { accounts, categories, refetch } = useApp();
  const [rows, setRows] = useState<MoneyPlusRow[] | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setRows(null); setResult(null); setError('');
    if (!file) return;
    try { const r = parseMoneyPlus(await file.text()); setRows(r.rows); setSkipped(r.skipped); } catch (err) { setError((err as Error).message); }
  };

  const run = async () => {
    if (!rows || !user) return;
    const uid = user.id;
    setError(''); setProgress(0);
    try {
      const p = previewImport(rows);
      const have = new Set(accounts.map((a) => a.name.toLowerCase()));
      const newAccounts = Object.keys(p.balances).filter((n) => !have.has(n.toLowerCase()))
        .map((name, i) => ({ user_id: uid, name, archived: ARCHIVED_ACCOUNTS.includes(name), sort: accounts.length + i }));
      const haveCat = new Set(categories.map((c) => `${c.kind}:${c.name}`));
      const newCats = p.categories.filter((c) => !haveCat.has(`${c.kind}:${c.name}`)).map((c, i) => ({ user_id: uid, ...c, sort: categories.length + i }));
      if (newAccounts.length) { const { error: e } = await supabase.from('accounts').insert(newAccounts); if (e) throw e; }
      if (newCats.length) { const { error: e } = await supabase.from('categories').insert(newCats); if (e) throw e; }

      const [{ data: accs, error: ea }, { data: cats, error: ec }] = await Promise.all([
        supabase.from('accounts').select('id,name').eq('user_id', uid),
        supabase.from('categories').select('id,kind,name').eq('user_id', uid),
      ]);
      if (ea || ec) throw ea ?? ec;
      const accMap = new Map(accs!.map((a: { id: string; name: string }) => [a.name.toLowerCase(), a.id as string]));
      const catMap = new Map(cats!.map((c: { id: string; kind: string; name: string }) => [`${c.kind}:${c.name}`, c.id as string]));

      let added = 0;
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = await Promise.all(rows.slice(i, i + BATCH).map(async (r) => ({
          user_id: uid,
          ...(await toEntryRow(r, (n) => accMap.get(n.toLowerCase())!, (k, n) => catMap.get(`${k}:${n}`))),
        })));
        // Re-import is a no-op: rows whose deterministic request_id exists are skipped.
        const { data, error: e } = await supabase.from('entries')
          .upsert(batch, { onConflict: 'user_id,request_id', ignoreDuplicates: true }).select('id');
        if (e) throw e;
        added += data.length;
        setProgress(Math.min(i + BATCH, rows.length));
      }
      setResult({ added, skipped: rows.length - added });
      await refetch();
    } catch (err) {
      setError((err as Error).message ?? 'Import failed.');
    } finally {
      setProgress(null);
    }
  };

  const preview = rows && previewImport(rows);
  const busy = progress !== null;

  return (
    <div className="p-4 pb-32 max-w-lg mx-auto flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <BackButton />
        <h1 className="text-2xl font-black uppercase dark:text-zinc-100">Import Money+</h1>
      </div>

      <NeoCard>
        <p className="text-sm font-bold mb-3 dark:text-zinc-100">Pick the Money+ CSV export. Nothing is saved until you press Import.</p>
        <input type="file" accept=".csv,text/csv" onChange={pick} disabled={busy} aria-label="Money+ CSV file" className="w-full text-sm dark:text-zinc-100" />
      </NeoCard>

      {error && <div role="alert" className="border-2 border-black bg-neo-red p-3 font-bold text-sm text-black">{error}</div>}

      {preview && !result && (
        <>
          <NeoCard>
            <h2 className="text-xs font-black uppercase tracking-widest mb-2 dark:text-zinc-400">{rows.length} rows · {preview.from} → {preview.to}</h2>
            <p className="font-bold dark:text-zinc-100">{preview.counts.expense} expenses · {preview.counts.income} income · {preview.counts.transfer} transfers</p>
            {skipped > 0 && <p className="text-xs mt-1 dark:text-zinc-400">{skipped} zero-amount rows skipped.</p>}
          </NeoCard>
          <NeoCard>
            <h2 className="text-xs font-black uppercase tracking-widest mb-2 dark:text-zinc-400">Accounts (balance from this file)</h2>
            <ul className="flex flex-col gap-1">
              {Object.entries(preview.balances).map(([name, bal]) => (
                <li key={name} className="flex justify-between font-bold dark:text-zinc-100">
                  <span>{name}{ARCHIVED_ACCOUNTS.includes(name) && <span className="text-xs opacity-60"> · archived</span>}</span>
                  <span className="tabular-nums">{fmt(bal)}</span>
                </li>
              ))}
            </ul>
          </NeoCard>
          <NeoCard>
            <h2 className="text-xs font-black uppercase tracking-widest mb-2 dark:text-zinc-400">Categories ({preview.categories.length})</h2>
            <p className="text-sm dark:text-zinc-100">Missing ones are created: {preview.categories.map((c) => c.name).join(', ')}</p>
          </NeoCard>
          <NeoButton fullWidth onClick={run} isLoading={busy} disabled={busy}>
            {busy ? `Importing ${progress}/${rows.length}` : `Import ${rows.length} rows`}
          </NeoButton>
        </>
      )}

      {result && (
        <NeoCard>
          <p className="font-black text-lg dark:text-zinc-100">Done. {result.added} added{result.skipped > 0 && `, ${result.skipped} already there`}.</p>
        </NeoCard>
      )}
    </div>
  );
}
