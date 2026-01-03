import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus, ArrowUpRight, ArrowDownLeft, Check, X } from 'lucide-react';
import { Avatar } from '../components/NeoComponents';
import { useAppContext } from '../context/AppContext';
import { Friend } from '../types';
import { PRESET_AVATARS } from '../constants';

export const Friends: React.FC = () => {
  const navigate = useNavigate();
  const { friends, addFriend } = useAppContext();
  const [filter, setFilter] = useState<'A-Z' | 'High-Low' | 'Recent'>('High-Low');
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [newFriendName, setNewFriendName] = useState('');
  const [newFriendAvatar, setNewFriendAvatar] = useState('');

  // Fix: Implement filter logic
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
        // Sort by lastActivity - convert to comparable format
        sorted.sort((a, b) => {
          const aTime = a.lastActivity === 'Never' ? 0 : 
                       a.lastActivity === 'Today' ? 1 :
                       a.lastActivity === 'Yesterday' ? 2 : 3;
          const bTime = b.lastActivity === 'Never' ? 0 :
                       b.lastActivity === 'Today' ? 1 :
                       b.lastActivity === 'Yesterday' ? 2 : 3;
          return aTime - bTime;
        });
        break;
    }
    
    return sorted;
  }, [friends, filter]);

  const handleAddFriend = async () => {
    if (!newFriendName.trim()) {
      alert('Please enter a name');
      return;
    }
    
    try {
      await addFriend({
        name: newFriendName.trim(),
        avatar: newFriendAvatar.trim() || PRESET_AVATARS[0],
      });
      
      setNewFriendName('');
      setNewFriendAvatar('');
      setShowAddFriend(false);
    } catch (error) {
      console.error('Error adding friend:', error);
      alert('Failed to add friend. Please try again.');
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
            >
                <UserPlus className="text-black" />
            </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-3 overflow-x-auto no-scrollbar">
            {['A-Z', 'High-Low', 'Recent'].map((f) => (
                <button 
                    key={f}
                    onClick={() => setFilter(f as any)}
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
        {filteredFriends.map((friend) => (
            <div 
                key={friend.id}
                onClick={() => navigate(`/friends/${friend.id}`)}
                className={`group relative bg-white border-2 border-black p-4 transition-all cursor-pointer hover:-translate-y-1 hover:shadow-neo-lg active:translate-y-0 active:shadow-neo-sm ${
                    friend.balance > 0 ? 'shadow-neo' : friend.balance < 0 ? 'shadow-neo' : 'shadow-neo'
                }`}
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
                            {friend.balance === 0 ? '$0.00' : `${friend.balance > 0 ? '+' : ''}$${friend.balance.toFixed(2)}`}
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
        ))}

        <div className="mt-8 flex flex-col items-center justify-center gap-4 opacity-40">
            <div className="h-2 w-2 bg-black"></div>
            <p className="text-xs font-mono uppercase text-black">End of list</p>
        </div>
      </main>
      
      {/* Fix: Add friend modal */}
      {showAddFriend && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddFriend(false)}>
          <div className="bg-white border-2 border-black shadow-neo-lg p-6 rounded-lg w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-black uppercase">Add Friend</h3>
              <button onClick={() => setShowAddFriend(false)} className="w-8 h-8 flex items-center justify-center border-2 border-black hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>
            
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-bold uppercase mb-2">Name *</label>
                <input
                  type="text"
                  value={newFriendName}
                  onChange={(e) => setNewFriendName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full h-12 border-2 border-black bg-white px-4 text-base font-bold focus:outline-none focus:shadow-neo"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold uppercase mb-2">Select Avatar</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {PRESET_AVATARS.map((avatarUrl, idx) => (
                    <button
                      key={idx}
                      onClick={() => setNewFriendAvatar(avatarUrl)}
                      className={`w-10 h-10 border-2 transition-all hover:scale-110 active:scale-95 ${
                        newFriendAvatar === avatarUrl ? 'border-neo-yellow shadow-neo-sm scale-110' : 'border-black opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={avatarUrl} alt={`Preset ${idx}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
              
              <button
                onClick={handleAddFriend}
                className="w-full h-12 bg-neo-green border-2 border-black text-black font-black uppercase shadow-neo-sm active:shadow-none active:translate-y-1"
              >
                Add Friend
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};