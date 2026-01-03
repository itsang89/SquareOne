import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronDown, Calendar, FileText, Camera, Plus, Delete, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { TRANSACTION_TAGS } from '../constants';
import { useAppContext } from '../context/AppContext';
import { Transaction, TransactionType } from '../types';
import { Avatar } from '../components/NeoComponents';

export const AddTransaction: React.FC = () => {
  const navigate = useNavigate();
  const { friends, addTransaction } = useAppContext();

  const formatDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [amount, setAmount] = useState('0');
  const [direction, setDirection] = useState<'owe' | 'they-owe'>('owe');
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<TransactionType | null>(null);
  const [date, setDate] = useState(formatDate(new Date()));
  const [note, setNote] = useState('');
  const [viewDate, setViewDate] = useState(new Date());

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [showCustomTypeInput, setShowCustomTypeInput] = useState(false);
  const [customTypeInput, setCustomTypeInput] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showNumpad, setShowNumpad] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [customTypes, setCustomTypes] = useState<string[]>(() => {
    // Load custom types from localStorage
    try {
      const stored = localStorage.getItem('squareone_custom_types');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const noteInputRef = useRef<HTMLInputElement>(null);
  const customTypeInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Fix: Hide keyboard when clicking outside or closing modal
  useEffect(() => {
    if (!showNoteInput && noteInputRef.current) {
      noteInputRef.current.blur();
    }
    if (!showCustomTypeInput && customTypeInputRef.current) {
      customTypeInputRef.current.blur();
    }
    if (!showDatePicker && dateInputRef.current) {
      dateInputRef.current.blur();
    }
  }, [showNoteInput, showCustomTypeInput, showDatePicker]);

  // Fix: Hide numpad when interacting with other elements
  useEffect(() => {
    if (showFriendPicker || showDatePicker || showNoteInput || showCustomTypeInput) {
      setShowNumpad(false);
    }
  }, [showFriendPicker, showDatePicker, showNoteInput, showCustomTypeInput]);

  // Fix: Save custom types to localStorage
  useEffect(() => {
    localStorage.setItem('squareone_custom_types', JSON.stringify(customTypes));
  }, [customTypes]);

  const handleAddCustomType = () => {
    if (customTypeInput.trim() && !customTypes.includes(customTypeInput.trim())) {
      setCustomTypes(prev => [...prev, customTypeInput.trim()]);
      setCustomTypeInput('');
      setShowCustomTypeInput(false);
    }
  };

  // Fix: Hide keyboard when clicking outside the main container
  const handleContainerClick = (e: React.MouseEvent) => {
    // If clicking on the container itself (not a child), blur any active inputs
    if (e.target === e.currentTarget) {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        activeElement.blur();
      }
    }
  };

  const handleNumpad = (val: string) => {
    if (val === 'back') {
        setAmount(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
    } else if (val === '.') {
        if (!amount.includes('.')) setAmount(prev => prev + '.');
    } else {
        setAmount(prev => prev === '0' ? val : prev + val);
    }
  };

  const handleSave = async (stayOnPage: boolean = false) => {
    // Fix: Validate form before saving
    const amountNum = parseFloat(amount);
    if (!selectedFriend) {
      alert('Please select a friend');
      return;
    }
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    if (!selectedTag) {
      alert('Please select a transaction type');
      return;
    }

    // Fix: Prevent future dates
    const today = formatDate(new Date());
    if (date > today) {
      alert('Future dates are not allowed');
      return;
    }

    // Fix: Create transaction object based on direction
    // Use selectedTag as title, or fallback to type name
    const transactionTitle = selectedTag || 'General';
    const transactionType = (selectedTag || 'General') as TransactionType;
    
    // Fix: Use selected date but current time for the transaction
    const selectedDate = new Date(date);
    const now = new Date();
    selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    
    const transaction: Transaction = {
      id: crypto.randomUUID(),
      title: transactionTitle,
      amount: amountNum,
      date: selectedDate.toISOString(),
      type: transactionType,
      payerId: direction === 'owe' ? selectedFriend! : 'me',
      friendId: direction === 'owe' ? 'me' : selectedFriend!,
      note: note || undefined,
      isSettlement: false,
    };

    try {
      console.log('Attempting to add transaction:', transaction);
      await addTransaction(transaction);
    } catch (error: any) {
      console.error('Error adding transaction:', error);
      alert(`Failed to add transaction: ${error.message || 'Please try again.'}`);
      return;
    }

    if (stayOnPage) {
      // Fix: Reset form for "Save & Add +"
      setAmount('0');
      setSelectedFriend(null);
      setSelectedTag(null);
      setDate(formatDate(new Date()));
      setNote('');
      setNoteInput('');
      
      // Show success message
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 2000);
    } else {
      navigate('/dashboard');
    }
  };

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    setShowDatePicker(false);
  };

  const selectedFriendData = friends.find(f => f.id === selectedFriend);

  return (
    <>
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
        {/* Header */}
        <div className="flex flex-col items-center pt-2 pb-2 shrink-0 border-b-2 border-black">
             <div className="h-1.5 w-12 rounded-full bg-black mb-4"></div>
             <div className="w-full flex items-center justify-between px-5 pb-2">
                <h2 className="text-xl font-black tracking-tight uppercase">New Transaction</h2>
                <button onClick={() => navigate(-1)} className="flex items-center justify-center w-10 h-10 rounded-lg border-2 border-black hover:bg-neo-red transition-colors shadow-neo-sm active:shadow-none active:translate-y-1">
                    <X className="font-bold text-black" />
                </button>
             </div>
        </div>

        <div 
          className="flex-1 overflow-y-auto no-scrollbar flex flex-col px-5 pt-4 space-y-6 pb-20"
          onClick={handleContainerClick}
        >
            {/* Direction Toggle */}
            <div className="flex w-full h-14 rounded-none border-2 border-black bg-white shadow-neo">
                <label className="flex-1 relative cursor-pointer group">
                    <input 
                      type="radio" 
                      name="direction" 
                      value="owe" 
                      checked={direction === 'owe'} 
                      onChange={() => {
                        setDirection('owe');
                        setShowNumpad(false);
                      }} 
                      className="sr-only peer" 
                    />
                    <div className="w-full h-full flex items-center justify-center font-bold uppercase transition-all bg-transparent text-gray-400 peer-checked:bg-neo-purple peer-checked:text-black hover:bg-gray-100">
                        I Owe
                    </div>
                </label>
                <div className="w-[2px] bg-black"></div>
                <label className="flex-1 relative cursor-pointer group">
                    <input 
                      type="radio" 
                      name="direction" 
                      value="they-owe" 
                      checked={direction === 'they-owe'} 
                      onChange={() => {
                        setDirection('they-owe');
                        setShowNumpad(false);
                      }} 
                      className="sr-only peer" 
                    />
                    <div className="w-full h-full flex items-center justify-center font-bold uppercase transition-all bg-transparent text-gray-400 peer-checked:bg-neo-green peer-checked:text-black hover:bg-gray-100">
                        They Owe
                    </div>
                </label>
            </div>

            {/* Who */}
            <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-gray-500 pl-1">Who?</label>
                <button 
                  onClick={() => {
                    setShowNumpad(false);
                    setShowFriendPicker(!showFriendPicker);
                  }}
                  className="flex items-center justify-between w-full h-16 px-4 border-2 border-black bg-neo-orange/20 text-left shadow-neo active:shadow-none active:translate-y-[2px] transition-all"
                >
                    {selectedFriendData ? (
                      <div className="flex items-center gap-3">
                          <Avatar src={selectedFriendData.avatar} alt={selectedFriendData.name} size="md" />
                          <span className="text-lg font-bold">{selectedFriendData.name}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-neo-orange flex items-center justify-center border-2 border-black text-white font-bold text-sm">
                              ?
                          </div>
                          <span className="text-lg font-bold text-gray-400">Select friend</span>
                      </div>
                    )}
                    <ChevronDown />
                </button>
                
                {/* Fix: Friend picker dropdown */}
                {showFriendPicker && (
                  <div className="bg-white border-2 border-black shadow-neo-lg mt-2 rounded-lg max-h-64 overflow-y-auto">
                    {friends.map(friend => (
                      <button
                        key={friend.id}
                        onClick={() => {
                          // Fix: Blur any active inputs when selecting friend
                          const activeElement = document.activeElement as HTMLElement;
                          if (activeElement) {
                            activeElement.blur();
                          }
                          setSelectedFriend(friend.id);
                          setShowFriendPicker(false);
                        }}
                        className="w-full flex items-center gap-3 p-3 hover:bg-gray-100 border-b-2 border-black last:border-b-0 transition-colors"
                      >
                        <Avatar src={friend.avatar} alt={friend.name} size="md" />
                        <span className="text-base font-bold flex-1 text-left">{friend.name}</span>
                        {selectedFriend === friend.id && <Check size={20} className="text-neo-green" />}
                      </button>
                    ))}
                  </div>
                )}
            </div>

            {/* Display Amount */}
            <div 
              onClick={() => setShowNumpad(true)}
              className="flex flex-col items-center justify-center py-12 bg-[#E0F2FE] border-2 border-black shadow-neo-sm relative overflow-hidden min-h-[180px] cursor-pointer hover:bg-[#D0E8F8] transition-colors active:shadow-neo-pressed active:translate-y-[2px]"
            >
                <div className="absolute top-0 left-0 w-full h-2 bg-black opacity-5"></div>
                <span className="text-xs font-bold uppercase text-gray-500 mb-2 tracking-widest">Amount</span>
                <div className="relative w-full text-center">
                    <h1 className="text-7xl font-black tracking-tighter text-black break-all">
                        <span className="text-4xl align-top opacity-40 font-medium mr-1">$</span>
                        {amount}
                    </h1>
                </div>
            </div>

            {/* Tags */}
            <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-gray-500 pl-1">For What?</label>
                <div className="flex gap-3 overflow-x-auto pb-2 pt-2 pl-1 no-scrollbar">
                    {TRANSACTION_TAGS.map(tag => {
                      const tagType = tag.label as TransactionType;
                      const isSelected = selectedTag === tagType;
                      return (
                        <button 
                          key={tag.label}
                          onClick={() => {
                            // Fix: Blur any active inputs when selecting tag
                            const activeElement = document.activeElement as HTMLElement;
                            if (activeElement) {
                              activeElement.blur();
                            }
                            setShowNumpad(false);
                            setSelectedTag(tagType);
                          }}
                          className={`shrink-0 px-4 py-2 border-2 border-black ${tag.color} text-black font-bold text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-transform ${isSelected ? 'ring-4 ring-neo-yellow ring-offset-2' : ''}`}
                        >
                            {tag.label}
                        </button>
                      );
                    })}
                    {/* Fix: Display custom types */}
                    {customTypes.map(customType => {
                      const isSelected = selectedTag === customType;
                      return (
                        <button
                          key={customType}
                          onClick={() => {
                            const activeElement = document.activeElement as HTMLElement;
                            if (activeElement) {
                              activeElement.blur();
                            }
                            setShowNumpad(false);
                            setSelectedTag(customType as TransactionType);
                          }}
                          className={`shrink-0 px-4 py-2 border-2 border-black bg-neo-orange text-black font-bold text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-transform ${isSelected ? 'ring-4 ring-neo-yellow ring-offset-2' : ''}`}
                        >
                          {customType}
                        </button>
                      );
                    })}
                    <button 
                      onClick={() => {
                        const activeElement = document.activeElement as HTMLElement;
                        if (activeElement) {
                          activeElement.blur();
                        }
                        setShowNumpad(false);
                        setShowCustomTypeInput(true);
                      }}
                      className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full border-2 border-black bg-white hover:bg-gray-100 transition-colors"
                    >
                        <Plus size={16} />
                    </button>
                </div>
            </div>
            
            {/* Fix: Custom type input modal */}
            {showCustomTypeInput && (
              <div 
                className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" 
                onClick={() => {
                  if (customTypeInputRef.current) {
                    customTypeInputRef.current.blur();
                  }
                  setShowCustomTypeInput(false);
                  setCustomTypeInput('');
                }}
              >
                <div className="bg-white border-2 border-black shadow-neo-lg p-6 rounded-lg w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                  <h3 className="text-lg font-black uppercase mb-4">Add Custom Type</h3>
                  <input
                    ref={customTypeInputRef}
                    type="text"
                    value={customTypeInput}
                    onChange={(e) => setCustomTypeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddCustomType();
                      }
                    }}
                    placeholder="Enter custom type (e.g., Rent, Utilities...)"
                    className="w-full h-12 border-2 border-black bg-white px-4 text-base font-bold focus:outline-none focus:shadow-neo"
                    autoFocus
                  />
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => {
                        if (customTypeInputRef.current) {
                          customTypeInputRef.current.blur();
                        }
                        handleAddCustomType();
                      }}
                      className="flex-1 h-12 bg-neo-green border-2 border-black text-black font-black uppercase shadow-neo-sm active:shadow-none active:translate-y-1"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        if (customTypeInputRef.current) {
                          customTypeInputRef.current.blur();
                        }
                        setShowCustomTypeInput(false);
                        setCustomTypeInput('');
                      }}
                      className="flex-1 h-12 bg-white border-2 border-black text-black font-black uppercase shadow-neo-sm active:shadow-none active:translate-y-1"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Fix: Date picker modal */}
            {showDatePicker && (
              <div 
                className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" 
                onClick={() => {
                  if (dateInputRef.current) {
                    dateInputRef.current.blur();
                  }
                  setShowDatePicker(false);
                }}
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
                    
                    {/* Empty slots for days of previous month */}
                    {Array.from({ length: getFirstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth()) }).map((_, i) => (
                      <div key={`empty-${i}`} className="h-10 w-10" />
                    ))}
                    
                    {/* Actual days */}
                    {Array.from({ length: getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth()) }).map((_, i) => {
                      const day = i + 1;
                      const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
                      const dateStr = formatDate(d);
                      const todayStr = formatDate(new Date());
                      const isToday = dateStr === todayStr;
                      const isSelected = dateStr === date;
                      
                      // Check if future date
                      const now = new Date();
                      now.setHours(23, 59, 59, 999); // End of today
                      const isFuture = d > now;
                      
                      return (
                        <button
                          key={day}
                          disabled={isFuture}
                          onClick={() => handleDateChange(dateStr)}
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
                        handleDateChange(today);
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

            {/* Extra Fields */}
            <div className="flex gap-3">
                <button 
                  onClick={() => {
                    // Fix: Blur any active inputs when clicking date
                    const activeElement = document.activeElement as HTMLElement;
                    if (activeElement) {
                      activeElement.blur();
                    }
                    setShowNumpad(false);
                    const currentSelectedDate = new Date(date);
                    if (!isNaN(currentSelectedDate.getTime())) {
                      setViewDate(currentSelectedDate);
                    }
                    setShowDatePicker(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 h-12 border-2 border-black bg-white text-sm font-bold shadow-neo-sm active:shadow-none active:translate-y-1 hover:bg-gray-50 transition-all"
                >
                    <Calendar size={18} /> {new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </button>
                <button 
                  onClick={() => {
                    // Fix: Blur any active inputs when opening note modal
                    const activeElement = document.activeElement as HTMLElement;
                    if (activeElement) {
                      activeElement.blur();
                    }
                    setShowNumpad(false);
                    setNoteInput(note);
                    setShowNoteInput(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 h-12 border-2 border-black bg-white text-sm font-bold shadow-neo-sm active:shadow-none active:translate-y-1 hover:bg-gray-50 transition-all"
                >
                    <FileText size={18} /> {note ? 'Note added' : 'Note'}
                </button>
                <button className="w-12 flex items-center justify-center border-2 border-black bg-white text-sm font-bold shadow-neo-sm active:shadow-none active:translate-y-1 hover:bg-gray-50 transition-all">
                    <Camera size={18} />
                </button>
            </div>
            
            {/* Fix: Note input modal */}
            {showNoteInput && (
              <div 
                className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" 
                onClick={() => {
                  // Fix: Blur input before closing to hide keyboard
                  if (noteInputRef.current) {
                    noteInputRef.current.blur();
                  }
                  setShowNoteInput(false);
                }}
              >
                <div className="bg-white border-2 border-black shadow-neo-lg p-6 rounded-lg w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                  <h3 className="text-lg font-black uppercase mb-4">Add Note</h3>
                  <input
                    ref={noteInputRef}
                    type="text"
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    onBlur={() => {
                      // Fix: On mobile, blur might be called when clicking outside
                      // Small delay to allow button clicks to register
                      setTimeout(() => {
                        const activeElement = document.activeElement as HTMLElement;
                        if (activeElement && activeElement.tagName !== 'BUTTON') {
                          activeElement.blur();
                        }
                      }, 100);
                    }}
                    placeholder="Enter note..."
                    className="w-full h-12 border-2 border-black bg-white px-4 text-base font-bold focus:outline-none focus:shadow-neo"
                    autoFocus
                  />
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => {
                        // Fix: Blur input before closing
                        if (noteInputRef.current) {
                          noteInputRef.current.blur();
                        }
                        setNote(noteInput);
                        setShowNoteInput(false);
                      }}
                      className="flex-1 h-12 bg-neo-green border-2 border-black text-black font-black uppercase shadow-neo-sm active:shadow-none active:translate-y-1"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        // Fix: Blur input before closing
                        if (noteInputRef.current) {
                          noteInputRef.current.blur();
                        }
                        setShowNoteInput(false);
                      }}
                      className="flex-1 h-12 bg-white border-2 border-black text-black font-black uppercase shadow-neo-sm active:shadow-none active:translate-y-1"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
        </div>

        {/* Numpad */}
        <div className={`shrink-0 bg-white pb-6 px-5 pt-4 border-t-2 border-black transition-all ${showNumpad ? '' : 'pb-4'}`}>
            {showNumpad && (
              <div className="grid grid-cols-3 gap-3 mb-6 max-w-sm mx-auto">
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
            )}
            
            <div className="flex gap-4">
                <button 
                  onClick={() => handleSave(true)}
                  className="flex-1 h-14 border-2 border-black bg-neo-yellow text-black font-black uppercase tracking-wider text-sm flex items-center justify-center shadow-neo-sm hover:translate-y-[-2px] hover:shadow-neo transition-all"
                >
                    Save & Add +
                </button>
                <button 
                    onClick={() => handleSave(false)}
                    className="flex-[1.5] h-14 border-2 border-black bg-neo-green text-black font-black uppercase tracking-wider text-sm flex items-center justify-center shadow-neo hover:translate-y-[-2px] hover:shadow-neo-lg active:shadow-none active:translate-y-[2px] transition-all"
                >
                    Save Transaction
                </button>
            </div>
        </div>
    </div>

    {/* Success Message - Top of screen, non-blocking */}
    {showSuccessToast && (
      <div className="fixed top-24 left-5 right-5 z-[100] flex justify-center pointer-events-none">
        <div className="bg-neo-green border-2 border-black px-6 py-4 shadow-neo flex items-center justify-center gap-3 animate-in slide-in-from-top-4 duration-300 pointer-events-auto">
          <Check size={24} strokeWidth={4} className="text-black" />
          <span className="font-black uppercase text-base tracking-tight">Transaction Saved!</span>
        </div>
      </div>
    )}
  </>
  );
};