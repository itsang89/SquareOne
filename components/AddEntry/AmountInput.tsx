import React, { useEffect, useRef } from 'react';
import { Delete, Divide, X, Minus, Plus } from 'lucide-react';
import { evaluateExpression } from '../../utils/calculator';
import { formatCurrency } from '../../utils/formatters';

interface AmountInputProps {
  amount: string;
  onAmountChange: (newAmount: string) => void;
  showNumpad: boolean;
  onToggleNumpad: () => void;
  currency: string;
}

export const AmountInput: React.FC<AmountInputProps> = ({
  amount,
  onAmountChange,
  showNumpad,
  onToggleNumpad,
  currency,
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
      if (showNumpad) onToggleNumpad();
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

  // Keep refs stable so the effect closure never goes stale
  const handleNumpadRef = useRef(handleNumpad);
  const onToggleNumpadRef = useRef(onToggleNumpad);
  const showNumpadRef = useRef(showNumpad);
  useEffect(() => {
    handleNumpadRef.current = handleNumpad;
    onToggleNumpadRef.current = onToggleNumpad;
    showNumpadRef.current = showNumpad;
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      if (/^[0-9]$/.test(e.key) || e.key === '.') {
        if (!showNumpadRef.current) onToggleNumpadRef.current();
        handleNumpadRef.current(e.key);
        e.preventDefault();
      } else if (showNumpadRef.current) {
        if (e.key === 'Backspace') {
          handleNumpadRef.current('back');
          e.preventDefault();
        } else if (e.key === 'Enter' || e.key === '=') {
          handleNumpadRef.current('=');
          e.preventDefault();
        } else if (['+', '-', '*', '/'].includes(e.key)) {
          handleNumpadRef.current(e.key);
          e.preventDefault();
        } else if (e.key === 'Escape') {
          onToggleNumpadRef.current();
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const symbol = formatCurrency(0, currency).replace(/[\d.,\s-]/g, '');
  const isExpr = /[0-9.][+*/-][0-9.]/.test(amount);
  const shown = amount.replace(/\*/g, '×').replace(/\//g, '÷');
  const keys: { k: string; label: React.ReactNode; op?: boolean; aria?: string }[] = [
    { k: '7', label: '7' }, { k: '8', label: '8' }, { k: '9', label: '9' }, { k: '/', label: <Divide size={22} />, op: true, aria: 'Divide' },
    { k: '4', label: '4' }, { k: '5', label: '5' }, { k: '6', label: '6' }, { k: '*', label: <X size={22} />, op: true, aria: 'Multiply' },
    { k: '1', label: '1' }, { k: '2', label: '2' }, { k: '3', label: '3' }, { k: '-', label: <Minus size={22} />, op: true, aria: 'Minus' },
    { k: '.', label: '.' }, { k: '0', label: '0' }, { k: 'back', label: <Delete size={22} />, op: true, aria: 'Backspace' }, { k: '+', label: <Plus size={22} />, op: true, aria: 'Plus' },
  ];

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onToggleNumpad}
        aria-label={showNumpad ? 'Hide keypad' : 'Show keypad'}
        className="w-full flex flex-col items-center justify-center py-5 bg-white dark:bg-zinc-900 border-2 border-black shadow-neo-sm"
      >
        <span className="text-xs font-bold uppercase tracking-widest text-gray-600 dark:text-zinc-400">Amount</span>
        <span className="mt-1 flex items-baseline justify-center gap-1.5 px-4 break-all text-black dark:text-zinc-100">
          <span className="text-2xl font-bold text-gray-600 dark:text-zinc-400">{symbol}</span>
          <span className="text-5xl font-black tracking-tight tabular-nums">{shown}</span>
        </span>
        {isExpr && (
          <span className="mt-1 text-sm font-bold text-gray-600 dark:text-zinc-400 tabular-nums">= {formatCurrency(parseFloat(evaluateExpression(amount)) || 0, currency)}</span>
        )}
      </button>

      {showNumpad && (
        <div className="grid grid-cols-4 gap-2">
          {keys.map(({ k, label, op, aria }) => (
            <button
              key={k}
              type="button"
              aria-label={aria}
              onClick={() => handleNumpad(k)}
              className={`h-12 border-2 border-black grid place-items-center text-2xl font-bold text-black dark:text-zinc-100 active:translate-y-0.5 active:shadow-none shadow-neo-sm transition-transform ${
                op ? 'bg-neo-bg dark:bg-zinc-800' : 'bg-white dark:bg-zinc-900'
              }`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleNumpad('=')}
            className="col-span-4 h-12 border-2 border-black bg-neo-yellow text-black font-black uppercase tracking-widest shadow-neo-sm active:translate-y-0.5 active:shadow-none transition-transform"
          >
            {isExpr ? '= Done' : 'Done'}
          </button>
        </div>
      )}
    </div>
  );
};
