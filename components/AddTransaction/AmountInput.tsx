import React from 'react';
import { Delete } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

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
      onAmountChange(amount.length > 1 ? amount.slice(0, -1) : '0');
    } else if (val === '.') {
      if (!amount.includes('.')) onAmountChange(amount + '.');
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
          <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0].map((num) => (
              <button 
                key={num} 
                onClick={() => handleNumpad(num.toString())}
                className="h-14 bg-white border-2 border-gray-200 hover:border-black text-2xl font-bold hover:bg-gray-50 active:bg-black active:text-white transition-all text-black"
              >
                {num}
              </button>
            ))}
            <button 
              onClick={() => handleNumpad('back')}
              className="h-14 bg-neo-red/20 border-2 border-gray-200 hover:border-black flex items-center justify-center hover:bg-neo-red/30 active:bg-black active:text-white transition-all text-black"
            >
              <Delete size={24} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
