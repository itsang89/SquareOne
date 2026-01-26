import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Handshake, Wallet, QrCode, Calendar, ArrowRight, CheckCircle } from 'lucide-react';
import { BackButton, Avatar, NeoButton, NeoInput } from '../components/NeoComponents';
import { useAppContext } from '../context/AppContext';
import { calculateFriendBalance } from '../utils/calculations';
import { Transaction } from '../types';
import { useToast } from '../components/ToastContext';
import { DatePicker } from '../components/AddTransaction/DatePicker';
import { formatCurrency, formatDate } from '../utils/formatters';

export const SettleUp: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { friends, transactions, addTransaction, getFriendById } = useAppContext();
  const { success, error: showError } = useToast();
  
  const friend = getFriendById(id || '') || friends[0];
  
  const balance = useMemo(() => {
    if (!friend) return 0;
    return calculateFriendBalance(friend.id, transactions);
  }, [friend, transactions]);
  
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'digital'>('cash');
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
      note: note || `Settled via ${paymentMethod === 'cash' ? 'cash' : 'PayMe/FPS'}`,
      isSettlement: true,
    };
    
    try {
      const result = await addTransaction(settlement);
      if (result.success) {
        success('Settled up!', `You settled with ${friend.name}.`);
        navigate(`/friends/${friend.id}`);
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
                            <p className="text-4xl font-black mt-1 dark:text-zinc-100">{formatCurrency(Math.abs(balance))}</p>
                        </div>
                        <div className={`${balance >= 0 ? 'bg-neo-green' : 'bg-neo-red'} ${balance >= 0 ? 'text-black' : 'text-white'} px-2 py-1 text-[10px] font-bold uppercase -mb-1 transform -rotate-2 border border-black shadow-sm`}>
                            {balance >= 0 ? 'They Owe' : 'You Owe'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Input */}
            <div className="flex flex-col gap-4">
                <label className="block">
                    <span className="text-sm font-bold uppercase tracking-widest ml-1 dark:text-zinc-400">Amount to pay</span>
                    <div className="relative mt-2">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-green-600 dark:text-neo-greenDark">$</span>
                        <input 
                            type="number" 
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            disabled={isSubmitting}
                            className="w-full h-20 bg-white dark:bg-zinc-900 border-2 border-black pl-10 pr-24 text-5xl font-black focus:outline-none focus:shadow-neo-lg focus:bg-white dark:focus:bg-zinc-800 transition-all placeholder:text-gray-300 dark:placeholder:text-zinc-700 dark:text-zinc-100"
                        />
                        <button 
                          onClick={handleMax}
                          disabled={isSubmitting}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold uppercase bg-neo-yellow text-black px-3 py-1 border-2 border-black hover:bg-yellow-300 hover:shadow-sm transition-all disabled:opacity-50"
                        >
                            Max
                        </button>
                    </div>
                </label>

                <div className="grid grid-cols-3 gap-3">
                    {['100', '500', 'Full'].map(val => (
                      <button 
                        key={val}
                        onClick={() => handleQuickAmount(val)}
                        disabled={isSubmitting}
                        className={`h-10 border-2 border-black font-bold text-sm shadow-neo-sm active:shadow-none active:translate-y-1 transition-all hover:bg-blue-50 dark:hover:bg-zinc-800 disabled:opacity-50 ${
                          (val === 'Full' && amount === Math.abs(balance).toFixed(2)) || amount === val 
                            ? 'bg-neo-blue text-black' 
                            : 'bg-white dark:bg-zinc-900 dark:text-zinc-100'
                        }`}
                      >
                          {val === 'Full' ? 'Full' : `$${val}`}
                      </button>
                    ))}
                </div>
            </div>

            {/* Methods */}
            <div className="mt-2">
                <p className="text-sm font-bold uppercase tracking-widest ml-1 mb-2 dark:text-zinc-400">Payment Method</p>
                <div className="bg-white dark:bg-zinc-900 border-2 border-black p-4 shadow-neo-sm">
                    <button 
                      onClick={() => setPaymentMethod('cash')}
                      disabled={isSubmitting}
                      className="w-full flex items-center gap-3 mb-3 cursor-pointer group disabled:opacity-50"
                    >
                        <div className={`w-6 h-6 rounded-full border-2 border-black flex items-center justify-center ${paymentMethod === 'cash' ? 'bg-neo-green' : 'bg-white dark:bg-zinc-800'} group-hover:bg-green-400`}>
                             {paymentMethod === 'cash' && <div className="w-2.5 h-2.5 bg-black dark:bg-zinc-100 rounded-full"></div>}
                        </div>
                        <Wallet className="text-black dark:text-zinc-100" />
                        <div className="flex-1 text-left">
                            <p className="font-bold text-lg leading-none dark:text-zinc-100">Record Cash Payment</p>
                            <p className="text-xs text-gray-500 dark:text-zinc-500 font-medium mt-0.5">No digital transfer</p>
                        </div>
                    </button>
                    
                    <div className="w-full h-[2px] bg-gray-200 dark:bg-white/10 my-3"></div>
                    
                    <button 
                      onClick={() => setPaymentMethod('digital')}
                      disabled={isSubmitting}
                      className="w-full flex items-center gap-3 cursor-pointer opacity-50 hover:opacity-100 transition-opacity disabled:opacity-30"
                    >
                         <div className={`w-6 h-6 rounded-full border-2 border-black flex items-center justify-center ${paymentMethod === 'digital' ? 'bg-neo-green' : 'bg-white dark:bg-zinc-800'} hover:bg-neutral-100`}>
                           {paymentMethod === 'digital' && <div className="w-2.5 h-2.5 bg-black dark:bg-zinc-100 rounded-full"></div>}
                         </div>
                         <QrCode className="text-black dark:text-zinc-100" />
                         <div className="flex-1 text-left">
                            <p className="font-bold text-lg leading-none dark:text-zinc-100">PayMe / FPS</p>
                            <p className="text-xs text-gray-500 dark:text-zinc-500 font-medium mt-0.5">External app</p>
                         </div>
                         <ArrowRight size={16} className="-rotate-45 text-black dark:text-zinc-100" />
                    </button>
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
