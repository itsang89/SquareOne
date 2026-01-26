import React from 'react';
import { Edit3, Trash2, MoreVertical } from 'lucide-react';
import { BackButton } from '../NeoComponents';

interface DetailHeaderProps {
  onEdit: () => void;
  onDelete: () => void;
  showOptions: boolean;
  onToggleOptions: () => void;
}

export const DetailHeader: React.FC<DetailHeaderProps> = ({
  onEdit,
  onDelete,
  showOptions,
  onToggleOptions,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-neo-bg/95 backdrop-blur-sm px-5 py-4 flex items-center justify-between border-b-2 border-black">
      <BackButton to="/friends" />
      <h1 className="text-lg font-bold uppercase tracking-widest">Friend Detail</h1>
      <div className="relative">
        <button 
          onClick={onToggleOptions}
          className="w-10 h-10 bg-white border-2 border-black shadow-neo-sm flex items-center justify-center hover:bg-neo-yellow active:shadow-none"
        >
          <MoreVertical size={20} />
        </button>
        
        {showOptions && (
          <div className="absolute right-0 mt-2 w-40 bg-white border-2 border-black shadow-neo z-50">
            <button 
              onClick={onEdit}
              className="w-full text-left px-4 py-3 font-bold uppercase text-sm hover:bg-neo-yellow border-b-2 border-black flex items-center gap-2"
            >
              <Edit3 size={16} /> Edit
            </button>
            <button 
              onClick={onDelete}
              className="w-full text-left px-4 py-3 font-bold uppercase text-sm hover:bg-neo-red hover:text-white flex items-center gap-2"
            >
              <Trash2 size={16} /> Delete
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
