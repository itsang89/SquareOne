import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Handshake, Wallet, QrCode, Calendar, ArrowRight, CheckCircle, X, ChevronLeft, ChevronRight } from 'lucide-react';
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
  
  const formatDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Fix: Calculate actual balance from transactions
  const balance = useMemo(() => {
    if (!friend) return 0;
    return calculateFriendBalance(friend.id, transactions);
  }, [friend, transactions]);
  
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'digital'>('cash');
  const [date, setDate] = useState(formatDate(new Date()));
  const [note, setNote] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
  
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

    // Fix: Prevent future dates
    const today = formatDate(new Date());
    if (date > today) {
      alert('Future dates are not allowed');
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
      amount: Math.abs(amountNum),
      date: selectedDate.toISOString(),
      type: 'General',
      payerId: balance >= 0 ? friend.id : 'me',
      friendId: balance >= 0 ? 'me' : friend.id,
      note: note || `Settled via ${paymentMethod === 'cash' ? 'cash' : 'PayMe/FPS'}`,
      isSettlement: true,
    };
    
    try {
      console.log('Attempting to add settlement:', settlement);
      await addTransaction(settlement);
      navigate(`/friends/${friend.id}`);
    } catch (error: any) {
      console.error('Error adding settlement:', error);
      alert(`Failed to add settlement: ${error.message || 'Unknown error'}`);
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
            <BackButton to={`/friends/${friend.id}`} />
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
                            className="w-full h-20 bg-white border-2 border-black pl-10 pr-4 text-5xl font-black focus:outline-none focus:shadow-neo-lg focus:bg-white transition-all placeholder:text-gray-300"
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
                            <button 
                              onClick={() => {
                                const currentSelectedDate = new Date(date);
                                if (!isNaN(currentSelectedDate.getTime())) {
                                  setViewDate(currentSelectedDate);
                                }
                                setShowDatePicker(true);
                              }}
                              className="w-full h-12 bg-white border-2 border-black px-3 text-left text-base font-bold focus:outline-none focus:shadow-neo transition-all flex items-center justify-between"
                            >
                              <span>{new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                              <Calendar size={18} />
                            </button>
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
                          className="w-full h-12 mt-1 bg-white border-2 border-black px-3 text-base font-bold focus:outline-none focus:shadow-neo focus:bg-white transition-all" 
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

        {/* Custom Date Picker Modal */}
        {showDatePicker && (
          <div 
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" 
            onClick={() => setShowDatePicker(false)}
          >
            <div className="bg-white border-2 border-black shadow-neo-lg p-6 rounded-lg w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black uppercase">Select Date</h3>
                <button 
                  onClick={() => setShowDatePicker(false)}
                  className="w-8 h-8 flex items-center justify-center border-2 border-black hover:bg-gray-100"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Calendar Header */}
              <div className="flex items-center justify-between mb-4 bg-gray-50 border-2 border-black p-2">
                <button 
                  onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1))}
                  className="w-8 h-8 flex items-center justify-center hover:bg-white border border-transparent hover:border-black transition-all"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="font-black uppercase text-sm tracking-tight">
                  {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
                <button 
                  onClick={() => {
                    const nextMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1);
                    if (nextMonth <= new Date() || nextMonth.getMonth() === new Date().getMonth() && nextMonth.getFullYear() === new Date().getFullYear()) {
                      setViewDate(nextMonth);
                    }
                  }}
                  className={`w-8 h-8 flex items-center justify-center transition-all ${
                    new Date(viewDate.getFullYear(), viewDate.getMonth() + 1) > new Date() && viewDate.getMonth() === new Date().getMonth()
                    ? 'opacity-20 cursor-not-allowed' 
                    : 'hover:bg-white border border-transparent hover:border-black'
                  }`}
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1 mb-4">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                  <div key={day} className="text-center text-[10px] font-black text-gray-400 pb-2">{day}</div>
                ))}
                
                {Array.from({ length: getFirstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth()) }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-10 w-10" />
                ))}
                
                {Array.from({ length: getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth()) }).map((_, i) => {
                  const day = i + 1;
                  const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
                  const dateStr = formatDate(d);
                  const todayStr = formatDate(new Date());
                  const isToday = dateStr === todayStr;
                  const isSelected = dateStr === date;
                  
                  const now = new Date();
                  now.setHours(23, 59, 59, 999);
                  const isFuture = d > now;
                  
                  return (
                    <button
                      key={day}
                      disabled={isFuture}
                      onClick={() => {
                        setDate(dateStr);
                        setShowDatePicker(false);
                      }}
                      className={`h-10 w-10 flex items-center justify-center font-bold text-xs transition-all border-2 
                        ${isSelected 
                          ? 'bg-neo-yellow border-black shadow-neo-sm -translate-y-0.5' 
                          : isToday 
                            ? 'border-neo-blue text-neo-blue hover:bg-neo-blue/5' 
                            : isFuture 
                              ? 'text-gray-200 border-transparent cursor-not-allowed' 
                              : 'border-transparent hover:border-black hover:bg-gray-50'
                        }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => {
                    const today = formatDate(new Date());
                    setDate(today);
                    setShowDatePicker(false);
                  }}
                  className="flex-1 h-12 bg-neo-blue border-2 border-black text-black font-black uppercase text-xs shadow-neo-sm active:shadow-none active:translate-y-1"
                >
                  Today
                </button>
                <button
                  onClick={() => setShowDatePicker(false)}
                  className="flex-1 h-12 bg-white border-2 border-black text-black font-black uppercase text-xs shadow-neo-sm active:shadow-none active:translate-y-1"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};