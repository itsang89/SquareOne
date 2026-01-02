import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Handshake, Wallet, QrCode, Calendar, ArrowRight, CheckCircle } from 'lucide-react';
import { BackButton } from '../components/NeoComponents';
import { useAppContext } from '../context/AppContext';
import { calculateFriendBalance } from '../utils/calculations';
import { Transaction } from '../types';
import { Avatar } from '../components/NeoComponents';

export const SettleUp: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { friends, transactions, addTransaction, getFriendById } = useAppContext();
  const friend = getFriendById(id || '') || friends[0];
  
  // Fix: Calculate actual balance from transactions
  const balance = useMemo(() => {
    if (!friend) return 0;
    return calculateFriendBalance(friend.id, transactions);
  }, [friend, transactions]);
  
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'digital'>('cash');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  
  // Fix: Set default amount to full balance
  React.useEffect(() => {
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
      alert('Please enter a valid amount');
      return;
    }
    
    if (amountNum > Math.abs(balance)) {
      alert('Amount cannot exceed balance');
      return;
    }
    
    // Fix: Create settlement transaction
    // If balance is positive (they owe you), settlement reduces it (negative amount)
    // If balance is negative (you owe them), settlement increases it (positive amount)
    const settlementAmount = balance >= 0 ? -amountNum : amountNum;
    
    // Fix: Use selected date but current time for the settlement
    const selectedDate = new Date(date);
    const now = new Date();
    selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    
    const settlement: Transaction = {
      id: crypto.randomUUID(),
      title: 'Settlement',
      amount: Math.abs(settlementAmount),
      date: selectedDate.toISOString(),
      type: 'General',
      payerId: balance >= 0 ? friend.id : 'me',
      friendId: balance >= 0 ? 'me' : friend.id,
      note: note || `Settled via ${paymentMethod === 'cash' ? 'cash' : 'PayMe/FPS'}`,
      isSettlement: true,
    };
    
    try {
      await addTransaction(settlement);
      navigate(`/friends/${friend.id}`);
    } catch (error) {
      console.error('Error adding settlement:', error);
      alert('Failed to add settlement. Please try again.');
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
    <div className="min-h-screen bg-neo-bg flex flex-col font-display pb-6">
        <header className="w-full max-w-md mx-auto p-6 flex items-center justify-between">
            <BackButton />
            <div className="bg-neo-yellow text-black px-4 py-2 border-2 border-black shadow-neo-sm transform rotate-1">
                <h1 className="text-xl font-black uppercase tracking-wide">Settle Up</h1>
            </div>
            <div className="w-10"></div>
        </header>

        <main className="flex-1 w-full max-w-md mx-auto px-6 flex flex-col gap-6">
            <div className="bg-white border-2 border-black p-5 shadow-neo relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-neo-blue border-l-2 border-b-2 border-black rounded-bl-3xl flex items-center justify-center">
                    <Handshake size={32} strokeWidth={1.5} />
                </div>
                
                <div className="mb-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Settling with</p>
                    <div className="flex items-center gap-3">
                         <Avatar src={friend.avatar} alt={friend.name} size="lg" />
                        <div>
                            <h2 className="text-2xl font-black uppercase leading-none">{friend.name}</h2>
                            <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 border border-black text-[10px] font-bold uppercase">{friend.handle}</span>
                        </div>
                    </div>
                </div>

                <div className="border-t-2 border-black pt-4 mt-2">
                    <div className="flex justify-between items-end">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Total Balance</p>
                            <p className="text-4xl font-black mt-1">${Math.abs(balance).toFixed(2)}</p>
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
                    <span className="text-sm font-bold uppercase tracking-widest ml-1">Amount to pay</span>
                    <div className="relative mt-2">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-green-600">$</span>
                        <input 
                            type="number" 
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full h-20 bg-white border-2 border-black pl-10 pr-4 text-5xl font-black focus:outline-none focus:shadow-neo-lg focus:bg-green-50 transition-all placeholder:text-gray-300"
                        />
                        <button 
                          onClick={handleMax}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold uppercase bg-neo-yellow px-3 py-1 border-2 border-black hover:bg-yellow-300 hover:shadow-sm transition-all"
                        >
                            Max
                        </button>
                    </div>
                </label>

                <div className="grid grid-cols-3 gap-3">
                    <button 
                      onClick={() => handleQuickAmount('100')}
                      className={`h-10 border-2 border-black font-bold text-sm shadow-neo-sm active:shadow-none active:translate-y-1 transition-all hover:bg-blue-50 ${amount === '100' ? 'bg-neo-blue text-black' : 'bg-white'}`}
                    >
                        $100
                    </button>
                    <button 
                      onClick={() => handleQuickAmount('500')}
                      className={`h-10 border-2 border-black font-bold text-sm shadow-neo-sm active:shadow-none active:translate-y-1 transition-all hover:bg-blue-50 ${amount === '500' ? 'bg-neo-blue text-black' : 'bg-white'}`}
                    >
                        $500
                    </button>
                    <button 
                      onClick={() => handleQuickAmount('Full')}
                      className={`h-10 border-2 border-black font-bold text-sm shadow-neo-sm active:shadow-none active:translate-y-1 transition-all hover:bg-blue-50 ${amount === Math.abs(balance).toFixed(2) ? 'bg-neo-blue text-black' : 'bg-white'}`}
                    >
                        Full
                    </button>
                </div>
            </div>

            {/* Methods */}
            <div className="mt-2">
                <p className="text-sm font-bold uppercase tracking-widest ml-1 mb-2">Payment Method</p>
                <div className="bg-white border-2 border-black p-4 shadow-neo-sm">
                    <button 
                      onClick={() => setPaymentMethod('cash')}
                      className="w-full flex items-center gap-3 mb-3 cursor-pointer group"
                    >
                        <div className={`w-6 h-6 rounded-full border-2 border-black flex items-center justify-center ${paymentMethod === 'cash' ? 'bg-neo-green' : 'bg-white'} group-hover:bg-green-400`}>
                             {paymentMethod === 'cash' && <div className="w-2.5 h-2.5 bg-black rounded-full"></div>}
                        </div>
                        <Wallet className="text-black" />
                        <div className="flex-1 text-left">
                            <p className="font-bold text-lg leading-none">Record Cash Payment</p>
                            <p className="text-xs text-gray-500 font-medium mt-0.5">No digital transfer</p>
                        </div>
                    </button>
                    
                    <div className="w-full h-[2px] bg-gray-200 my-3"></div>
                    
                    <button 
                      onClick={() => setPaymentMethod('digital')}
                      className="w-full flex items-center gap-3 cursor-pointer opacity-50 hover:opacity-100 transition-opacity"
                    >
                         <div className={`w-6 h-6 rounded-full border-2 border-black flex items-center justify-center ${paymentMethod === 'digital' ? 'bg-neo-green' : 'bg-white'} hover:bg-neutral-100`}>
                           {paymentMethod === 'digital' && <div className="w-2.5 h-2.5 bg-black rounded-full"></div>}
                         </div>
                         <QrCode />
                         <div className="flex-1 text-left">
                            <p className="font-bold text-lg leading-none">PayMe / FPS</p>
                            <p className="text-xs text-gray-500 font-medium mt-0.5">External app</p>
                         </div>
                         <ArrowRight size={16} className="-rotate-45" />
                    </button>
                </div>
            </div>

            <div className="mt-2 flex gap-3">
                <div className="flex-1">
                    <label className="block">
                        <span className="text-sm font-bold uppercase tracking-widest ml-1">Date</span>
                        <div className="relative mt-1">
                            <input 
                              type="date" 
                              value={date}
                              onChange={(e) => setDate(e.target.value)}
                              className="w-full h-12 bg-white border-2 border-black px-3 text-base font-bold focus:outline-none focus:shadow-neo focus:bg-purple-50 transition-all" 
                            />
                            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" size={18} />
                        </div>
                    </label>
                </div>
                <div className="flex-[1.5]">
                     <label className="block">
                        <span className="text-sm font-bold uppercase tracking-widest ml-1">Note (Optional)</span>
                        <input 
                          type="text" 
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Dinner..." 
                          className="w-full h-12 mt-1 bg-white border-2 border-black px-3 text-base font-bold focus:outline-none focus:shadow-neo focus:bg-purple-50 transition-all" 
                        />
                    </label>
                </div>
            </div>

            <div className="mt-auto pt-6">
                <button 
                    onClick={handleConfirmSettle}
                    className="w-full h-16 bg-neo-green text-black text-xl font-black uppercase tracking-wider border-2 border-black shadow-neo hover:shadow-neo-lg hover:-translate-y-1 transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center justify-center gap-3 group"
                >
                    <CheckCircle size={28} className="group-hover:scale-110 transition-transform" />
                    <span>Confirm Settle</span>
                </button>
                <p className="text-center mt-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    This will update your balance immediately
                </p>
            </div>
        </main>
    </div>
  );
};