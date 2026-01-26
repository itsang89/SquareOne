import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { TRANSACTION_TAGS } from '../../constants';
import { TransactionType } from '../../types';
import { NeoModal } from '../NeoModal';
import { NeoInput, NeoButton } from '../NeoComponents';

interface TypeSelectorProps {
  selectedType: TransactionType | null;
  onSelect: (type: TransactionType) => void;
  customTypes: string[];
  onAddCustomType: (type: string) => void;
}

export const TypeSelector: React.FC<TypeSelectorProps> = ({
  selectedType,
  onSelect,
  customTypes,
  onAddCustomType,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [newType, setNewType] = useState('');

  const handleAdd = () => {
    if (newType.trim()) {
      onAddCustomType(newType.trim());
      setNewType('');
      setShowModal(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-bold uppercase tracking-widest text-gray-500 pl-1">For What?</label>
      <div className="flex gap-3 overflow-x-auto pb-2 pt-2 pl-1 no-scrollbar">
        {TRANSACTION_TAGS.map(tag => {
          const isSelected = selectedType === tag.label;
          return (
            <button 
              key={tag.label}
              onClick={() => onSelect(tag.label as TransactionType)}
              className={`shrink-0 px-4 py-2 border-2 border-black ${tag.color} text-black font-bold text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-transform ${isSelected ? 'ring-4 ring-neo-yellow ring-offset-2' : ''}`}
            >
              {tag.label}
            </button>
          );
        })}
        {customTypes.map(type => {
          const isSelected = selectedType === type;
          return (
            <button
              key={type}
              onClick={() => onSelect(type as TransactionType)}
              className={`shrink-0 px-4 py-2 border-2 border-black bg-neo-orange text-black font-bold text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-transform ${isSelected ? 'ring-4 ring-neo-yellow ring-offset-2' : ''}`}
            >
              {type}
            </button>
          );
        })}
        <button 
          onClick={() => setShowModal(true)}
          className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full border-2 border-black bg-white hover:bg-gray-100 transition-colors"
          type="button"
        >
          <Plus size={16} />
        </button>
      </div>

      <NeoModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Add Custom Type"
      >
        <NeoInput
          label="Custom Type Name"
          placeholder="e.g. Rent, Gift, etc."
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
          autoFocus
        />
        <div className="flex gap-3 mt-4">
          <NeoButton fullWidth onClick={handleAdd} variant="primary">Add</NeoButton>
          <NeoButton fullWidth onClick={() => setShowModal(false)} variant="neutral">Cancel</NeoButton>
        </div>
      </NeoModal>
    </div>
  );
};
