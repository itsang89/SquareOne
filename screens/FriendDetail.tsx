import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MessageCircle, HandCoins, Trash2 } from 'lucide-react';
import { NeoButton, BackButton, Avatar } from '../components/NeoComponents';
import { useAppContext } from '../context/AppContext';
import { calculateFriendBalance, shouldGrayTransaction } from '../utils/calculations';
import { Transaction } from '../types';

export const FriendDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { friends, transactions: allTransactions, getFriendById, deleteTransaction } = useAppContext();
  const friend = getFriendById(id || '') || friends[0];
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

  // Fix: Filter transactions correctly for this friend
  const friendTransactions = useMemo(() => {
    if (!friend) return [];
    return allTransactions.filter(t => 
      (t.friendId === friend.id && t.payerId === 'me') || 
      (t.payerId === friend.id && t.friendId === 'me')
    );
  }, [allTransactions, friend]);

  // Fix: Calculate balance from transactions instead of trusting friend.balance
  const calculatedBalance = useMemo(() => {
    if (!friend) return 0;
    return calculateFriendBalance(friend.id, allTransactions);
  }, [friend, allTransactions]);

  // Check if balance is settled (zero or very close to zero)
  const isSettled = Math.abs(calculatedBalance) < 0.01;
  
  // Fix: Check if each transaction should be grayed (when friend balance is zero)
  const getIsTransactionGrayed = (tx: Transaction) => {
    if (!friend) return false;
    return shouldGrayTransaction(tx, friend.id, allTransactions);
  };

  const handleSettle = () => {
    navigate(`/settle/${friend.id}`);
  };

  const handleNudge = () => {
    // Fix: Nudge button handler
    console.log(`Nudging ${friend.name} about ${calculatedBalance >= 0 ? 'owing' : 'being owed'} $${Math.abs(calculatedBalance).toFixed(2)}`);
    // Could open share sheet or send notification here
  };

  if (!friend) {
    return (
      <div className="min-h-screen bg-neo-bg flex items-center justify-center">
        <p className="text-lg font-bold">Friend not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neo-bg flex flex-col pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-neo-bg/95 backdrop-blur-sm px-5 py-4 flex items-center justify-between border-b-2 border-black">
        <BackButton />
        <h1 className="text-lg font-bold uppercase tracking-widest">Friend Detail</h1>
        <button className="w-10 h-10 bg-white border-2 border-black shadow-neo-sm flex items-center justify-center hover:bg-neo-yellow active:shadow-none">
            <span className="font-black text-xl">:</span>
        </button>
      </header>

      {/* Profile Section */}
      <section className="px-6 pt-8 pb-6 flex flex-col items-center text-center relative overflow-hidden bg-white border-b-2 border-black">
        <div className="absolute top-10 right-10 w-40 h-40 bg-neo-purple rounded-full blur-3xl opacity-60 pointer-events-none mix-blend-multiply"></div>
        <div className="absolute top-20 left-10 w-32 h-32 bg-neo-green rounded-full blur-3xl opacity-60 pointer-events-none mix-blend-multiply"></div>

        <div className="relative mb-4 z-10">
            <Avatar src={friend.avatar} alt={friend.name} size="xl" className="shadow-neo" />
            <div className="absolute bottom-0 right-0 w-8 h-8 bg-neo-yellow border-2 border-black rounded-full flex items-center justify-center shadow-sm">
                 <MessageCircle size={16} />
            </div>
        </div>

        <h2 className="text-2xl font-black uppercase tracking-tight mb-1 z-10">{friend.name}</h2>
        
        <div className="flex items-center gap-2 mb-6 z-10 bg-black/5 px-3 py-1 rounded-full border border-black/10">
             <div className={`w-2.5 h-2.5 rounded-full border border-black ${calculatedBalance >= 0 ? 'bg-neo-green' : 'bg-neo-red animate-pulse'}`}></div>
             <p className={`text-xs font-bold uppercase tracking-widest ${calculatedBalance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {calculatedBalance >= 0 ? 'Owes you' : 'You owe'}
             </p>
        </div>

        <div className="relative inline-block mb-8 z-10 group cursor-default">
            <span className="text-6xl font-black tracking-tighter block relative z-10">
                ${Math.abs(calculatedBalance).toFixed(2)}
            </span>
            <div className="absolute bottom-2 left-0 w-full h-4 bg-neo-green/50 -z-0 skew-x-12"></div>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full z-10">
            <NeoButton variant="primary" onClick={handleSettle}>
                <HandCoins size={18} /> Settle Up
            </NeoButton>
            <NeoButton variant="secondary" onClick={handleNudge} className="group">
                <span className="group-hover:animate-bounce">👋</span> Nudge
            </NeoButton>
        </div>
      </section>

      {/* List */}
      <main className="px-6 flex-1 flex flex-col gap-5 z-0 pt-6">
        {friendTransactions.length > 0 ? (
          <>
            {friendTransactions
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map(tx => {
                const isGrayed = getIsTransactionGrayed(tx);
                return (
                <div key={tx.id} className={`bg-white border-2 border-black p-4 shadow-neo flex items-center justify-between group active:shadow-neo-pressed active:translate-x-[2px] active:translate-y-[2px] transition-all hover:bg-blue-50 ${isGrayed ? 'opacity-50 grayscale' : tx.isSettlement ? 'opacity-60' : ''} ${deletingId === tx.id ? 'border-neo-red' : ''}`}>
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className={`w-12 h-12 border-2 border-black flex items-center justify-center shrink-0 shadow-sm ${
                            isGrayed ? 'bg-gray-300' :
                            tx.type === 'Meal' ? 'bg-neo-blue' : 
                            tx.type === 'Transport' ? 'bg-neo-yellow' : 
                            tx.type === 'Loan' ? 'bg-neo-green' :
                            tx.type === 'Poker' ? 'bg-neo-purple' : 'bg-neo-orange'
                        }`}>
                            <span className="text-xl">
                                 {tx.isSettlement ? '✓' : tx.type === 'Meal' ? '🍕' : 
                                  tx.type === 'Transport' ? '🚕' : 
                                  tx.type === 'Loan' ? '💸' :
                                  tx.type === 'Poker' ? '🃏' : '📝'}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className={`font-bold text-base uppercase leading-tight ${isGrayed ? 'text-gray-500' : ''}`}>
                              {tx.isSettlement ? '✓ Settlement' : tx.title}
                            </h3>
                            <p className={`text-[10px] font-bold uppercase mt-1 ${isGrayed ? 'text-gray-400' : 'text-gray-500'}`}>
                                {new Date(tx.date).toLocaleDateString()} {new Date(tx.date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} • {tx.payerId === 'me' ? 'You paid' : 'They paid'}
                                {tx.note && ` • ${tx.note}`}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <span className={`block font-black text-xl ${isGrayed ? 'text-gray-500' : tx.payerId === 'me' ? 'text-neo-greenDark' : 'text-neo-red'}`}>
                            {tx.isSettlement ? '✓' : ''} ${tx.amount.toFixed(2)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(tx);
                          }}
                          className={`p-2 rounded-md border-2 border-black transition-all ${
                            deletingId === tx.id 
                              ? 'bg-neo-red text-white shadow-neo-sm' 
                              : 'bg-white hover:bg-neo-red/20 opacity-0 group-hover:opacity-100'
                          }`}
                          title={deletingId === tx.id ? 'Click again to confirm delete' : 'Delete transaction'}
                        >
                          <Trash2 size={16} />
                        </button>
                    </div>
                </div>
                );
              })}
          </>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm font-bold uppercase">
              No transaction history
            </p>
          </div>
        )}
      </main>
    </div>
  );
};