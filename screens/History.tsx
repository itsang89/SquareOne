import React, { useState, useMemo } from 'react';
import { Search, MoreVertical, Filter, Trash2 } from 'lucide-react';
import { BackButton, Avatar } from '../components/NeoComponents';
import { useAppContext } from '../context/AppContext';
import { Transaction } from '../types';
import { shouldGrayTransaction } from '../utils/calculations';

type FilterType = 'All' | 'Poker' | 'Meals' | 'Loans' | 'Unsettled';
type SortType = 'date' | 'event';

export const History: React.FC = () => {
  const { transactions, friends, deleteTransaction } = useAppContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [sortBy, setSortBy] = useState<SortType>('date');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = (tx: Transaction) => {
    if (deletingId === tx.id) {
      // Confirm deletion
      deleteTransaction(tx.id);
      setDeletingId(null);
    } else {
      // First click - show confirmation
      setDeletingId(tx.id);
      // Auto-cancel after 3 seconds
      setTimeout(() => setDeletingId(null), 3000);
    }
  };

  // Fix: Filter and search transactions
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(tx => {
        // Fix: Improved friend lookup for search
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

    // Apply type filter
    if (activeFilter !== 'All') {
      if (activeFilter === 'Unsettled') {
        filtered = filtered.filter(tx => !tx.isSettlement);
      } else {
        const typeMap: Record<string, string> = {
          'Poker': 'Poker',
          'Meals': 'Meal',
          'Loans': 'Loan',
        };
        filtered = filtered.filter(tx => tx.type === typeMap[activeFilter]);
      }
    }

    // Apply sorting
    if (sortBy === 'date') {
      filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else {
      // Sort by event (type), then by date
      filtered.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type.localeCompare(b.type);
        }
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
    }

    return filtered;
  }, [transactions, searchQuery, activeFilter, sortBy, friends]);

  // Fix: Group transactions by date
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    filteredTransactions.forEach((tx: Transaction) => {
      try {
        const txDate = new Date(tx.date);
        // Fix: Validate date
        if (isNaN(txDate.getTime())) {
          console.warn('Invalid date for transaction:', tx);
          return;
        }
        
        const txDateOnly = new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate());
        const diffTime = today.getTime() - txDateOnly.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        let groupKey: string;
        if (diffDays === 0) {
          groupKey = 'Today';
        } else if (diffDays === 1) {
          groupKey = 'Yesterday';
        } else if (diffDays < 7) {
          groupKey = 'This Week';
        } else if (diffDays < 30) {
          groupKey = 'This Month';
        } else {
          groupKey = txDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        }
        
        if (!groups[groupKey]) {
          groups[groupKey] = [];
        }
        groups[groupKey].push(tx);
      } catch (error) {
        console.error('Error processing transaction:', tx, error);
      }
    });
    
    // Fix: Sort transactions by time within each group (newest first)
    Object.keys(groups).forEach(groupKey => {
      groups[groupKey].sort((a, b) => {
        try {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        } catch {
          return 0;
        }
      });
    });
    
    // Fix: Sort groups by date (Today first, then Yesterday, then by actual date)
    const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
      if (a === 'Today') return -1;
      if (b === 'Today') return 1;
      if (a === 'Yesterday') return -1;
      if (b === 'Yesterday') return 1;
      if (a === 'This Week') return -1;
      if (b === 'This Week') return 1;
      if (a === 'This Month') return -1;
      if (b === 'This Month') return 1;
      // For month names, try to sort by date
      try {
        const dateA = new Date(a);
        const dateB = new Date(b);
        if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
          return dateB.getTime() - dateA.getTime();
        }
      } catch {}
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
    <div className="min-h-screen bg-neo-bg flex flex-col pb-24 relative overflow-hidden">
        <header className="flex items-center justify-between p-4 bg-neo-bg border-b-2 border-black z-20 shrink-0">
            <BackButton />
            <h1 className="text-xl font-bold tracking-tight uppercase">History</h1>
            <button className="flex items-center justify-center w-10 h-10 rounded-md border-2 border-transparent hover:bg-black/5 transition-colors">
                <MoreVertical className="text-black" />
            </button>
        </header>

        <div className="flex flex-col gap-4 p-4 pb-2 bg-neo-bg shrink-0 z-10">
            <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="text-black" size={20} />
                </div>
                <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search friend, note, amount..."
                    className="block w-full pl-10 pr-3 py-3 rounded-md bg-white border-2 border-black text-black placeholder-gray-500 focus:outline-none focus:shadow-neo-sm transition-all placeholder:text-sm font-bold"
                />
            </div>

            <div className="flex gap-3 overflow-x-auto no-scrollbar py-2">
                {(['All', 'Poker', 'Meals', 'Loans', 'Unsettled'] as FilterType[]).map(filter => (
                     <button 
                       key={filter}
                       onClick={() => setActiveFilter(filter)}
                       className={`shrink-0 px-4 py-1.5 rounded-md border-2 border-black text-black font-bold text-sm shadow-neo-sm active:shadow-none active:translate-y-1 transition-all ${activeFilter === filter ? 'bg-neo-purple' : 'bg-white hover:bg-gray-100'}`}
                     >
                        {filter}
                    </button>
                ))}
            </div>

            <div className="flex w-full bg-white rounded-md border-2 border-black p-1 shadow-neo-sm">
                <button 
                  onClick={() => setSortBy('date')}
                  className={`flex-1 py-1.5 text-sm rounded text-center transition-all ${sortBy === 'date' ? 'font-bold bg-black text-white shadow-sm' : 'font-medium text-gray-500 hover:text-black hover:bg-gray-100'}`}
                >
                    By Date
                </button>
                <button 
                  onClick={() => setSortBy('event')}
                  className={`flex-1 py-1.5 text-sm rounded text-center transition-all ${sortBy === 'event' ? 'font-bold bg-black text-white shadow-sm' : 'font-medium text-gray-500 hover:text-black hover:bg-gray-100'}`}
                >
                    By Event
                </button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pt-4">
            {filteredTransactions.length > 0 && Object.keys(groupedTransactions).length > 0 ? (
              Object.entries(groupedTransactions).map(([groupName, txs]: [string, Transaction[]]) => (
                <div key={groupName} className="mb-6">
                  <div className="flex items-center gap-4 mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-black">{groupName}</h3>
                    <div className="h-[2px] flex-1 bg-black/10"></div>
                  </div>
                  
                  {txs.map(tx => {
                    // Fix: Improved friend lookup - find the friend involved in the transaction
                    let friend = null;
                    let friendIdForGraying = null;
                    if (tx.friendId !== 'me') {
                      // If friendId is not 'me', find that friend
                      friend = friends.find(f => f.id === tx.friendId);
                      friendIdForGraying = tx.friendId;
                    } else if (tx.payerId !== 'me') {
                      // If friendId is 'me' but payerId is not 'me', find the payer
                      friend = friends.find(f => f.id === tx.payerId);
                      friendIdForGraying = tx.payerId;
                    }
                    const friendName = friend?.name || 'Unknown';
                    const friendAvatar = friend?.avatar || `https://picsum.photos/seed/${tx.friendId || tx.payerId}/100`;
                    
                    // Fix: Check if transaction should be grayed (when friend balance is zero)
                    const isGrayed = friendIdForGraying ? shouldGrayTransaction(tx, friendIdForGraying, transactions) : false;
                    
                    return (
                      <div 
                        key={tx.id} 
                        className={`group relative flex items-center gap-3 p-3 mb-3 rounded-md border-2 border-black shadow-neo active:shadow-none active:translate-y-1 transition-all ${tx.payerId === 'me' ? 'bg-neo-green/20' : 'bg-neo-red/20'} ${isGrayed ? 'opacity-50 grayscale' : tx.isSettlement ? 'opacity-60' : ''} ${deletingId === tx.id ? 'border-neo-red' : ''}`}
                      >
                        <div className="relative shrink-0">
                          <Avatar src={friendAvatar} alt={friendName} size="md" />
                          {!tx.isSettlement && (
                            <div className={`absolute -bottom-1 -right-1 border-2 border-white rounded-full w-4 h-4 ${tx.payerId === 'me' ? 'bg-neo-green' : 'bg-neo-red'}`}></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <h4 className={`font-bold text-base truncate ${isGrayed ? 'text-gray-500' : ''}`}>{friendName}</h4>
                            <span className={`font-bold whitespace-nowrap px-1 rounded ${isGrayed ? 'text-gray-500 bg-white/50' : tx.payerId === 'me' ? 'text-green-700 bg-white/50' : 'text-red-700 bg-white/50'}`}>
                              {tx.isSettlement ? '✓ ' : ''}{tx.payerId === 'me' ? '+' : '-'} ${tx.amount.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center mt-0.5">
                            <p className={`text-xs font-medium truncate ${isGrayed ? 'text-gray-400' : 'text-gray-700'}`}>
                              {tx.isSettlement ? 'Settlement' : tx.title} {tx.note && `• ${tx.note}`}
                            </p>
                            <span className={`text-xs font-mono ml-2 shrink-0 ${isGrayed ? 'text-gray-400' : 'text-gray-500'}`}>
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
                              : 'bg-white hover:bg-neo-red/20 opacity-0 group-hover:opacity-100'
                          }`}
                          title={deletingId === tx.id ? 'Click again to confirm delete' : 'Delete transaction'}
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
                <p className="text-sm font-bold uppercase text-gray-400">No transactions found</p>
              </div>
            )}
            
            <div className="py-8 text-center opacity-30">
                <p className="text-[10px] uppercase tracking-widest font-bold">End of History</p>
            </div>
        </div>

        {/* Floating Filter FAB */}
        <button 
          onClick={handleFilterReset}
          className="absolute bottom-24 right-6 w-14 h-14 bg-neo-yellow text-black rounded-lg border-2 border-black shadow-neo hover:scale-105 active:shadow-none active:translate-y-1 transition-all flex items-center justify-center z-30"
        >
             <Filter className="font-bold" />
        </button>
    </div>
  );
};