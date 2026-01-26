import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, FileText, Camera } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Transaction, TransactionType } from '../types';
import { NeoButton, NeoModal, NeoInput } from '../components/NeoComponents';
import { FriendSelector } from '../components/AddTransaction/FriendSelector';
import { AmountInput } from '../components/AddTransaction/AmountInput';
import { TypeSelector } from '../components/AddTransaction/TypeSelector';
import { DatePicker } from '../components/AddTransaction/DatePicker';
import { useToast } from '../components/ToastContext';
import { useForm } from '../hooks/useForm';
import { isValidAmount } from '../utils/validation';
import { evaluateExpression } from '../utils/calculator';

export const AddTransaction: React.FC = () => {
  const navigate = useNavigate();
  const { friends, addTransaction } = useAppContext();
  const { success, error: showError } = useToast();

  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showNumpad, setShowNumpad] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [customTypes, setCustomTypes] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('squareone_custom_types');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const stayOnPageRef = useRef(false);

  const {
    values,
    isSubmitting,
    handleChange,
    handleSubmit,
    resetForm,
  } = useForm({
    initialValues: {
      amount: '0',
      direction: 'owe' as 'owe' | 'they-owe',
      selectedFriendId: null as string | null,
      selectedTag: null as TransactionType | null,
      date: new Date().toISOString().split('T')[0],
      note: '',
    },
    validate: (v) => {
      const errors: any = {};
      if (!v.selectedFriendId) errors.selectedFriendId = 'Required';
      if (!isValidAmount(v.amount)) errors.amount = 'Invalid amount';
      if (!v.selectedTag) errors.selectedTag = 'Required';
      return errors;
    },
    onSubmit: async (v) => {
      const amountNum = parseFloat(evaluateExpression(v.amount));
      const selectedDate = new Date(v.date);
      const now = new Date();
      selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

      const transaction: Transaction = {
        id: crypto.randomUUID(),
        title: v.selectedTag as string,
        amount: amountNum,
        date: selectedDate.toISOString(),
        type: v.selectedTag as TransactionType,
        payerId: v.direction === 'owe' ? v.selectedFriendId! : 'me',
        friendId: v.direction === 'owe' ? 'me' : v.selectedFriendId!,
        note: v.note || undefined,
        isSettlement: false,
      };

      const result = await addTransaction(transaction);
      if (result.success) {
        success('Transaction added');
        if (stayOnPageRef.current) {
          resetForm();
        } else {
          navigate('/dashboard');
        }
      } else {
        showError('Failed to add transaction', result.error?.message);
      }
    }
  });

  useEffect(() => {
    localStorage.setItem('squareone_custom_types', JSON.stringify(customTypes));
  }, [customTypes]);

  const handleAddCustomType = (type: string) => {
    if (!customTypes.includes(type)) {
      setCustomTypes(prev => [...prev, type]);
    }
    handleChange('selectedTag', type);
  };

  return (
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

      <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col px-5 pt-4 space-y-6 pb-20">
        {/* Direction Toggle */}
        <div className="flex w-full h-14 rounded-none border-2 border-black bg-white shadow-neo">
          <label className="flex-1 relative cursor-pointer group">
            <input 
              type="radio" 
              name="direction" 
              value="owe" 
              checked={values.direction === 'owe'} 
              onChange={() => handleChange('direction', 'owe')} 
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
              checked={values.direction === 'they-owe'} 
              onChange={() => handleChange('direction', 'they-owe')} 
              className="sr-only peer" 
            />
            <div className="w-full h-full flex items-center justify-center font-bold uppercase transition-all bg-transparent text-gray-400 peer-checked:bg-neo-green peer-checked:text-black hover:bg-gray-100">
              They Owe
            </div>
          </label>
        </div>

        {/* Who */}
        <FriendSelector
          friends={friends}
          selectedFriendId={values.selectedFriendId}
          onSelect={(id) => {
            handleChange('selectedFriendId', id);
            setShowFriendPicker(false);
          }}
          isOpen={showFriendPicker}
          onToggle={() => {
            setShowNumpad(false);
            setShowFriendPicker(!showFriendPicker);
          }}
        />

        {/* Amount */}
        <AmountInput
          amount={values.amount}
          onAmountChange={(val) => handleChange('amount', val)}
          showNumpad={showNumpad}
          onToggleNumpad={() => {
            setShowFriendPicker(false);
            setShowNumpad(!showNumpad);
          }}
        />

        {/* Tags */}
        <TypeSelector
          selectedType={values.selectedTag}
          onSelect={(type) => handleChange('selectedTag', type)}
          customTypes={customTypes}
          onAddCustomType={handleAddCustomType}
        />

        {/* Extra Fields */}
        <div className="flex gap-3">
          <button 
            onClick={() => {
              setShowNumpad(false);
              setShowDatePicker(true);
            }}
            className="flex-1 flex items-center justify-center gap-2 h-12 border-2 border-black bg-white text-sm font-bold shadow-neo-sm active:shadow-none active:translate-y-1 hover:bg-gray-50 transition-all"
          >
            {new Date(values.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </button>
          <button 
            onClick={() => setShowNoteModal(true)}
            className="flex-1 flex items-center justify-center gap-2 h-12 border-2 border-black bg-white text-sm font-bold shadow-neo-sm active:shadow-none active:translate-y-1 hover:bg-gray-50 transition-all"
          >
            {values.note ? 'Note added' : 'Add Note'}
          </button>
          <button className="w-12 flex items-center justify-center border-2 border-black bg-white text-sm font-bold shadow-neo-sm active:shadow-none active:translate-y-1 hover:bg-gray-50 transition-all">
            <Camera size={18} />
          </button>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="shrink-0 bg-white pb-6 px-5 pt-4 border-t-2 border-black">
        <div className="flex gap-4">
          <NeoButton 
            fullWidth 
            onClick={() => {
              stayOnPageRef.current = true;
              handleSubmit();
            }}
            variant="secondary"
            isLoading={isSubmitting && stayOnPageRef.current}
          >
            Save & Add +
          </NeoButton>
          <NeoButton 
            fullWidth 
            onClick={() => {
              stayOnPageRef.current = false;
              handleSubmit();
            }}
            variant="primary"
            isLoading={isSubmitting && !stayOnPageRef.current}
          >
            Save Transaction
          </NeoButton>
        </div>
      </div>

      <DatePicker
        selectedDate={values.date}
        onSelect={(d) => {
          handleChange('date', d);
          setShowDatePicker(false);
        }}
        isOpen={showDatePicker}
        onClose={() => setShowDatePicker(false)}
      />

      <NeoModal
        isOpen={showNoteModal}
        onClose={() => setShowNoteModal(false)}
        title="Add Note"
      >
        <NeoInput
          label="Note"
          placeholder="What was this for?"
          value={values.note}
          onChange={(e) => handleChange('note', e.target.value)}
          autoFocus
        />
        <NeoButton fullWidth onClick={() => setShowNoteModal(false)} variant="primary">Done</NeoButton>
      </NeoModal>
    </div>
  );
};
