import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Pencil, Trash2, Calendar, X, Tag } from 'lucide-react';
import { NeoInput } from '../components/NeoInput';
import { BackButton } from '../components/BackButton';
import { Avatar } from '../components/Avatar';
import { DataLoadErrorBanner } from '../components/DataLoadErrorBanner';
import { useAppContext } from '../context/AppContext';
import { Transaction } from '../types';
import { shouldGrayTransaction } from '../utils/calculations';
import { useTimeout } from '../hooks/useTimeout';
import { useToast } from '../components/ToastContext';
import { TransactionSkeleton } from '../components/LoadingSkeleton';
import { formatCurrency } from '../utils/formatters';
import { staggerContainer, staggerItem, springs } from '../utils/animations';
import { useAnimations } from '../hooks/useAnimations';
import { matchesTransactionQuery, normalizeSearchQuery, getTransactionCounterparty } from '../utils/search';
import { useSearch } from '../context/SearchContext';
import { DateRangePicker } from '../components/AddTransaction/DateRangePicker';
import { TRANSACTION_TAGS } from '../constants';

type FilterType = string;
type SortType = 'date' | 'event';

type DateRange = { start: string | null; end: string | null };
type DatePreset = 'all' | '7days' | '30days' | '3months';

const DATE_PRESETS: { label: string; value: DatePreset }[] = [
  { label: 'All Time', value: 'all' },
  { label: 'Last 7d', value: '7days' },
  { label: 'Last 30d', value: '30days' },
  { label: 'Last 3m', value: '3months' },
];

const BUILT_IN_LABELS = new Set(TRANSACTION_TAGS.map(t => t.label));

type HistoryLocationState = { historySearchQuery?: string };

export const History: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { transactions, friends, deleteTransaction, customTypes, loading, error, refetch } = useAppContext();
  const { openSearch } = useSearch();
  const { success, error: showError } = useToast();
  const { getVariants, getTransition } = useAnimations();
  
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [sortBy, setSortBy] = useState<SortType>('date');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customRange, setCustomRange] = useState<DateRange>({ start: null, end: null });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const typeDropdownRef = useRef<HTMLDivElement>(null);

  const [prevLocationKey, setPrevLocationKey] = useState(location.key);
  if (prevLocationKey !== location.key) {
    setPrevLocationKey(location.key);
    const q = (location.state as HistoryLocationState | null)?.historySearchQuery;
    if (typeof q === 'string') setSearchQuery(q);
  }

  useTimeout(() => setDeletingId(null), deletingId ? 3000 : null, [deletingId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target as Node)) {
        setShowTypeDropdown(false);
      }
    };
    if (showTypeDropdown) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTypeDropdown]);

  const handleEdit = (tx: Transaction) => {
    navigate('/add', { state: { editTransaction: tx } });
  };

  const handleDelete = async (tx: Transaction) => {
    if (deletingId === tx.id) {
      const result = await deleteTransaction(tx.id);
      if (result.success) {
        success('Transaction deleted');
      } else {
        showError('Delete failed', result.error?.message);
      }
      setDeletingId(null);
    } else {
      setDeletingId(tx.id);
    }
  };

  const dynamicChips = useMemo(() => {
    const builtIns = ['All', ...TRANSACTION_TAGS.map(t => t.label), 'Unsettled'];
    const custom = customTypes.filter(c => !BUILT_IN_LABELS.has(c));
    return [...builtIns, ...custom];
  }, [customTypes]);

  const effectiveRange = useMemo((): DateRange => {
    if (datePreset !== 'all' && !customRange.start && !customRange.end) {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const start = new Date();
      if (datePreset === '7days') start.setDate(start.getDate() - 7);
      else if (datePreset === '30days') start.setDate(start.getDate() - 30);
      else if (datePreset === '3months') start.setMonth(start.getMonth() - 3);
      start.setHours(0, 0, 0, 0);
      return { start: start.toISOString(), end: end.toISOString() };
    }
    return customRange;
  }, [datePreset, customRange]);

  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    if (searchQuery.trim()) {
      const query = normalizeSearchQuery(searchQuery);
      filtered = filtered.filter((tx) => matchesTransactionQuery(tx, query, friends));
    }

    if (activeFilter !== 'All') {
      if (activeFilter === 'Unsettled') {
        filtered = filtered.filter(tx => {
          if (tx.isSettlement) return false;
          const friendId = tx.friendId !== 'me' ? tx.friendId : tx.payerId;
          return !shouldGrayTransaction(tx, friendId, transactions);
        });
      } else {
        filtered = filtered.filter(tx => tx.type === activeFilter);
      }
    }

    if (effectiveRange.start) {
      const startMs = new Date(effectiveRange.start).getTime();
      filtered = filtered.filter(tx => new Date(tx.date).getTime() >= startMs);
    }
    if (effectiveRange.end) {
      const endMs = new Date(effectiveRange.end).getTime();
      filtered = filtered.filter(tx => new Date(tx.date).getTime() <= endMs);
    }

    if (sortBy === 'date') {
      filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else {
      filtered.sort((a, b) => {
        if (a.type !== b.type) return a.type.localeCompare(b.type);
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
    }

    return filtered;
  }, [transactions, searchQuery, activeFilter, sortBy, friends, effectiveRange]);

  const groupedTransactions = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    filteredTransactions.forEach((tx: Transaction) => {
      const txDate = new Date(tx.date);
      if (isNaN(txDate.getTime())) return;
      
      const txDateOnly = new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate());
      const diffTime = today.getTime() - txDateOnly.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      let groupKey: string;
      if (diffDays === 0) groupKey = 'Today';
      else if (diffDays === 1) groupKey = 'Yesterday';
      else if (diffDays < 7) groupKey = 'This Week';
      else if (diffDays < 30) groupKey = 'This Month';
      else groupKey = txDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(tx);
    });
    
    const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
      if (a === 'Today') return -1;
      if (b === 'Today') return 1;
      if (a === 'Yesterday') return -1;
      if (b === 'Yesterday') return 1;
      if (a === 'This Week') return -1;
      if (b === 'This Week') return 1;
      if (a === 'This Month') return -1;
      if (b === 'This Month') return 1;
      
      const dateA = new Date(a);
      const dateB = new Date(b);
      if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
        return dateB.getTime() - dateA.getTime();
      }
      return 0;
    });
    
    const sortedGroups: Record<string, Transaction[]> = {};
    sortedGroupKeys.forEach(key => {
      sortedGroups[key] = groups[key];
    });
    
    return sortedGroups;
  }, [filteredTransactions]);

  const handleFilterReset = () => {
    setSearchQuery('');
    setActiveFilter('All');
    setSortBy('date');
    setDatePreset('all');
    setCustomRange({ start: null, end: null });
  };

  const handlePresetSelect = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset !== 'all') {
      setCustomRange({ start: null, end: null });
    }
  };

  const handleRangeSelect = (start: string | null, end: string | null) => {
    setCustomRange({ start, end });
    setDatePreset('all');
  };

  const hasNonDefaultFilter = activeFilter !== 'All' || datePreset !== 'all' || customRange.start || customRange.end;

  return (
    <div className="min-h-screen bg-neo-bg dark:bg-zinc-950 flex flex-col pb-24 relative overflow-hidden transition-colors duration-300">
        <header className="flex items-center justify-between p-4 bg-neo-bg dark:bg-zinc-950 border-b-2 border-black z-20 shrink-0">
            <BackButton to="/dashboard" />
            <h1 className="text-xl font-bold tracking-tight uppercase dark:text-zinc-100">History</h1>
            <button
              type="button"
              onClick={openSearch}
              className="flex items-center justify-center w-10 h-10 rounded-md border-2 border-black bg-white dark:bg-zinc-900 shadow-neo-sm hover:bg-neo-blue/20 transition-colors"
              aria-label="Open global search"
            >
                <Search className="text-black dark:text-zinc-100" size={20} strokeWidth={2.5} />
            </button>
        </header>

        <DataLoadErrorBanner error={error} loading={loading} onRetry={refetch} />

        <div className="flex flex-col gap-3 p-4 pb-2 bg-neo-bg dark:bg-zinc-950 shrink-0 z-10">
            <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                    <Search className="text-black dark:text-zinc-100" size={20} />
                </div>
                <NeoInput 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search friend, note, amount..."
                    className="pl-10"
                    fullWidth
                />
            </div>

            {/* Type filter dropdown */}
            <div className="relative" ref={typeDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowTypeDropdown(d => !d)}
                  className={`w-full px-4 py-2.5 rounded-md border-2 border-black text-black font-bold text-sm shadow-neo-sm transition-all flex items-center justify-between gap-2 ${showTypeDropdown ? 'bg-neo-purple text-white' : 'bg-white dark:bg-zinc-900 dark:text-zinc-100 hover:bg-gray-50 dark:hover:bg-zinc-800'}`}
                >
                    <span className="flex items-center gap-2">
                        <Tag size={14} />
                        <span>{activeFilter}</span>
                    </span>
                    <svg className={`w-4 h-4 transition-transform shrink-0 ${showTypeDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {showTypeDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border-2 border-black rounded-md shadow-neo z-50 max-h-64 overflow-y-auto"
                    >
                        {dynamicChips.map(chip => (
                            <button
                              key={chip}
                              onClick={() => { setActiveFilter(chip); setShowTypeDropdown(false); }}
                              className={`w-full px-4 py-2.5 text-left font-bold text-sm transition-colors first:rounded-t-md last:rounded-b-md ${activeFilter === chip ? 'bg-neo-purple text-white' : 'text-black dark:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}
                            >
                                {chip}
                            </button>
                        ))}
                    </motion.div>
                )}
            </div>

            {/* Date range presets + custom */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 items-center">
                {DATE_PRESETS.map(preset => (
                    <button
                      key={preset.value}
                      onClick={() => handlePresetSelect(preset.value)}
                      className={`shrink-0 px-3 py-1.5 rounded-md border-2 border-black text-black font-bold text-xs shadow-neo-sm active:shadow-none active:translate-y-1 transition-all whitespace-nowrap ${datePreset === preset.value && !customRange.start && !customRange.end ? 'bg-black text-white dark:bg-zinc-100 dark:text-black' : 'bg-white dark:bg-zinc-900 dark:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}
                    >
                        {preset.label}
                    </button>
                ))}
                <button
                  onClick={() => setShowDatePicker(true)}
                  className={`shrink-0 px-3 py-1.5 rounded-md border-2 border-black font-bold text-xs shadow-neo-sm active:shadow-none active:translate-y-1 transition-all whitespace-nowrap flex items-center gap-1.5 ${(customRange.start || customRange.end) ? 'bg-black text-white dark:bg-zinc-100 dark:text-black' : 'bg-white dark:bg-zinc-900 dark:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}
                >
                    <Calendar size={12} />
                    {customRange.start || customRange.end
                      ? `${customRange.start ? new Date(customRange.start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '…'} – ${customRange.end ? new Date(customRange.end).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '…'}`
                      : 'Custom'}
                </button>
                {hasNonDefaultFilter && (
                    <button
                      onClick={handleFilterReset}
                      className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-md border-2 border-neo-red text-neo-red font-bold text-xs hover:bg-neo-red/10 transition-all"
                    >
                        <X size={12} /> Clear
                    </button>
                )}
            </div>

            {/* Sort toggle */}
            <div className="flex w-full bg-white dark:bg-zinc-900 rounded-md border-2 border-black p-1 shadow-neo-sm">
                <button 
                  onClick={() => setSortBy('date')}
                  className={`flex-1 py-1.5 text-sm rounded text-center transition-all ${sortBy === 'date' ? 'font-bold bg-black dark:bg-zinc-100 text-white dark:text-black shadow-sm' : 'font-medium text-gray-500 dark:text-zinc-500 hover:text-black dark:hover:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}
                >
                    By Date
                </button>
                <button 
                  onClick={() => setSortBy('event')}
                  className={`flex-1 py-1.5 text-sm rounded text-center transition-all ${sortBy === 'event' ? 'font-bold bg-black dark:bg-zinc-100 text-white dark:text-black shadow-sm' : 'font-medium text-gray-500 dark:text-zinc-500 hover:text-black dark:hover:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}
                >
                    By Event
                </button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pt-4">
            {loading ? (
              <div className="flex flex-col gap-4">
                {[1, 2, 3, 4, 5].map(i => <TransactionSkeleton key={i} />)}
              </div>
            ) : error && transactions.length === 0 ? (
              <div className="py-12 text-center px-4">
                <p className="text-sm font-bold uppercase text-gray-700 dark:text-zinc-400 max-w-sm mx-auto">
                  We couldn&apos;t load your history. Use Retry above or check your connection.
                </p>
              </div>
            ) : filteredTransactions.length > 0 && Object.keys(groupedTransactions).length > 0 ? (
              (Object.entries(groupedTransactions) as [string, Transaction[]][]).map(([groupName, txs]) => (
                <div key={groupName} className="mb-6">
                  <motion.div 
                    className="flex items-center gap-4 mb-3"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={getTransition(springs.gentle)}
                  >
                    <h3 className="text-xs font-bold uppercase tracking-widest text-black dark:text-zinc-400">{groupName}</h3>
                    <div className="h-[2px] flex-1 bg-black/10 dark:bg-white/10"></div>
                  </motion.div>
                  
                  <motion.div
                    variants={getVariants(staggerContainer)}
                    initial="hidden"
                    animate="visible"
                  >
                    {txs.map(tx => {
                    const { friend, counterpartyId: friendIdForGraying } = getTransactionCounterparty(tx, friends);
                    const friendName = friend?.name || 'Unknown';
                    const friendAvatar = friend?.avatar || '';

                    const isGrayed = friendIdForGraying ? shouldGrayTransaction(tx, friendIdForGraying, transactions) : false;
                    
                    return (
                      <motion.div 
                        key={tx.id} 
                        className={`group relative flex items-center gap-3 p-3 mb-3 rounded-md border-2 border-black shadow-neo ${tx.payerId === 'me' ? 'bg-neo-green/20 dark:bg-neo-green/10' : 'bg-neo-red/20 dark:bg-neo-red/10'} ${isGrayed ? 'opacity-50 grayscale' : tx.isSettlement ? 'opacity-60' : ''} ${deletingId === tx.id ? 'border-neo-red' : ''}`}
                        variants={getVariants(staggerItem)}
                        whileHover={{ scale: 1.01, y: -2 }}
                        whileTap={{ scale: 0.99, y: 1 }}
                        transition={getTransition(springs.snappy)}
                      >
                        <div className="relative shrink-0">
                          <Avatar src={friendAvatar} alt={friendName} size="md" />
                          {!tx.isSettlement && (
                            <div className={`absolute -bottom-1 -right-1 border-2 border-white dark:border-zinc-950 rounded-full w-4 h-4 ${tx.payerId === 'me' ? 'bg-neo-green' : 'bg-neo-red'}`}></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <h4 className={`font-bold text-base truncate dark:text-zinc-100 ${isGrayed ? 'text-gray-500 dark:text-zinc-500' : ''}`}>{friendName}</h4>
                            <span className={`font-bold whitespace-nowrap px-1 rounded ${isGrayed ? 'text-gray-500 dark:text-zinc-500 bg-white/50 dark:bg-zinc-800/50' : tx.payerId === 'me' ? 'text-green-700 dark:text-neo-greenDark bg-white/50 dark:bg-zinc-800/50' : 'text-red-700 dark:text-neo-red bg-white/50 dark:bg-zinc-800/50'}`}>
                              {tx.isSettlement ? '✓ ' : ''}{tx.payerId === 'me' ? '+' : '-'} {formatCurrency(tx.amount)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center mt-0.5">
                            <p className={`text-xs font-medium truncate dark:text-zinc-300 ${isGrayed ? 'text-gray-400 dark:text-zinc-600' : 'text-gray-700 dark:text-zinc-300'}`}>
                              {tx.isSettlement ? 'Settlement' : tx.title} {tx.note && `• ${tx.note}`}
                            </p>
                            <span className={`text-xs font-mono ml-2 shrink-0 ${isGrayed ? 'text-gray-400 dark:text-zinc-600' : 'text-gray-500 dark:text-zinc-500'}`}>
                              {new Date(tx.date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                        <div className="ml-2 flex items-center gap-1 shrink-0">
                          {!tx.isSettlement && (
                            <motion.button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(tx);
                              }}
                              className="p-2 rounded-md border-2 border-black transition-all bg-white dark:bg-zinc-800 dark:text-zinc-100 hover:bg-neo-blue/30"
                              aria-label="Edit transaction"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <Pencil size={16} />
                            </motion.button>
                          )}
                          <motion.button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(tx);
                            }}
                            className={`p-2 rounded-md border-2 border-black transition-all ${
                              deletingId === tx.id 
                                ? 'bg-neo-red text-white shadow-neo-sm' 
                                : 'bg-white dark:bg-zinc-800 dark:text-zinc-100 hover:bg-neo-red/20'
                            }`}
                            aria-label="Delete transaction"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <Trash2 size={16} />
                          </motion.button>
                        </div>
                      </motion.div>
                    );
                  })}
                  </motion.div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center">
                <p className="text-sm font-bold uppercase text-gray-400 dark:text-zinc-600">No transactions found</p>
              </div>
            )}
            
            <div className="py-8 text-center opacity-30">
                <p className="text-[10px] uppercase tracking-widest font-bold dark:text-zinc-500">End of History</p>
            </div>
        </div>

        <DateRangePicker
          startDate={customRange.start}
          endDate={customRange.end}
          onSelect={handleRangeSelect}
          isOpen={showDatePicker}
          onClose={() => setShowDatePicker(false)}
        />
    </div>
  );
};
