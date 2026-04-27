import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, Camera } from 'lucide-react';
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
import { TRANSACTION_TAGS } from '../constants';

const PRESET_TYPE_LABELS = new Set(TRANSACTION_TAGS.map((t) => t.label));

type AddLocationState = { editTransaction?: Transaction } | null | undefined;

interface AddTransactionInnerProps {
  editTransaction?: Transaction;
}

const AddTransactionInner: React.FC<AddTransactionInnerProps> = ({ editTransaction }) => {
  const navigate = useNavigate();
  const { friends, addTransaction, updateTransaction, customTypes, addCustomType } = useAppContext();
  const { success, error: showError } = useToast();
  const isEditMode = Boolean(editTransaction);

  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showNumpad, setShowNumpad] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);

  const stayOnPageRef = useRef(false);

  const effectiveCustomTypes = useMemo(() => {
    const t = editTransaction?.type;
    const base = [...customTypes];
    if (t && !PRESET_TYPE_LABELS.has(t) && !base.includes(t)) {
      return [...base, t];
    }
    return base;
  }, [customTypes, editTransaction?.type]);

  const initialValues = useMemo(
    () =>
      editTransaction
        ? {
            amount: String(editTransaction.amount),
            direction: (editTransaction.payerId === 'me' ? 'they-owe' : 'owe') as 'owe' | 'they-owe',
            selectedFriendId: (editTransaction.payerId === 'me'
              ? editTransaction.friendId
              : editTransaction.payerId) as string | null,
            selectedTag: editTransaction.type,
            date: editTransaction.date.includes('T')
              ? editTransaction.date.split('T')[0]
              : editTransaction.date.slice(0, 10),
            note: editTransaction.note ?? '',
            customTitle: editTransaction.title,
          }
        : {
            amount: '0',
            direction: 'they-owe' as const,
            selectedFriendId: null as string | null,
            selectedTag: null as TransactionType | null,
            date: new Date().toISOString().split('T')[0],
            note: '',
            customTitle: '',
          },
    [editTransaction]
  );

  const {
    values,
    errors,
    isSubmitting,
    handleChange,
    handleSubmit,
    resetForm,
  } = useForm({
    initialValues,
    validate: (v) => {
      const formErrors: Record<string, string> = {};
      if (!v.selectedFriendId) formErrors.selectedFriendId = 'Required';
      if (!isValidAmount(v.amount)) {
        formErrors.amount =
          'Enter a complete amount (unfinished calculations like 5+ are not allowed).';
      }
      if (!v.selectedTag) formErrors.selectedTag = 'Required';
      return formErrors;
    },
    onSubmit: async (v) => {
      const amountNum = parseFloat(evaluateExpression(v.amount));
      const selectedDate = new Date(v.date);
      const now = new Date();
      selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

      const resolvedTitle =
        (v.customTitle as string).trim() || (v.selectedTag as string);

      const baseFields = {
        title: resolvedTitle,
        amount: amountNum,
        date: selectedDate.toISOString(),
        type: v.selectedTag as TransactionType,
        payerId: v.direction === 'owe' ? v.selectedFriendId! : 'me',
        friendId: v.direction === 'owe' ? 'me' : v.selectedFriendId!,
        note: v.note || undefined,
        isSettlement: editTransaction?.isSettlement ?? false,
      };

      if (editTransaction) {
        const transaction: Transaction = {
          ...baseFields,
          id: editTransaction.id,
          ...(editTransaction.user_id !== undefined ? { user_id: editTransaction.user_id } : {}),
        };
        const result = await updateTransaction(transaction);
        if (result.success) {
          success('Transaction updated');
          navigate(-1);
        } else {
          showError('Failed to update transaction', result.error?.message);
        }
        return;
      }

      const transaction: Transaction = {
        ...baseFields,
        id: crypto.randomUUID(),
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
    },
  });

  const handleSubmitRef = useRef(handleSubmit);
  handleSubmitRef.current = handleSubmit;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      e.preventDefault();
      stayOnPageRef.current = false;
      handleSubmitRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleAddCustomType = async (type: string) => {
    const result = await addCustomType(type);
    if (!result.success) {
      showError('Failed to save custom type', result.error?.message);
      return false;
    }
    handleChange('selectedTag', type);
    return true;
  };

  return (
    <div className="fixed inset-0 bg-white dark:bg-zinc-950 z-50 flex flex-col transition-colors duration-300">
      <div className="flex flex-col items-center pt-2 pb-2 shrink-0 border-b-2 border-black">
        <div className="h-1.5 w-12 rounded-full bg-black dark:bg-zinc-100 mb-4"></div>
        <div className="w-full flex items-center justify-between px-5 pb-2">
          <h2 className="text-xl font-black tracking-tight uppercase dark:text-zinc-100">
            {isEditMode ? 'Edit Transaction' : 'New Transaction'}
          </h2>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-10 h-10 rounded-lg border-2 border-black hover:bg-neo-red transition-colors shadow-neo-sm active:shadow-none active:translate-y-1"
          >
            <X className="font-bold text-black dark:text-zinc-100" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col px-5 pt-4 space-y-6 pb-20">
        <div className="flex w-full h-14 rounded-none border-2 border-black bg-white dark:bg-zinc-900 shadow-neo">
          <label className="flex-1 relative cursor-pointer group">
            <input
              type="radio"
              name="direction"
              value="owe"
              checked={values.direction === 'owe'}
              onChange={() => handleChange('direction', 'owe')}
              className="sr-only peer"
            />
            <div className="w-full h-full flex items-center justify-center font-bold uppercase transition-all bg-transparent text-gray-400 dark:text-zinc-500 peer-checked:bg-neo-purple peer-checked:text-black hover:bg-gray-100 dark:hover:bg-zinc-800">
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
            <div className="w-full h-full flex items-center justify-center font-bold uppercase transition-all bg-transparent text-gray-400 dark:text-zinc-500 peer-checked:bg-neo-green peer-checked:text-black hover:bg-gray-100 dark:hover:bg-zinc-800">
              They Owe
            </div>
          </label>
        </div>

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

        <div>
          <AmountInput
            amount={values.amount}
            onAmountChange={(val) => handleChange('amount', val)}
            showNumpad={showNumpad}
            onToggleNumpad={() => {
              setShowFriendPicker(false);
              setShowNumpad(!showNumpad);
            }}
          />
          {errors.amount && (
            <p className="text-sm font-bold text-red-600 dark:text-neo-red mt-2 px-1" role="alert">
              {errors.amount}
            </p>
          )}
        </div>

        <NeoInput
          label="Title"
          placeholder={
            values.selectedTag ? String(values.selectedTag) : 'What was this for?'
          }
          value={values.customTitle as string}
          onChange={(e) => handleChange('customTitle', e.target.value)}
        />

        <TypeSelector
          selectedType={values.selectedTag}
          onSelect={(type) => handleChange('selectedTag', type)}
          customTypes={effectiveCustomTypes}
          onAddCustomType={handleAddCustomType}
        />

        <div className="flex gap-3">
          <button
            onClick={() => {
              setShowNumpad(false);
              setShowDatePicker(true);
            }}
            className="flex-1 flex items-center justify-center gap-2 h-12 border-2 border-black bg-white dark:bg-zinc-900 text-sm font-bold shadow-neo-sm active:shadow-none active:translate-y-1 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all dark:text-zinc-100"
          >
            {new Date(values.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </button>
          <button
            onClick={() => setShowNoteModal(true)}
            className="flex-1 flex items-center justify-center gap-2 h-12 border-2 border-black bg-white dark:bg-zinc-900 text-sm font-bold shadow-neo-sm active:shadow-none active:translate-y-1 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all dark:text-zinc-100"
          >
            {values.note ? 'Note added' : 'Add Note'}
          </button>
          <button className="w-12 flex items-center justify-center border-2 border-black bg-white dark:bg-zinc-900 text-sm font-bold shadow-neo-sm active:shadow-none active:translate-y-1 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all dark:text-zinc-100">
            <Camera size={18} />
          </button>
        </div>
      </div>

      <div className="shrink-0 bg-white dark:bg-zinc-900 pb-6 px-5 pt-4 border-t-2 border-black">
        <div className="flex gap-4">
          {!isEditMode && (
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
          )}
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

      <NeoModal isOpen={showNoteModal} onClose={() => setShowNoteModal(false)} title="Add Note">
        <NeoInput
          label="Note"
          placeholder="What was this for?"
          value={values.note}
          onChange={(e) => handleChange('note', e.target.value)}
          autoFocus
        />
        <NeoButton fullWidth onClick={() => setShowNoteModal(false)} variant="primary">
          Done
        </NeoButton>
      </NeoModal>
    </div>
  );
};

export const AddTransaction: React.FC = () => {
  const location = useLocation();
  const editTransaction = (location.state as AddLocationState)?.editTransaction;

  return (
    <AddTransactionInner key={editTransaction?.id ?? 'new'} editTransaction={editTransaction} />
  );
};
