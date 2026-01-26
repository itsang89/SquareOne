import React from 'react';
import { Trash2 } from 'lucide-react';
import { Transaction } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface TransactionListProps {
  transactions: Transaction[];
  onDelete: (tx: Transaction) => void;
  deletingId: string | null;
  getIsGrayed: (tx: Transaction) => boolean;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  onDelete,
  deletingId,
  getIsGrayed,
}) => {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-sm font-bold uppercase">No transaction history</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pt-6">
      {transactions
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map(tx => {
          const isGrayed = getIsGrayed(tx);
          return (
            <div 
              key={tx.id} 
              className={`bg-white border-2 border-black p-4 shadow-neo flex items-center justify-between group active:shadow-neo-pressed active:translate-x-[2px] active:translate-y-[2px] transition-all hover:bg-blue-50 ${isGrayed ? 'opacity-50 grayscale' : tx.isSettlement ? 'opacity-60' : ''} ${deletingId === tx.id ? 'border-neo-red' : ''}`}
            >
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
                    {formatDate(tx.date, 'short')} • {tx.payerId === 'me' ? 'You paid' : 'They paid'}
                    {tx.note && ` • ${tx.note}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`block font-black text-xl ${isGrayed ? 'text-gray-500' : tx.payerId === 'me' ? 'text-neo-greenDark' : 'text-neo-red'}`}>
                  {tx.isSettlement ? '✓ ' : ''}{formatCurrency(tx.amount)}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(tx);
                  }}
                  className={`p-2 rounded-md border-2 border-black transition-all ${
                    deletingId === tx.id 
                      ? 'bg-neo-red text-white shadow-neo-sm' 
                      : 'bg-white hover:bg-neo-red/20 opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
    </div>
  );
};
