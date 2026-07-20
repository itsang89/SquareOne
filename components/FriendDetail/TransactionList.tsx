import React from 'react';
import { Pencil } from 'lucide-react';
import { Transaction } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { DeleteConfirmButton } from '../DeleteConfirmButton';

interface TransactionListProps {
  transactions: Transaction[];
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
  armedDeleteId: string | null;
  onArmedChange: (txId: string, armed: boolean) => void;
  getIsGrayed: (tx: Transaction) => boolean;
  emptyMessage?: string;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  onEdit,
  onDelete,
  armedDeleteId,
  onArmedChange,
  getIsGrayed,
  emptyMessage,
}) => {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 dark:text-zinc-600">
        <p className="text-sm font-bold uppercase">{emptyMessage ?? 'No transaction history'}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pt-6">
      {transactions
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map(tx => {
          const isGrayed = getIsGrayed(tx);
          const isArmed = armedDeleteId === tx.id;
          return (
            <div
              key={tx.id}
              className={`bg-white dark:bg-zinc-900 border-2 border-black p-4 shadow-neo flex items-center justify-between group active:shadow-neo-pressed active:translate-x-[2px] active:translate-y-[2px] transition-all hover:bg-blue-50 dark:hover:bg-zinc-800 ${isGrayed ? 'opacity-50 grayscale' : tx.isSettlement ? 'opacity-60' : ''} ${isArmed ? 'border-neo-red ring-2 ring-neo-red/40 ring-offset-2 ring-offset-neo-bg dark:ring-offset-zinc-950' : ''}`}
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className={`w-12 h-12 border-2 border-black flex items-center justify-center shrink-0 shadow-sm ${
                  isGrayed ? 'bg-gray-300 dark:bg-zinc-700' :
                  tx.type === 'Meal' ? 'bg-neo-blue' :
                  tx.type === 'Transport' ? 'bg-neo-yellow' :
                  tx.type === 'Loan' ? 'bg-neo-green' :
                  tx.type === 'Poker' ? 'bg-neo-purple' : 'bg-neo-orange'
                }`}>
                  <span className="text-xl text-black">
                    {tx.isSettlement ? '✓' : tx.type === 'Meal' ? '🍕' :
                     tx.type === 'Transport' ? '🚕' :
                     tx.type === 'Loan' ? '💸' :
                     tx.type === 'Poker' ? '🃏' : '📝'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={`font-bold text-base uppercase leading-tight dark:text-zinc-100 ${isGrayed ? 'text-gray-500' : ''}`}>
                    {tx.isSettlement ? '✓ Settlement' : tx.title}
                  </h3>
                  <p className={`text-[10px] font-bold uppercase mt-1 ${isGrayed ? 'text-gray-400 dark:text-zinc-600' : 'text-gray-500 dark:text-zinc-500'}`}>
                    {formatDate(tx.date, 'short')} • {tx.payerId === 'me' ? 'You paid' : 'They paid'}
                    {tx.note && ` • ${tx.note}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`block font-black text-xl ${isGrayed ? 'text-gray-500 dark:text-zinc-600' : tx.payerId === 'me' ? 'text-neo-greenDark' : 'text-neo-red'}`}>
                  {tx.isSettlement ? '✓ ' : ''}{formatCurrency(tx.amount)}
                </span>
                {!tx.isSettlement && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(tx);
                    }}
                    className="p-2 rounded-md border-2 border-black transition-all bg-white dark:bg-zinc-800 dark:text-zinc-100 hover:bg-neo-blue/30"
                    aria-label="Edit transaction"
                  >
                    <Pencil size={16} />
                  </button>
                )}
                <DeleteConfirmButton
                  onConfirm={() => onDelete(tx)}
                  onArmedChange={(armed) => onArmedChange(tx.id, armed)}
                  ariaLabel="Delete transaction"
                  size="expanded"
                />
              </div>
            </div>
          );
        })}
    </div>
  );
};
