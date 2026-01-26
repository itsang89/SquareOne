import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, ArrowUpRight, ArrowDownLeft, Check } from 'lucide-react';
import { Avatar, NeoButton, NeoModal, NeoInput } from '../components/NeoComponents';
import { useAppContext } from '../context/AppContext';
import { FriendSkeleton } from '../components/LoadingSkeleton';
import { PRESET_AVATARS } from '../constants';
import { useToast } from '../components/ToastContext';
import { formatCurrency } from '../utils/formatters';

type FilterType = 'A-Z' | 'High-Low' | 'Recent';

export const Friends: React.FC = () => {
  const navigate = useNavigate();
  const { friends, transactions, addFriend, loading } = useAppContext();
  const { success, error: showError } = useToast();
  
  const [filter, setFilter] = useState<FilterType>('High-Low');
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [newFriendName, setNewFriendName] = useState('');
  const [newFriendAvatar, setNewFriendAvatar] = useState(PRESET_AVATARS[0]);
  const [isAdding, setIsAdding] = useState(false);

  const filteredFriends = useMemo(() => {
    let sorted = [...friends];
    
    switch (filter) {
      case 'A-Z':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'High-Low':
        sorted.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
        break;
      case 'Recent':
        sorted.sort((a, b) => {
          const getFriendLatestDate = (friendId: string) => {
            const friendTransactions = transactions.filter(t => 
              t.friendId === friendId || t.payerId === friendId
            );
            if (friendTransactions.length === 0) return 0;
            return Math.max(...friendTransactions.map(t => new Date(t.date).getTime()));
          };
          return getFriendLatestDate(b.id) - getFriendLatestDate(a.id);
        });
        break;
    }
    
    return sorted;
  }, [friends, transactions, filter]);

  const handleAddFriend = async () => {
    if (!newFriendName.trim()) {
      showError('Required field', 'Please enter a friend name.');
      return;
    }
    
    setIsAdding(true);
    try {
      const result = await addFriend({
        name: newFriendName.trim(),
        avatar: newFriendAvatar.trim() || PRESET_AVATARS[0],
      });
      
      if (result.success) {
        success('Friend added', `${newFriendName} is now in your list.`);
        setNewFriendName('');
        setNewFriendAvatar(PRESET_AVATARS[0]);
        setShowAddFriend(false);
      } else {
        showError('Failed to add friend', result.error?.message);
      }
    } catch (error: any) {
      showError('Error', error.message);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="min-h-screen pb-24 bg-neo-bg flex flex-col">
      <header className="sticky top-0 z-20 bg-neo-bg/95 backdrop-blur-sm border-b-2 border-black px-5 pt-6 pb-4">
        <div className="flex items-end justify-between mb-4">
            <div>
                <h2 className="text-xs font-bold tracking-widest text-gray-500 leading-none mb-1">SQUARE ONE</h2>
                <h1 className="text-4xl font-black uppercase leading-none">Friends</h1>
            </div>
            <button 
              onClick={() => setShowAddFriend(true)}
              className="w-12 h-12 bg-neo-yellow border-2 border-black shadow-neo active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center justify-center hover:bg-yellow-400"
              aria-label="Add Friend"
            >
                <UserPlus className="text-black" />
            </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-3 overflow-x-auto no-scrollbar">
            {(['A-Z', 'High-Low', 'Recent'] as FilterType[]).map((f) => (
                <button 
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-5 py-2 border-2 border-black font-bold text-xs uppercase tracking-wide transition-all whitespace-nowrap ${
                        filter === f 
                        ? 'bg-neo-purple shadow-neo text-black' 
                        : 'bg-transparent text-gray-500 border-gray-400 hover:border-black hover:text-black'
                    }`}
                >
                    {f === 'High-Low' ? '$$ High-Low' : f}
                </button>
            ))}
        </div>
      </header>

      <main className="flex-1 p-5 flex flex-col gap-4">
        {loading ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3, 4, 5].map(i => <FriendSkeleton key={i} />)}
          </div>
        ) : filteredFriends.length > 0 ? (
          filteredFriends.map((friend) => (
              <div 
                  key={friend.id}
                  onClick={() => navigate(`/friends/${friend.id}`)}
                  className="group relative bg-white border-2 border-black p-4 transition-all cursor-pointer hover:-translate-y-1 hover:shadow-neo-lg active:translate-y-0 active:shadow-neo-sm shadow-neo"
              >
                  {/* Colored accent line */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 border-r-2 border-black ${
                       friend.balance > 0 ? 'bg-neo-green' : friend.balance < 0 ? 'bg-neo-red' : 'bg-gray-200'
                  }`}></div>

                  <div className="flex items-center justify-between gap-4 pl-3">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                          <Avatar src={friend.avatar} alt={friend.name} size="lg" />
                          <div className="flex flex-col truncate">
                              <h3 className="text-xl font-bold truncate uppercase">{friend.name}</h3>
                              <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">Last: {friend.lastActivity}</span>
                          </div>
                      </div>

                      <div className="text-right shrink-0 flex flex-col items-end">
                          <p className={`text-2xl font-black tracking-tight font-mono ${
                              friend.balance > 0 ? 'text-neo-greenDark' : friend.balance < 0 ? 'text-neo-red' : 'text-gray-400'
                          }`}>
                              {friend.balance === 0 ? '$0.00' : `${friend.balance > 0 ? '+' : '-'}${formatCurrency(Math.abs(friend.balance))}`}
                          </p>
                          
                          {friend.balance !== 0 ? (
                               <div className={`flex items-center justify-center gap-1 border-2 border-black px-2 py-0.5 shadow-sm mt-1 ${
                                  friend.balance > 0 ? 'bg-neo-green text-black' : 'bg-neo-red text-white'
                               }`}>
                                  <span className="text-[10px] font-bold uppercase leading-none">{friend.balance > 0 ? 'Incoming' : 'Outgoing'}</span>
                                  {friend.balance > 0 ? <ArrowDownLeft size={10} strokeWidth={4} /> : <ArrowUpRight size={10} strokeWidth={4}/>}
                              </div>
                          ) : (
                              <div className="flex items-center justify-center gap-1 bg-gray-200 border-2 border-black px-2 py-0.5 mt-1">
                                  <span className="text-[10px] font-bold uppercase leading-none text-gray-600">Settled</span>
                                  <Check size={10} strokeWidth={4} className="text-gray-600" />
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="w-20 h-20 bg-neo-yellow/20 border-2 border-black border-dashed flex items-center justify-center">
              <UserPlus size={40} className="text-gray-400" />
            </div>
            <p className="text-gray-500 font-bold uppercase tracking-wider">No friends yet</p>
            <NeoButton onClick={() => setShowAddFriend(true)} variant="primary">Add your first friend</NeoButton>
          </div>
        )}

        <div className="mt-8 flex flex-col items-center justify-center gap-4 opacity-40">
            <div className="h-2 w-2 bg-black"></div>
            <p className="text-xs font-mono uppercase text-black">End of list</p>
        </div>
      </main>
      
      <NeoModal
        isOpen={showAddFriend}
        onClose={() => setShowAddFriend(false)}
        title="Add Friend"
      >
        <div className="flex flex-col gap-6">
          <NeoInput
            label="Friend Name"
            placeholder="John Doe"
            value={newFriendName}
            onChange={(e) => setNewFriendName(e.target.value)}
            disabled={isAdding}
            autoFocus
          />
          
          <div>
            <label className="block text-sm font-bold uppercase mb-2 tracking-widest">Select Avatar</label>
            <div className="flex flex-wrap gap-2 p-3 bg-gray-50 border-2 border-black">
              {PRESET_AVATARS.map((avatarUrl, idx) => (
                <button
                  key={idx}
                  onClick={() => setNewFriendAvatar(avatarUrl)}
                  disabled={isAdding}
                  className={`w-10 h-10 border-2 transition-all hover:scale-110 active:scale-95 ${
                    newFriendAvatar === avatarUrl 
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
            onClick={handleAddFriend}
            fullWidth
            isLoading={isAdding}
            variant="primary"
          >
            Create Friend
          </NeoButton>
        </div>
      </NeoModal>
    </div>
  );
};
