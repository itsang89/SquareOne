import React, { useState, useEffect } from 'react';
import { PRESET_AVATARS } from '../../constants';
import { NeoModal, NeoInput, NeoButton } from '../NeoComponents';
import { Friend } from '../../types';

interface EditFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
  friend: Friend;
  onUpdate: (name: string, avatar: string) => Promise<void>;
  isLoading: boolean;
}

export const EditFriendModal: React.FC<EditFriendModalProps> = ({
  isOpen,
  onClose,
  friend,
  onUpdate,
  isLoading,
}) => {
  const [name, setName] = useState(friend.name);
  const [avatar, setAvatar] = useState(friend.avatar);

  useEffect(() => {
    if (isOpen) {
      setName(friend.name);
      setAvatar(friend.avatar);
    }
  }, [isOpen, friend]);

  const handleSave = async () => {
    if (name.trim()) {
      await onUpdate(name.trim(), avatar);
    }
  };

  return (
    <NeoModal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Friend"
    >
      <div className="flex flex-col gap-6">
        <NeoInput
          label="Friend Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isLoading}
        />
        
        <div>
          <label className="block text-sm font-bold uppercase mb-2 tracking-widest">Select Avatar</label>
          <div className="flex flex-wrap gap-2 p-3 bg-gray-50 border-2 border-black">
            {PRESET_AVATARS.map((avatarUrl, idx) => (
              <button
                key={idx}
                onClick={() => setAvatar(avatarUrl)}
                disabled={isLoading}
                className={`w-10 h-10 border-2 transition-all hover:scale-110 active:scale-95 ${
                  avatar === avatarUrl 
                    ? 'border-black bg-neo-yellow shadow-neo-sm scale-110' 
                    : 'border-black/20 opacity-60 hover:opacity-100'
                }`}
              >
                <img src={avatarUrl} alt={`Preset ${idx}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
        
        <NeoButton
          onClick={handleSave}
          fullWidth
          isLoading={isLoading}
          variant="primary"
        >
          Save Changes
        </NeoButton>
      </div>
    </NeoModal>
  );
};
