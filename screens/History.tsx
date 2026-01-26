import React, { useState, useMemo } from 'react';
import { Search, MoreVertical, Filter, Trash2 } from 'lucide-react';
import { BackButton, Avatar, NeoInput, NeoButton } from '../components/NeoComponents';
import { useAppContext } from '../context/AppContext';
import { Transaction } from '../types';
import { shouldGrayTransaction } from '../utils/calculations';
import { useTimeout } from '../hooks/useTimeout';
import { useToast } from '../components/ToastContext';
import { TransactionSkeleton } from '../components/LoadingSkeleton';
import { formatCurrency } from '../utils/formatters';

type FilterType = 'All' | 'Poker' | 'Meals' | 'Loans' | 'Unsettled';
type SortType = 'date' | 'event';

export const History: React.FC = () => {
  const { transactions, friends, deleteTransaction, loading } = useAppContext();
  const { success, error: showError } = useToast();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [sortBy, setSortBy] = useState<SortType>('date');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useTimeout(() => setDeletingId(null), deletingId ? 3000 : null, [deletingId]);

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

  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(tx => {
        let friend = null;
        if (tx.friendId !== 'me') {
          friend = friends.find(f => f.id === tx.friendId);
        } else if (tx.payerId !== 'me') {
          friend = friends.find(f => f.id === tx.payerId);
        }
        const friendName = friend?.name.toLowerCase() || '';
        const title = tx.title.toLowerCase();
        const note = (tx.note || '').toLowerCase();
        const amount = tx.amount.toString();
        
        return friendName.includes(query) || 
               title.includes(query) || 
               note.includes(query) || 
               amount.includes(query);
      });
    }

    if (activeFilter !== 'All') {
      if (activeFilter === 'Unsettled') {
        filtered = filtered.filter(tx => {
          if (tx.isSettlement) return false;
          let friendId = tx.friendId !== 'me' ? tx.friendId : tx.payerId;
          return !shouldGrayTransaction(tx, friendId, transactions);
        });
      } else {
        const typeMap: Record<string, string> = {
          'Poker': 'Poker',
          'Meals': 'Meal',
          'Loans': 'Loan',
        };
        filtered = filtered.filter(tx => tx.type === typeMap[activeFilter]);
      }
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
  }, [transactions, searchQuery, activeFilter, sortBy, friends]);

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
  };

  return (
    <div className="min-h-screen bg-neo-bg dark:bg-zinc-950 flex flex-col pb-24 relative overflow-hidden transition-colors duration-300">
        <header className="flex items-center justify-between p-4 bg-neo-bg dark:bg-zinc-950 border-b-2 border-black z-20 shrink-0">
            <BackButton to="/dashboard" />
            <h1 className="text-xl font-bold tracking-tight uppercase dark:text-zinc-100">History</h1>
            <button className="flex items-center justify-center w-10 h-10 rounded-md border-2 border-transparent hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                <MoreVertical className="text-black dark:text-zinc-100" />
            </button>
        </header>

        <div className="flex flex-col gap-4 p-4 pb-2 bg-neo-bg dark:bg-zinc-950 shrink-0 z-10">
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

            <div className="flex gap-3 overflow-x-auto no-scrollbar py-2">
                {(['All', 'Poker', 'Meals', 'Loans', 'Unsettled'] as FilterType[]).map(filter => (
                     <button 
                       key={filter}
                       onClick={() => setActiveFilter(filter)}
                       className={`shrink-0 px-4 py-1.5 rounded-md border-2 border-black text-black font-bold text-sm shadow-neo-sm active:shadow-none active:translate-y-1 transition-all ${activeFilter === filter ? 'bg-neo-purple' : 'bg-white dark:bg-zinc-900 dark:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}
                     >
                        {filter}
                    </button>
                ))}
            </div>

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
            ) : filteredTransactions.length > 0 && Object.keys(groupedTransactions).length > 0 ? (
              Object.entries(groupedTransactions).map(([groupName, txs]) => (
                <div key={groupName} className="mb-6">
                  <div className="flex items-center gap-4 mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-black dark:text-zinc-400">{groupName}</h3>
                    <div className="h-[2px] flex-1 bg-black/10 dark:bg-white/10"></div>
                  </div>
                  
                  {txs.map(tx => {
                    let friend = null;
                    let friendIdForGraying = null;
                    if (tx.friendId !== 'me') {
                      friend = friends.find(f => f.id === tx.friendId);
                      friendIdForGraying = tx.friendId;
                    } else if (tx.payerId !== 'me') {
                      friend = friends.find(f => f.id === tx.payerId);
                      friendIdForGraying = tx.payerId;
                    }
                    const friendName = friend?.name || 'Unknown';
                    const friendAvatar = friend?.avatar || '';
                    
                    const isGrayed = friendIdForGraying ? shouldGrayTransaction(tx, friendIdForGraying, transactions) : false;
                    
                    return (
                      <div 
                        key={tx.id} 
                        className={`group relative flex items-center gap-3 p-3 mb-3 rounded-md border-2 border-black shadow-neo active:shadow-none active:translate-y-1 transition-all ${tx.payerId === 'me' ? 'bg-neo-green/20 dark:bg-neo-green/10' : 'bg-neo-red/20 dark:bg-neo-red/10'} ${isGrayed ? 'opacity-50 grayscale' : tx.isSettlement ? 'opacity-60' : ''} ${deletingId === tx.id ? 'border-neo-red' : ''}`}
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(tx);
                          }}
                          className={`ml-2 p-2 rounded-md border-2 border-black transition-all ${
                            deletingId === tx.id 
                              ? 'bg-neo-red text-white shadow-neo-sm' 
                              : 'bg-white dark:bg-zinc-800 dark:text-zinc-100 hover:bg-neo-red/20 opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
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

        <button 
          onClick={handleFilterReset}
          className="absolute bottom-24 right-6 w-14 h-14 bg-neo-yellow text-black rounded-lg border-2 border-black shadow-neo hover:scale-105 active:shadow-none active:translate-y-1 transition-all flex items-center justify-center z-30"
          aria-label="Reset filters"
        >
             <Filter className="font-bold" />
        </button>
    </div>
  );
};
