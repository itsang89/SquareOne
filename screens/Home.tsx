import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDownLeft, Plus, Search, Settings, Users } from 'lucide-react';
import { NeoCard } from '../components/NeoCard';
import { Avatar } from '../components/Avatar';
import { EntryRow } from '../components/EntryRow';
import { MonthSummary } from '../components/Home/MonthSummary';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { DataLoadErrorBanner } from '../components/DataLoadErrorBanner';
import { TransactionSkeleton, FriendSkeleton } from '../components/LoadingSkeleton';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useSearch } from '../context/SearchContext';
import { totalOwed } from '../utils/calculations';
import { formatCurrency } from '../utils/formatters';

const iconBtn =
  'w-11 h-11 bg-white dark:bg-zinc-900 border-2 border-black shadow-neo-sm active:shadow-none active:translate-y-0.5 grid place-items-center text-black dark:text-zinc-100';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { friends, entries, accounts, categories, loading, error, refetch } = useAppContext();
  const { user } = useAuth();
  const { openSearch } = useSearch();

  const owed = useMemo(() => totalOwed(entries), [entries]);
  const owing = useMemo(
    () => friends.filter((f) => f.balance > 0.005).sort((a, b) => b.balance - a.balance),
    [friends]
  );
  const lookups = useMemo(() => ({ accounts, categories, friends }), [accounts, categories, friends]);
  const recent = entries.slice(0, 10);

  return (
    <div className="min-h-screen pb-28 bg-neo-bg dark:bg-zinc-950 transition-colors duration-300">
      <header className="sticky top-0 z-20 bg-neo-bg/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b-2 border-black px-5 py-3 flex items-center justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-black uppercase leading-none dark:text-zinc-100">SquareOne</h2>
          <p className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-widest mt-1 truncate">Hi, {user?.name || 'there'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={openSearch} className={iconBtn} aria-label="Search"><Search size={20} strokeWidth={2.5} /></button>
          <Link to="/friends" className={iconBtn} aria-label="Friends"><Users size={20} strokeWidth={2.5} /></Link>
          <Link to="/profile" className={iconBtn} aria-label="Settings"><Settings size={20} strokeWidth={2.5} /></Link>
        </div>
      </header>

      <DataLoadErrorBanner error={error} loading={loading} onRetry={refetch} />

      <div className="p-5 space-y-6">
        <Link
          to="/add"
          className="flex items-center justify-center gap-3 w-full py-4 bg-neo-yellow border-2 border-black shadow-neo font-black uppercase text-xl text-black active:shadow-neo-pressed active:translate-x-1 active:translate-y-1 transition-all"
        >
          <Plus size={28} strokeWidth={3} /> Add entry
        </Link>

        <MonthSummary />

        <section>
          <Link to="/friends" className="block bg-neo-orange border-2 border-black shadow-neo p-4 text-black">
            <p className="text-xs font-bold uppercase tracking-widest text-black/70">Friends owe you</p>
            <p className="text-3xl font-black tracking-tighter"><AnimatedNumber value={owed} decimals={2} prefix="HK$" /></p>
          </Link>
          {loading ? (
            <div className="flex gap-4 overflow-x-auto py-4">{[1, 2, 3].map((i) => <FriendSkeleton key={i} />)}</div>
          ) : owing.length > 0 && (
            <div className="flex overflow-x-auto no-scrollbar gap-3 pt-4 snap-x">
              {owing.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => navigate(`/friends/${f.id}`)}
                  className="snap-start shrink-0 w-28 bg-white dark:bg-zinc-900 border-2 border-black p-3 shadow-neo-sm flex flex-col items-center gap-1"
                >
                  <div className="relative">
                    <Avatar src={f.avatar} alt={f.name} size="md" />
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white bg-neo-greenDark grid place-items-center">
                      <ArrowDownLeft size={12} className="text-white" />
                    </span>
                  </div>
                  <p className="text-sm font-bold truncate w-full dark:text-zinc-100">{f.name.split(' ')[0]}</p>
                  <p className="text-xs font-bold text-neo-greenDark">{formatCurrency(f.balance)}</p>
                </button>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-black uppercase border-l-4 border-black dark:border-zinc-100 pl-2 dark:text-zinc-100">Recent</h3>
            <Link to="/ledger" className="text-xs font-bold uppercase underline decoration-2 dark:text-zinc-100">Ledger</Link>
          </div>
          {loading ? (
            [1, 2, 3, 4, 5].map((i) => <TransactionSkeleton key={i} />)
          ) : recent.length > 0 ? (
            <div className="border-2 border-black shadow-neo-sm divide-y-2 divide-black/10">
              {recent.map((e) => <EntryRow key={e.id} entry={e} lookups={lookups} />)}
            </div>
          ) : (
            <NeoCard className="text-center py-8">
              <p className="text-lg font-black uppercase dark:text-zinc-100">Nothing here yet</p>
              <p className="text-xs font-bold uppercase text-gray-500 mt-1">Tap Add entry to log your first expense.</p>
            </NeoCard>
          )}
        </section>
      </div>
    </div>
  );
};
