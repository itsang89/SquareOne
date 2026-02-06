import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { Handshake, Calendar, CheckCircle } from 'lucide-react';
import { BackButton, Avatar, NeoButton, NeoInput } from '../components/NeoComponents';
import { useAppContext } from '../context/AppContext';
import { calculateFriendBalance } from '../utils/calculations';
import { Transaction } from '../types';
import { useToast } from '../components/ToastContext';
import { DatePicker } from '../components/AddTransaction/DatePicker';
import { formatCurrency, formatDate } from '../utils/formatters';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { springs } from '../utils/animations';
import { useAnimations } from '../hooks/useAnimations';
import { celebrateSettlement } from '../utils/confetti';

export const SettleUp: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { friends, transactions, addTransaction, getFriendById } = useAppContext();
  const { success, error: showError } = useToast();
  const { getTransition } = useAnimations();
  
  const friend = getFriendById(id || '') || friends[0];
  
  const balance = useMemo(() => {
    if (!friend) return 0;
    return calculateFriendBalance(friend.id, transactions);
  }, [friend, transactions]);
  
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (balance !== 0 && !amount) {
      setAmount(Math.abs(balance).toFixed(2));
    }
  }, [balance, amount]);
  
  const handleMax = () => {
    setAmount(Math.abs(balance).toFixed(2));
  };
  
  const handleQuickAmount = (value: string) => {
    if (value === 'Full') {
      handleMax();
    } else {
      setAmount(value);
    }
  };
  
  const handleConfirmSettle = async () => {
    if (!friend) return;
    
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showError('Invalid amount', 'Please enter a valid amount to settle.');
      return;
    }
    
    if (amountNum > Math.abs(balance) + 0.01) {
      showError('Overpayment', 'Amount cannot exceed current balance.');
      return;
    }

    setIsSubmitting(true);
    
    const selectedDate = new Date(date);
    const now = new Date();
    selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
    
    const settlement: Transaction = {
      id: crypto.randomUUID(),
      title: 'Settlement',
      amount: Math.abs(amountNum),
      date: selectedDate.toISOString(),
      type: 'General',
      payerId: balance >= 0 ? friend.id : 'me',
      friendId: balance >= 0 ? 'me' : friend.id,
      note: note || 'Settled',
      isSettlement: true,
    };
    
    try {
      const result = await addTransaction(settlement);
      if (result.success) {
        // Trigger confetti celebration
        celebrateSettlement();
        success('Settled up!', `You settled with ${friend.name}.`);
        
        // Wait a moment for the celebration before navigating
        setTimeout(() => {
          navigate(`/friends/${friend.id}`);
        }, 1000);
      } else {
        showError('Settlement failed', result.error?.message);
      }
    } catch (error: any) {
      showError('Something went wrong', error.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (!friend) {
    return (
      <div className="min-h-screen bg-neo-bg dark:bg-zinc-950 flex items-center justify-center">
        <p className="text-lg font-bold dark:text-zinc-100">Friend not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neo-bg dark:bg-zinc-950 flex flex-col font-display pb-6 transition-colors duration-300">
        <header className="w-full max-w-md mx-auto p-6 flex items-center justify-between">
            <BackButton to={`/friends/${friend.id}`} />
            <div className="bg-neo-yellow text-black px-4 py-2 border-2 border-black shadow-neo-sm transform rotate-1">
                <h1 className="text-xl font-black uppercase tracking-wide">Settle Up</h1>
            </div>
            <div className="w-10"></div>
        </header>

        <main className="flex-1 w-full max-w-md mx-auto px-6 flex flex-col gap-6">
            <div className="bg-white dark:bg-zinc-900 border-2 border-black p-5 shadow-neo relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-neo-blue border-l-2 border-b-2 border-black rounded-bl-3xl flex items-center justify-center">
                    <Handshake size={32} strokeWidth={1.5} className="text-black" />
                </div>
                
                <div className="mb-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-zinc-500 mb-1">Settling with</p>
                    <div className="flex items-center gap-3">
                         <Avatar src={friend.avatar} alt={friend.name} size="lg" />
                        <div>
                            <h2 className="text-2xl font-black uppercase leading-none dark:text-zinc-100">{friend.name}</h2>
                        </div>
                    </div>
                </div>

                <div className="border-t-2 border-black pt-4 mt-2">
                    <div className="flex justify-between items-end">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-zinc-500">Total Balance</p>
                            <p className="text-4xl font-black mt-1 dark:text-zinc-100">
                              <AnimatedNumber value={Math.abs(balance)} decimals={2} prefix="$" />
                            </p>
                        </div>
                        <motion.div 
                          className={`${balance >= 0 ? 'bg-neo-green' : 'bg-neo-red'} ${balance >= 0 ? 'text-black' : 'text-white'} px-2 py-1 text-[10px] font-bold uppercase -mb-1 border border-black shadow-sm`}
                          initial={{ rotate: -2, scale: 0 }}
                          animate={{ rotate: -2, scale: 1 }}
                          transition={springs.bouncy}
                        >
                            {balance >= 0 ? 'They Owe' : 'You Owe'}
                        </motion.div>
                    </div>
                </div>
            </div>

            {/* Input */}
            <div className="flex flex-col gap-4">
                <label className="block">
                    <span className="text-sm font-bold uppercase tracking-widest ml-1 dark:text-zinc-400">Amount to pay</span>
                    <div className="relative mt-2">
                        <motion.span 
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-green-600 dark:text-neo-greenDark"
                          animate={{ scale: amount ? 1 : [1, 1.2, 1] }}
                          transition={{ 
                            duration: 0.6, 
                            repeat: amount ? 0 : Infinity, 
                            repeatType: 'reverse',
                            type: 'keyframes'
                          }}
                        >
                          $
                        </motion.span>
                        <motion.input 
                            type="number" 
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            disabled={isSubmitting}
                            className="w-full h-20 bg-white dark:bg-zinc-900 border-2 border-black pl-10 pr-24 text-5xl font-black focus:outline-none placeholder:text-gray-300 dark:placeholder:text-zinc-700 dark:text-zinc-100"
                            whileFocus={{
                              boxShadow: '6px 6px 0px 0px rgba(0,0,0,1)',
                              scale: 1.01,
                              transition: getTransition(springs.snappy),
                            }}
                        />
                        <motion.button 
                          onClick={handleMax}
                          disabled={isSubmitting}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold uppercase bg-neo-yellow text-black px-3 py-1 border-2 border-black disabled:opacity-50"
                          whileHover={{ scale: 1.05, boxShadow: '2px 2px 0px 0px rgba(0,0,0,1)' }}
                          whileTap={{ scale: 0.95 }}
                          animate={amount === Math.abs(balance).toFixed(2) ? { y: 0 } : { y: [0, -2, 0] }}
                          transition={{ 
                            type: 'keyframes',
                            duration: 0.6, 
                            repeat: amount === Math.abs(balance).toFixed(2) ? 0 : Infinity, 
                            repeatType: 'reverse' 
                          }}
                        >
                            Max
                        </motion.button>
                    </div>
                </label>

                <div className="grid grid-cols-3 gap-3">
                    {['100', '500', 'Full'].map(val => {
                      const isSelected = (val === 'Full' && amount === Math.abs(balance).toFixed(2)) || amount === val;
                      return (
                        <motion.button 
                          key={val}
                          onClick={() => handleQuickAmount(val)}
                          disabled={isSubmitting}
                          className={`h-10 border-2 border-black font-bold text-sm shadow-neo-sm disabled:opacity-50 ${
                            isSelected
                              ? 'bg-neo-blue text-black' 
                              : 'bg-white dark:bg-zinc-900 dark:text-zinc-100'
                          }`}
                          whileHover={!isSelected ? { 
                            backgroundColor: 'rgba(147, 197, 253, 0.2)',
                            scale: 1.02,
                          } : {}}
                          whileTap={{ 
                            boxShadow: '0px 0px 0px 0px rgba(0,0,0,1)',
                            y: 1,
                            scale: 0.98,
                          }}
                          animate={isSelected ? {
                            scale: [1, 1.05, 1],
                            boxShadow: ['2px 2px 0px 0px rgba(0,0,0,1)', '4px 4px 0px 0px rgba(0,0,0,1)', '2px 2px 0px 0px rgba(0,0,0,1)'],
                          } : { scale: 1, boxShadow: '2px 2px 0px 0px rgba(0,0,0,1)' }}
                          transition={{
                            type: 'keyframes',
                            duration: 0.6,
                            repeat: isSelected ? Infinity : 0,
                            repeatType: 'reverse'
                          }}
                        >
                            {val === 'Full' ? 'Full' : `$${val}`}
                        </motion.button>
                      );
                    })}
                </div>
            </div>

            <div className="mt-2 flex gap-3">
                <div className="flex-1">
                    <label className="block">
                        <span className="text-sm font-bold uppercase tracking-widest ml-1 dark:text-zinc-400">Date</span>
                        <div className="relative mt-1">
                            <button 
                              onClick={() => setShowDatePicker(true)}
                              disabled={isSubmitting}
                              className="w-full h-12 bg-white dark:bg-zinc-900 border-2 border-black px-3 text-left text-base font-bold dark:text-zinc-100 focus:outline-none focus:shadow-neo transition-all flex items-center justify-between disabled:opacity-50"
                            >
                              <span>{formatDate(date, 'short')}</span>
                              <Calendar size={18} />
                            </button>
                        </div>
                    </label>
                </div>
                <div className="flex-[1.5]">
                     <NeoInput
                        label="Note (Optional)"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        disabled={isSubmitting}
                        placeholder="Dinner..."
                        className="h-12"
                        fullWidth
                     />
                </div>
            </div>

            <div className="mt-auto pt-6">
                <NeoButton 
                    onClick={handleConfirmSettle}
                    isLoading={isSubmitting}
                    fullWidth
                    variant="primary"
                    className="h-16 text-xl group"
                >
                    <CheckCircle size={28} className="group-hover:scale-110 transition-transform" />
                    <span>Confirm Settle</span>
                </NeoButton>
                <p className="text-center mt-4 text-[10px] font-bold text-gray-400 dark:text-zinc-600 uppercase tracking-widest">
                    This will update your balance immediately
                </p>
            </div>
        </main>

        <DatePicker
          selectedDate={date}
          onSelect={(d) => {
            setDate(d);
            setShowDatePicker(false);
          }}
          isOpen={showDatePicker}
          onClose={() => setShowDatePicker(false)}
        />
    </div>
  );
};
