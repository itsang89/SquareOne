import React from 'react';
import { Delete, Divide, X, Minus, Plus, Equal } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { evaluateExpression } from '../../utils/calculator';

interface AmountInputProps {
  amount: string;
  onAmountChange: (newAmount: string) => void;
  showNumpad: boolean;
  onToggleNumpad: () => void;
}

export const AmountInput: React.FC<AmountInputProps> = ({
  amount,
  onAmountChange,
  showNumpad,
  onToggleNumpad,
}) => {
  const handleNumpad = (val: string) => {
    if (val === 'back') {
      if (amount.length <= 1) {
        onAmountChange('0');
      } else {
        onAmountChange(amount.slice(0, -1));
      }
    } else if (val === '=') {
      onAmountChange(evaluateExpression(amount));
    } else if (['+', '-', '*', '/'].includes(val)) {
      // Don't add operator if last char is already an operator
      if (/[+*/-]$/.test(amount)) {
        onAmountChange(amount.slice(0, -1) + val);
      } else if (amount !== '0') {
        onAmountChange(amount + val);
      }
    } else if (val === '.') {
      // Simple decimal logic: allow if the current "number" part doesn't have one
      const parts = amount.split(/[+*/-]/);
      const lastPart = parts[parts.length - 1];
      if (!lastPart.includes('.')) {
        onAmountChange(amount + '.');
      }
    } else {
      onAmountChange(amount === '0' ? val : amount + val);
    }
  };

  return (
    <div className="space-y-6">
      <div 
        onClick={onToggleNumpad}
        className="flex flex-col items-center justify-center py-12 bg-[#E0F2FE] dark:bg-sky-900/30 border-2 border-black shadow-neo-sm relative overflow-hidden min-h-[180px] cursor-pointer hover:bg-[#D0E8F8] dark:hover:bg-sky-900/40 transition-colors active:shadow-neo-pressed active:translate-y-[2px]"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-black opacity-5 dark:opacity-20"></div>
        <span className="text-xs font-bold uppercase text-gray-500 dark:text-zinc-500 mb-2 tracking-widest">Amount</span>
        <div className="relative w-full text-center">
          <h1 className="text-7xl font-black tracking-tighter text-black dark:text-zinc-100 break-all px-4">
            <span className="text-4xl align-top opacity-40 font-medium mr-1">$</span>
            {amount}
          </h1>
        </div>
      </div>

      {showNumpad && (
        <div className="bg-white dark:bg-zinc-900 border-2 border-black p-4 shadow-neo animate-in slide-in-from-bottom-4 duration-200">
          <div className="grid grid-cols-4 gap-3 max-w-sm mx-auto">
            {/* Row 1 */}
            {[7, 8, 9].map((num) => (
              <button key={num} onClick={() => handleNumpad(num.toString())} className="h-14 bg-white dark:bg-zinc-800 border-2 border-gray-200 dark:border-black hover:border-black dark:hover:border-zinc-400 text-2xl font-bold hover:bg-gray-50 dark:hover:bg-zinc-700 active:bg-black dark:active:bg-zinc-100 active:text-white dark:active:text-black transition-all text-black dark:text-zinc-100">
                {num}
              </button>
            ))}
            <button onClick={() => handleNumpad('/')} className="h-14 bg-neo-purple/10 dark:bg-neo-purple/20 border-2 border-gray-200 dark:border-black hover:border-black dark:hover:border-zinc-400 flex items-center justify-center hover:bg-neo-purple/20 dark:hover:bg-neo-purple/30 active:bg-black dark:active:bg-zinc-100 active:text-white dark:active:text-black transition-all text-black dark:text-zinc-100">
              <Divide size={24} />
            </button>

            {/* Row 2 */}
            {[4, 5, 6].map((num) => (
              <button key={num} onClick={() => handleNumpad(num.toString())} className="h-14 bg-white dark:bg-zinc-800 border-2 border-gray-200 dark:border-black hover:border-black dark:hover:border-zinc-400 text-2xl font-bold hover:bg-gray-50 dark:hover:bg-zinc-700 active:bg-black dark:active:bg-zinc-100 active:text-white dark:active:text-black transition-all text-black dark:text-zinc-100">
                {num}
              </button>
            ))}
            <button onClick={() => handleNumpad('*')} className="h-14 bg-neo-purple/10 dark:bg-neo-purple/20 border-2 border-gray-200 dark:border-black hover:border-black dark:hover:border-zinc-400 flex items-center justify-center hover:bg-neo-purple/20 dark:hover:bg-neo-purple/30 active:bg-black dark:active:bg-zinc-100 active:text-white dark:active:text-black transition-all text-black dark:text-zinc-100">
              <X size={24} />
            </button>

            {/* Row 3 */}
            {[1, 2, 3].map((num) => (
              <button key={num} onClick={() => handleNumpad(num.toString())} className="h-14 bg-white dark:bg-zinc-800 border-2 border-gray-200 dark:border-black hover:border-black dark:hover:border-zinc-400 text-2xl font-bold hover:bg-gray-50 dark:hover:bg-zinc-700 active:bg-black dark:active:bg-zinc-100 active:text-white dark:active:text-black transition-all text-black dark:text-zinc-100">
                {num}
              </button>
            ))}
            <button onClick={() => handleNumpad('-')} className="h-14 bg-neo-purple/10 dark:bg-neo-purple/20 border-2 border-gray-200 dark:border-black hover:border-black dark:hover:border-zinc-400 flex items-center justify-center hover:bg-neo-purple/20 dark:hover:bg-neo-purple/30 active:bg-black dark:active:bg-zinc-100 active:text-white dark:active:text-black transition-all text-black dark:text-zinc-100">
              <Minus size={24} />
            </button>

            {/* Row 4 */}
            <button onClick={() => handleNumpad('.')} className="h-14 bg-white dark:bg-zinc-800 border-2 border-gray-200 dark:border-black hover:border-black dark:hover:border-zinc-400 text-2xl font-bold hover:bg-gray-50 dark:hover:bg-zinc-700 active:bg-black dark:active:bg-zinc-100 active:text-white dark:active:text-black transition-all text-black dark:text-zinc-100">
              .
            </button>
            <button onClick={() => handleNumpad('0')} className="h-14 bg-white dark:bg-zinc-800 border-2 border-gray-200 dark:border-black hover:border-black dark:hover:border-zinc-400 text-2xl font-bold hover:bg-gray-50 dark:hover:bg-zinc-700 active:bg-black dark:active:bg-zinc-100 active:text-white dark:active:text-black transition-all text-black dark:text-zinc-100">
              0
            </button>
            <button onClick={() => handleNumpad('back')} className="h-14 bg-neo-red/10 dark:bg-neo-red/20 border-2 border-gray-200 dark:border-black hover:border-black dark:hover:border-zinc-400 flex items-center justify-center hover:bg-neo-red/20 dark:hover:bg-neo-red/30 active:bg-black dark:active:bg-zinc-100 active:text-white dark:active:text-black transition-all text-black dark:text-zinc-100">
              <Delete size={24} />
            </button>
            <button onClick={() => handleNumpad('+')} className="h-14 bg-neo-purple/10 dark:bg-neo-purple/20 border-2 border-gray-200 dark:border-black hover:border-black dark:hover:border-zinc-400 flex items-center justify-center hover:bg-neo-purple/20 dark:hover:bg-neo-purple/30 active:bg-black dark:active:bg-zinc-100 active:text-white dark:active:text-black transition-all text-black dark:text-zinc-100">
              <Plus size={24} />
            </button>

            {/* Row 5 */}
            <button 
              onClick={() => handleNumpad('=')}
              className="col-span-4 h-14 bg-neo-green/20 dark:bg-neo-green/30 border-2 border-gray-200 dark:border-black hover:border-black dark:hover:border-zinc-400 flex items-center justify-center hover:bg-neo-green/30 dark:hover:bg-neo-green/40 active:bg-black dark:active:bg-zinc-100 active:text-white dark:active:text-black transition-all text-black dark:text-zinc-100 font-bold"
            >
              <Equal size={24} className="mr-2" /> Calculate
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
