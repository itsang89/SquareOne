import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MessageCircle, HandCoins } from 'lucide-react';
import { NeoButton, Avatar, NeoModal } from '../components/NeoComponents';
import { useAppContext } from '../context/AppContext';
import { calculateFriendBalance, shouldGrayTransaction } from '../utils/calculations';
import { Transaction } from '../types';
import { DetailHeader } from '../components/FriendDetail/DetailHeader';
import { TransactionList } from '../components/FriendDetail/TransactionList';
import { EditFriendModal } from '../components/FriendDetail/EditFriendModal';
import { useToast } from '../components/ToastContext';
import { useTimeout } from '../hooks/useTimeout';
import { formatCurrency } from '../utils/formatters';

export const FriendDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { friends, transactions: allTransactions, getFriendById, deleteTransaction, updateFriend, deleteFriend, isProcessing } = useAppContext();
  const { success, error: showError } = useToast();
  
  const friend = getFriendById(id || '') || friends[0];
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useTimeout(() => setDeletingId(null), deletingId ? 3000 : null, [deletingId]);

  const handleDelete = async (tx: Transaction) => {
    if (deletingId === tx.id) {
      const result = await deleteTransaction(tx.id);
      if (result.success) {
        success('Transaction deleted');
      } else {
        showError('Failed to delete', result.error?.message);
      }
      setDeletingId(null);
    } else {
      setDeletingId(tx.id);
    }
  };

  const friendTransactions = useMemo(() => {
    if (!friend) return [];
    return allTransactions.filter(t => 
      (t.friendId === friend.id && t.payerId === 'me') || 
      (t.payerId === friend.id && t.friendId === 'me')
    );
  }, [allTransactions, friend]);

  const calculatedBalance = useMemo(() => {
    if (!friend) return 0;
    return calculateFriendBalance(friend.id, allTransactions);
  }, [friend, allTransactions]);

  const handleUpdateFriend = async (name: string, avatar: string) => {
    if (!friend) return;
    const result = await updateFriend(friend.id, { name, avatar });
    if (result.success) {
      success('Friend updated');
      setShowEditModal(false);
    } else {
      showError('Update failed', result.error?.message);
    }
  };

  const handleDeleteFriend = async () => {
    if (!friend) return;
    const result = await deleteFriend(friend.id);
    if (result.success) {
      success('Friend deleted');
      navigate('/friends');
    } else {
      showError('Delete failed', result.error?.message);
    }
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
      <DetailHeader
        onEdit={() => {
          setShowEditModal(true);
          setShowOptions(false);
        }}
        onDelete={() => {
          setShowDeleteConfirm(true);
          setShowOptions(false);
        }}
        showOptions={showOptions}
        onToggleOptions={() => setShowOptions(!showOptions)}
      />

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
                {formatCurrency(Math.abs(calculatedBalance))}
            </span>
            <div className="absolute bottom-2 left-0 w-full h-4 bg-neo-green/50 -z-0 skew-x-12"></div>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full z-10">
            <NeoButton variant="primary" onClick={() => navigate(`/settle/${friend.id}`)}>
                <HandCoins size={18} /> Settle Up
            </NeoButton>
            <NeoButton variant="secondary" onClick={() => {}} className="group">
                <span className="group-hover:animate-bounce">👋</span> Nudge
            </NeoButton>
        </div>
      </section>

      <main className="px-6 flex-1 overflow-y-auto">
        <TransactionList
          transactions={friendTransactions}
          onDelete={handleDelete}
          deletingId={deletingId}
          getIsGrayed={(tx) => shouldGrayTransaction(tx, friend.id, allTransactions)}
        />
      </main>

      <EditFriendModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        friend={friend}
        onUpdate={handleUpdateFriend}
        isLoading={isProcessing}
      />

      <NeoModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Friend?"
      >
        <p className="font-bold text-gray-600 mb-6 uppercase text-sm tracking-tight">
          This will permanently delete {friend.name} and all associated transactions. This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <NeoButton fullWidth onClick={() => setShowDeleteConfirm(false)} variant="neutral">Cancel</NeoButton>
          <NeoButton fullWidth onClick={handleDeleteFriend} variant="accent" isLoading={isProcessing}>Delete</NeoButton>
        </div>
      </NeoModal>
    </div>
  );
};
