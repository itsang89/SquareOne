import React from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { Friend } from '../../types';
import { Avatar } from '../NeoComponents';

interface FriendSelectorProps {
  friends: Friend[];
  selectedFriendId: string | null;
  onSelect: (id: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const FriendSelector: React.FC<FriendSelectorProps> = ({
  friends,
  selectedFriendId,
  onSelect,
  isOpen,
  onToggle,
}) => {
  const selectedFriend = friends.find(f => f.id === selectedFriendId);

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-zinc-500 pl-1">Who?</label>
      <button 
        onClick={onToggle}
        className="flex items-center justify-between w-full h-16 px-4 border-2 border-black bg-neo-orange/20 dark:bg-neo-orange/10 text-left shadow-neo active:shadow-none active:translate-y-[2px] transition-all"
      >
        {selectedFriend ? (
          <div className="flex items-center gap-3">
            <Avatar src={selectedFriend.avatar} alt={selectedFriend.name} size="md" />
            <span className="text-lg font-bold dark:text-zinc-100">{selectedFriend.name}</span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-neo-orange flex items-center justify-center border-2 border-black text-white font-bold text-sm">
              ?
            </div>
            <span className="text-lg font-bold text-gray-400 dark:text-zinc-600">Select friend</span>
          </div>
        )}
        <ChevronDown className="dark:text-zinc-100" />
      </button>
      
      {isOpen && (
        <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-neo-lg mt-2 rounded-lg max-h-64 overflow-y-auto z-30">
          {friends.map(friend => (
            <button
              key={friend.id}
              onClick={() => onSelect(friend.id)}
              className="w-full flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-zinc-800 border-b-2 border-black last:border-b-0 transition-colors"
            >
              <Avatar src={friend.avatar} alt={friend.name} size="md" />
              <span className="text-base font-bold flex-1 text-left dark:text-zinc-100">{friend.name}</span>
              {selectedFriendId === friend.id && <Check size={20} className="text-neo-green" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
