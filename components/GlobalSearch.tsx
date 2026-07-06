import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useSearch } from '../context/SearchContext';
import { NeoInput, Avatar } from './NeoComponents';
import { searchAll, getTransactionCounterparty } from '../utils/search';
import { formatCurrency } from '../utils/formatters';
import type { Friend, Transaction } from '../types';
import { modalBackdrop, modalContent } from '../utils/animations';
import { useAnimations } from '../hooks/useAnimations';
import { useFocusTrap } from '../hooks/useFocusTrap';

const DEBOUNCE_MS = 220;

export const GlobalSearch: React.FC = () => {
  const { friends, transactions } = useAppContext();
  const { open, openSearch, closeSearch: closeSearchCtx } = useSearch();
  const navigate = useNavigate();
  const { getVariants } = useAnimations();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  const [input, setInput] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(input), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [input]);

  const closeSearch = useCallback(() => {
    setInput('');
    setDebounced('');
    closeSearchCtx();
  }, [closeSearchCtx]);

  const { friendMatches, txMatches } = useMemo(() => {
    const { friends: f, transactions: tx } = searchAll(friends, transactions, debounced);
    return { friendMatches: f, txMatches: tx };
  }, [friends, transactions, debounced]);

  const hasQuery = debounced.trim().length > 0;
  const noResults = hasQuery && friendMatches.length === 0 && txMatches.length === 0;

  useFocusTrap(dialogRef, open, closeSearch, { initialFocusDelay: 'raf' });

  useEffect(() => {
    const onShortcut = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== 'k') return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('[data-global-search-ignore-shortcut]')) return;
      e.preventDefault();
      openSearch();
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, [openSearch]);

  const goFriend = (f: Friend) => {
    closeSearch();
    navigate(`/friends/${f.id}`);
  };

  const goTransaction = (_tx: Transaction) => {
    const q = debounced.trim();
    closeSearch();
    navigate('/history', q ? { state: { historySearchQuery: q } } : undefined);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[1000] flex flex-col pointer-events-auto">
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeSearch}
            variants={getVariants(modalBackdrop)}
            initial="hidden"
            animate="visible"
            exit="exit"
            aria-hidden="true"
          />
          <motion.div
            key="global-search-panel"
            ref={dialogRef}
            data-global-search-ignore-shortcut
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative flex flex-col flex-1 min-h-0 m-3 mt-6 mb-8 max-w-md mx-auto w-full bg-white dark:bg-zinc-900 border-4 border-black shadow-neo"
            variants={getVariants(modalContent)}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="flex items-center gap-2 p-3 border-b-4 border-black bg-neo-yellow shrink-0">
              <Search className="shrink-0 text-black" size={22} strokeWidth={2.5} aria-hidden />
              <div className="flex-1 min-w-0">
                <label htmlFor="global-search-input" className="sr-only">
                  Search friends and transactions
                </label>
                <NeoInput
                  id="global-search-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Search friends, titles, notes…"
                  fullWidth
                  className="!border-2 !border-black"
                />
              </div>
              <button
                type="button"
                onClick={closeSearch}
                className="shrink-0 w-10 h-10 flex items-center justify-center border-2 border-black bg-white hover:bg-neo-red/20 transition-colors"
                aria-label="Close search"
              >
                <X size={20} className="text-black" />
              </button>
            </div>
            <h2 id={titleId} className="sr-only">
              Global search
            </h2>
            <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-600 dark:text-zinc-500 border-b border-black/10">
              ⌘K / Ctrl+K to open from anywhere
            </p>

            <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-6 min-h-[40vh]">
              {!hasQuery ? (
                <p className="text-sm font-bold text-gray-500 dark:text-zinc-500 text-center py-8">
                  Type to search your friends and transactions.
                </p>
              ) : noResults ? (
                <p className="text-sm font-bold uppercase text-gray-400 dark:text-zinc-600 text-center py-8">
                  No results
                </p>
              ) : (
                <>
                  {friendMatches.length > 0 && (
                    <section aria-label="Friends">
                      <h3 className="text-xs font-black uppercase tracking-widest mb-2 text-black dark:text-zinc-300">
                        Friends
                      </h3>
                      <ul className="space-y-2">
                        {friendMatches.map((f) => (
                          <li key={f.id}>
                            <button
                              type="button"
                              onClick={() => goFriend(f)}
                              className="w-full flex items-center gap-3 p-2 border-2 border-black bg-neo-bg dark:bg-zinc-950 shadow-neo-sm hover:bg-neo-blue/20 text-left transition-colors"
                            >
                              <Avatar src={f.avatar} alt={f.name} size="sm" />
                              <span className="font-bold truncate dark:text-zinc-100">{f.name}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                  {txMatches.length > 0 && (
                    <section aria-label="Transactions">
                      <h3 className="text-xs font-black uppercase tracking-widest mb-2 text-black dark:text-zinc-300">
                        Transactions
                      </h3>
                      <ul className="space-y-2">
                        {txMatches.map((tx) => {
                          const { friend } = getTransactionCounterparty(tx, friends);
                          const name = friend?.name ?? 'Unknown';
                          return (
                            <li key={tx.id}>
                              <button
                                type="button"
                                onClick={() => goTransaction(tx)}
                                className="w-full flex items-center gap-3 p-2 border-2 border-black bg-white dark:bg-zinc-950 shadow-neo-sm hover:bg-neo-purple/20 text-left transition-colors"
                              >
                                <Avatar src={friend?.avatar ?? ''} alt={name} size="sm" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between gap-2">
                                    <span className="font-bold truncate dark:text-zinc-100">{name}</span>
                                    <span className="font-bold shrink-0 text-sm">
                                      {formatCurrency(tx.amount)}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-600 dark:text-zinc-400 truncate">
                                    {tx.isSettlement ? 'Settlement' : tx.title}
                                    {tx.note ? ` • ${tx.note}` : ''}
                                  </p>
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
