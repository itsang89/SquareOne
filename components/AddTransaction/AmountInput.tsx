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
        className="flex flex-col items-center justify-center py-12 bg-[#E0F2FE] border-2 border-black shadow-neo-sm relative overflow-hidden min-h-[180px] cursor-pointer hover:bg-[#D0E8F8] transition-colors active:shadow-neo-pressed active:translate-y-[2px]"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-black opacity-5"></div>
        <span className="text-xs font-bold uppercase text-gray-500 mb-2 tracking-widest">Amount</span>
        <div className="relative w-full text-center">
          <h1 className="text-7xl font-black tracking-tighter text-black break-all px-4">
            <span className="text-4xl align-top opacity-40 font-medium mr-1">$</span>
            {amount}
          </h1>
        </div>
      </div>

      {showNumpad && (
        <div className="bg-white border-2 border-black p-4 shadow-neo animate-in slide-in-from-bottom-4 duration-200">
          <div className="grid grid-cols-4 gap-3 max-w-sm mx-auto">
            {/* Row 1 */}
            {[7, 8, 9].map((num) => (
              <button key={num} onClick={() => handleNumpad(num.toString())} className="h-14 bg-white border-2 border-gray-200 hover:border-black text-2xl font-bold hover:bg-gray-50 active:bg-black active:text-white transition-all text-black">
                {num}
              </button>
            ))}
            <button onClick={() => handleNumpad('/')} className="h-14 bg-neo-purple/10 border-2 border-gray-200 hover:border-black flex items-center justify-center hover:bg-neo-purple/20 active:bg-black active:text-white transition-all text-black">
              <Divide size={24} />
            </button>

            {/* Row 2 */}
            {[4, 5, 6].map((num) => (
              <button key={num} onClick={() => handleNumpad(num.toString())} className="h-14 bg-white border-2 border-gray-200 hover:border-black text-2xl font-bold hover:bg-gray-50 active:bg-black active:text-white transition-all text-black">
                {num}
              </button>
            ))}
            <button onClick={() => handleNumpad('*')} className="h-14 bg-neo-purple/10 border-2 border-gray-200 hover:border-black flex items-center justify-center hover:bg-neo-purple/20 active:bg-black active:text-white transition-all text-black">
              <X size={24} />
            </button>

            {/* Row 3 */}
            {[1, 2, 3].map((num) => (
              <button key={num} onClick={() => handleNumpad(num.toString())} className="h-14 bg-white border-2 border-gray-200 hover:border-black text-2xl font-bold hover:bg-gray-50 active:bg-black active:text-white transition-all text-black">
                {num}
              </button>
            ))}
            <button onClick={() => handleNumpad('-')} className="h-14 bg-neo-purple/10 border-2 border-gray-200 hover:border-black flex items-center justify-center hover:bg-neo-purple/20 active:bg-black active:text-white transition-all text-black">
              <Minus size={24} />
            </button>

            {/* Row 4 */}
            <button onClick={() => handleNumpad('.')} className="h-14 bg-white border-2 border-gray-200 hover:border-black text-2xl font-bold hover:bg-gray-50 active:bg-black active:text-white transition-all text-black">
              .
            </button>
            <button onClick={() => handleNumpad('0')} className="h-14 bg-white border-2 border-gray-200 hover:border-black text-2xl font-bold hover:bg-gray-50 active:bg-black active:text-white transition-all text-black">
              0
            </button>
            <button onClick={() => handleNumpad('back')} className="h-14 bg-neo-red/10 border-2 border-gray-200 hover:border-black flex items-center justify-center hover:bg-neo-red/20 active:bg-black active:text-white transition-all text-black">
              <Delete size={24} />
            </button>
            <button onClick={() => handleNumpad('+')} className="h-14 bg-neo-purple/10 border-2 border-gray-200 hover:border-black flex items-center justify-center hover:bg-neo-purple/20 active:bg-black active:text-white transition-all text-black">
              <Plus size={24} />
            </button>

            {/* Row 5 */}
            <button 
              onClick={() => handleNumpad('=')}
              className="col-span-4 h-14 bg-neo-green/20 border-2 border-gray-200 hover:border-black flex items-center justify-center hover:bg-neo-green/30 active:bg-black active:text-white transition-all text-black font-bold"
            >
              <Equal size={24} className="mr-2" /> Calculate
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
