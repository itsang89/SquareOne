import React, { useMemo, useState } from 'react';
import { Bell, ArrowUpRight, ArrowDownLeft, Trash2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Avatar, NeoCard } from '../components/NeoComponents';
import { Link, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { calculateTotalOwed, calculateTotalOwing, calculateNetBalance, calculateDebtOrigins, shouldGrayTransaction } from '../utils/calculations';
import { Transaction } from '../types';
import { useTimeout } from '../hooks/useTimeout';
import { useToast } from '../components/ToastContext';
import { TransactionSkeleton, FriendSkeleton } from '../components/LoadingSkeleton';
import { formatCurrency, formatDate } from '../utils/formatters';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { friends, transactions, deleteTransaction, loading, error } = useAppContext();
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useTimeout(() => setDeletingId(null), deletingId ? 3000 : null, [deletingId]);

  const handleDelete = async (tx: Transaction) => {
    if (deletingId === tx.id) {
      const result = await deleteTransaction(tx.id);
      if (result.success) {
        success('Transaction deleted');
      } else {
        showError('Failed to delete transaction', result.error?.message);
      }
      setDeletingId(null);
    } else {
      setDeletingId(tx.id);
    }
  };
  
  const totalOwed = useMemo(() => calculateTotalOwed(transactions), [transactions]);
  const totalOwing = useMemo(() => calculateTotalOwing(transactions), [transactions]);
  const netBalance = useMemo(() => calculateNetBalance(transactions), [transactions]);
  const debtOriginsData = useMemo(() => calculateDebtOrigins(transactions), [transactions]);
  
  const topFriends = useMemo(() => {
    return [...friends]
      .filter(f => f.balance !== 0)
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
      .slice(0, 5);
  }, [friends]);
  
  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [transactions]);
  
  const unsettledCount = useMemo(() => {
    return transactions.filter(tx => !tx.isSettlement).length;
  }, [transactions]);

  if (error) {
    throw error; // Let ErrorBoundary handle it
  }

  return (
    <div className="min-h-screen pb-24 bg-neo-bg">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-neo-bg/95 backdrop-blur-sm border-b-2 border-black px-5 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold uppercase leading-none">Hello, {user?.name || 'User'}</h2>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Dashboard</p>
        </div>
        <button className="relative w-12 h-12 bg-neo-yellow border-2 border-black rounded-lg shadow-neo-sm active:shadow-none active:translate-y-1 flex items-center justify-center">
            <Bell size={24} className="text-black" />
            {unsettledCount > 0 && (
              <span className="absolute top-2 right-2 w-3 h-3 bg-neo-red border-2 border-white rounded-full"></span>
            )}
        </button>
      </header>

      <div className="p-5 space-y-8">
        {/* Net Position Widget */}
        <section>
            <div className="relative bg-neo-yellow border-2 border-black p-6 shadow-neo overflow-hidden rounded-lg">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/20 rounded-full blur-2xl pointer-events-none"></div>
                
                <div className="relative z-10 mb-6">
                    <p className="text-black/70 text-xs font-bold uppercase tracking-widest mb-1">Total Net Position</p>
                    <p className="text-5xl font-bold tracking-tighter">
                      {netBalance >= 0 ? '+' : '-'}{formatCurrency(Math.abs(netBalance))}
                    </p>
                </div>

                <div className="relative z-10 flex gap-4 pt-4 border-t-2 border-black/10">
                    <div className="flex-1">
                        <p className="text-black/60 text-[10px] font-black uppercase mb-1">You Owe</p>
                        <p className="text-neo-red font-black text-xl tracking-tight">{formatCurrency(totalOwing)}</p>
                    </div>
                    <div className="w-[2px] bg-black/10"></div>
                    <div className="flex-1">
                        <p className="text-black/60 text-[10px] font-black uppercase mb-1">Owed To You</p>
                        <p className="text-neo-greenDark font-black text-xl tracking-tight">{formatCurrency(totalOwed)}</p>
                    </div>
                </div>
            </div>
        </section>

        {/* Top Sharks */}
        <section>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black uppercase border-l-4 border-black pl-2">Top Sharks</h3>
                <Link to="/friends" className="text-xs font-bold uppercase underline decoration-2">View All</Link>
            </div>
            
            {loading ? (
              <div className="flex gap-4 overflow-x-auto pb-4">
                {[1, 2, 3].map(i => <FriendSkeleton key={i} />)}
              </div>
            ) : topFriends.length > 0 ? (
              <div className="flex overflow-x-auto no-scrollbar gap-4 pb-4 snap-x">
                  {topFriends.map(friend => (
                      <div 
                        key={friend.id} 
                        onClick={() => navigate(`/friends/${friend.id}`)}
                        className="snap-start shrink-0 w-32 bg-white border-2 border-black p-3 rounded-lg shadow-neo-sm flex flex-col items-center gap-2 cursor-pointer hover:shadow-neo hover:-translate-y-1 transition-all active:shadow-neo-pressed active:translate-y-0"
                      >
                          <div className="relative">
                              <Avatar src={friend.avatar} alt={friend.name} size="md" />
                              <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center ${friend.balance >= 0 ? 'bg-neo-greenDark' : 'bg-neo-red'}`}>
                                  {friend.balance >= 0 ? <ArrowDownLeft size={12} className="text-white"/> : <ArrowUpRight size={12} className="text-white"/>}
                              </div>
                          </div>
                          <div className="text-center w-full">
                              <p className="text-sm font-bold truncate w-full">{friend.name.split(' ')[0]}</p>
                              <p className={`text-xs font-bold ${friend.balance >= 0 ? 'text-neo-greenDark' : 'text-neo-red'}`}>
                                  {friend.balance >= 0 ? '+' : '-'}{formatCurrency(Math.abs(friend.balance))}
                              </p>
                          </div>
                      </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm font-bold uppercase">
                No active balances
              </div>
            )}
        </section>

        {/* Debt Origins & Event Insights */}
        <section>
            <h3 className="text-lg font-black uppercase border-l-4 border-black pl-2 mb-4">Debt Origins</h3>
            {loading ? (
              <NeoCard className="h-40 flex items-center justify-center bg-gray-50">
                <div className="animate-pulse w-32 h-32 rounded-full border-4 border-gray-200"></div>
              </NeoCard>
            ) : debtOriginsData.length > 0 ? (
                <NeoCard className="bg-[#F7E8FF] flex flex-row items-center gap-4">
                    <div className="h-32 w-32 shrink-0 relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={debtOriginsData}
                                    innerRadius={35}
                                    outerRadius={60}
                                    paddingAngle={0}
                                    dataKey="value"
                                    stroke="black"
                                    strokeWidth={2}
                                >
                                    {debtOriginsData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                             <div className="w-2 h-2 bg-black rounded-full"></div>
                        </div>
                    </div>
                    
                    <div className="flex-1 flex flex-col gap-2">
                        {debtOriginsData.map((entry) => (
                            <div key={entry.name} className="flex items-center justify-between bg-white border border-black p-1.5 rounded shadow-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 border border-black" style={{ backgroundColor: entry.color }}></div>
                                    <span className="text-xs font-bold uppercase">{entry.name}</span>
                                </div>
                                <span className="text-xs font-mono">{entry.value}%</span>
                            </div>
                        ))}
                    </div>
                </NeoCard>
            ) : (
                <NeoCard className="bg-gray-50 flex items-center justify-center py-10">
                    <p className="text-xs font-bold uppercase text-gray-400">No debt data available</p>
                </NeoCard>
            )}
        </section>

        {/* Recent Activity */}
        <section>
             <h3 className="text-lg font-black uppercase border-l-4 border-black pl-2 mb-4">Recent Moves</h3>
             {loading ? (
               <div className="flex flex-col gap-3">
                 {[1, 2, 3, 4, 5].map(i => <TransactionSkeleton key={i} />)}
               </div>
             ) : recentTransactions.length > 0 ? (
               <div className="flex flex-col gap-3">
                  {recentTransactions.map(tx => {
                    let friend = null;
                    let friendIdForGraying = null;
                    if (tx.friendId !== 'me') {
                      friend = friends.find(f => f.id === tx.friendId);
                      friendIdForGraying = tx.friendId;
                    } else if (tx.payerId !== 'me') {
                      friend = friends.find(f => f.id === tx.payerId);
                      friendIdForGraying = tx.payerId;
                    }
                    const friendName = friend ? friend.name : 'Unknown';
                    const isGrayed = friendIdForGraying ? shouldGrayTransaction(tx, friendIdForGraying, transactions) : false;
                    
                    return (
                      <div key={tx.id} className={`group bg-white border-2 border-transparent hover:border-black hover:shadow-neo-sm p-3 rounded-lg flex items-center justify-between transition-all ${isGrayed ? 'opacity-50 grayscale' : tx.isSettlement ? 'opacity-75' : ''} ${deletingId === tx.id ? 'border-neo-red' : ''}`}>
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className={`w-10 h-10 border-2 border-black rounded flex items-center justify-center shadow-sm shrink-0 ${
                                  isGrayed ? 'bg-gray-300' :
                                  tx.isSettlement ? 'bg-neo-green' :
                                  tx.type === 'Meal' ? 'bg-neo-orange' : 
                                  tx.type === 'Transport' ? 'bg-neo-yellow' : 
                                  tx.type === 'Loan' ? 'bg-neo-green' : 
                                  tx.type === 'Poker' ? 'bg-neo-purple' : 'bg-neo-blue'
                              }`}>
                                  <span className="text-lg font-bold">
                                      {tx.isSettlement ? '✓' : tx.type === 'Meal' ? '🍕' : tx.type === 'Transport' ? '🚕' : tx.type === 'Loan' ? '💸' : tx.type === 'Poker' ? '🃏' : '📝'}
                                  </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                  <p className={`font-bold text-sm leading-tight ${isGrayed ? 'text-gray-500' : ''}`}>
                                    {tx.isSettlement ? '✓ Settlement' : tx.title}
                                  </p>
                                  <p className={`text-[10px] font-bold uppercase tracking-wide ${isGrayed ? 'text-gray-400' : 'text-gray-400'}`}>
                                      {tx.isSettlement 
                                        ? `Settled with ${friendName}` 
                                        : tx.payerId === 'me' ? 'You paid' : `${friendName} paid`
                                      } • {formatDate(tx.date, 'short')}
                                  </p>
                              </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                               <p className={`font-black text-sm ${isGrayed ? 'text-gray-500' : tx.isSettlement ? 'text-neo-greenDark' : tx.payerId === 'me' ? 'text-neo-greenDark' : 'text-neo-red'}`}>
                                  {tx.isSettlement ? '✓ ' : ''}{tx.payerId === 'me' ? '+' : '-'}{formatCurrency(tx.amount)}
                               </p>
                               <button
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   handleDelete(tx);
                                 }}
                                 className={`p-1.5 rounded-md border-2 border-black transition-all ${
                                   deletingId === tx.id 
                                     ? 'bg-neo-red text-white shadow-neo-sm' 
                                     : 'bg-white hover:bg-neo-red/20 opacity-0 group-hover:opacity-100'
                                 }`}
                                 title={deletingId === tx.id ? 'Click again to confirm delete' : 'Delete transaction'}
                               >
                                 <Trash2 size={14} />
                               </button>
                          </div>
                      </div>
                    );
                  })}
               </div>
             ) : (
               <div className="text-center py-8 text-gray-400 text-sm font-bold uppercase">
                 No recent transactions
               </div>
             )}
        </section>
      </div>
    </div>
  );
};
