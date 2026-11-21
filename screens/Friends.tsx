import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, ArrowUpRight, ArrowDownLeft, Check, Search } from 'lucide-react';
import { NeoButton } from '../components/NeoButton';
import { NeoModal } from '../components/NeoModal';
import { NeoInput } from '../components/NeoInput';
import { Avatar } from '../components/Avatar';
import { DataLoadErrorBanner } from '../components/DataLoadErrorBanner';
import { useAppContext } from '../context/AppContext';
import { FriendSkeleton } from '../components/LoadingSkeleton';
import { PRESET_AVATARS } from '../constants';
import { useToast } from '../components/ToastContext';
import { useSearch } from '../context/SearchContext';
import { formatCurrency } from '../utils/formatters';

type FilterType = 'A-Z' | 'High-Low' | 'Recent';

export const Friends: React.FC = () => {
  const { friends, entries, addFriend, loading, error, refetch } = useAppContext();
  const { openSearch } = useSearch();
  const { success, error: showError } = useToast();
  
  const [filter, setFilter] = useState<FilterType>('High-Low');
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [newFriendName, setNewFriendName] = useState('');
  const [newFriendAvatar, setNewFriendAvatar] = useState(PRESET_AVATARS[0]);
  const [isAdding, setIsAdding] = useState(false);

  const filteredFriends = useMemo(() => {
    const sorted = [...friends];
    
    switch (filter) {
      case 'A-Z':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'High-Low':
        sorted.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
        break;
      case 'Recent':
        sorted.sort((a, b) => {
          const latest = (friendId: string) => {
            const e = entries.find((x) => x.friendId === friendId || x.shares.some((sh) => sh.friendId === friendId));
            return e ? new Date(e.occurredAt).getTime() : 0; // entries are newest first
          };
          return latest(b.id) - latest(a.id);
        });
        break;
    }
    
    return sorted;
  }, [friends, entries, filter]);

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
    } catch (error: unknown) {
      showError('Error', error instanceof Error ? error.message : String(error));
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="min-h-screen pb-24 bg-neo-bg dark:bg-zinc-950 flex flex-col transition-colors duration-300">
      <header className="sticky top-0 z-20 bg-neo-bg/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b-2 border-black px-5 pt-6 pb-4">
        <div className="flex items-end justify-between mb-4">
            <h1 className="text-3xl font-black uppercase leading-none dark:text-zinc-100">Friends</h1>
            <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openSearch}
              className="w-12 h-12 bg-white dark:bg-zinc-900 border-2 border-black shadow-neo active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center justify-center hover:bg-gray-100 dark:hover:bg-zinc-800"
              aria-label="Search friends and entries"
            >
                <Search className="text-black dark:text-zinc-100" strokeWidth={2.5} />
            </button>
            <button 
              onClick={() => setShowAddFriend(true)}
              className="w-12 h-12 bg-neo-yellow border-2 border-black shadow-neo active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center justify-center hover:bg-yellow-400"
              aria-label="Add Friend"
            >
                <UserPlus className="text-black" />
            </button>
            </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-3 overflow-x-auto no-scrollbar">
            {(['A-Z', 'High-Low', 'Recent'] as FilterType[]).map((f) => (
                <button 
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-5 py-2 border-2 border-black font-bold text-xs uppercase tracking-wide transition-all whitespace-nowrap ${
                        filter === f 
                        ? 'bg-neo-yellow shadow-neo text-black' 
                        : 'bg-white dark:bg-zinc-900 text-black dark:text-zinc-100'
                    }`}
                >
                    {f === 'High-Low' ? 'Largest Balance' : f}
                </button>
            ))}
        </div>
      </header>

      <DataLoadErrorBanner error={error} loading={loading} onRetry={refetch} />

      <main className="flex-1 p-5 flex flex-col gap-4">
        {loading ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3, 4, 5].map(i => <FriendSkeleton key={i} />)}
          </div>
        ) : error && friends.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 px-4">
            <p className="text-gray-700 dark:text-zinc-300 font-bold uppercase tracking-wider max-w-sm">
              We couldn&apos;t load your friends. Use Retry above or check your connection.
            </p>
          </div>
        ) : filteredFriends.length > 0 ? (
          filteredFriends.map((friend) => (
              <Link
                  key={friend.id}
                  to={`/friends/${friend.id}`}
                  className="group block bg-white dark:bg-zinc-900 border-2 border-black p-4 transition-all hover:-translate-y-1 hover:shadow-neo-lg active:translate-y-0 active:shadow-neo-sm shadow-neo"
              >
                  <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Avatar src={friend.avatar} alt={friend.name} size="md" />
                          <div className="flex flex-col min-w-0">
                              <h3 className="text-lg font-bold leading-tight truncate dark:text-zinc-100">{friend.name}</h3>
                              <span className="text-xs font-medium text-gray-600 dark:text-zinc-400 truncate">{friend.lastActivity}</span>
                          </div>
                      </div>

                      <div className="text-right shrink-0 flex flex-col items-end">
                          <p className={`text-lg font-black tracking-tight tabular-nums ${
                              friend.balance > 0 ? 'text-black dark:text-zinc-100' : friend.balance < 0 ? 'text-neo-danger' : 'text-gray-600 dark:text-zinc-500'
                          }`}>
                              {friend.balance === 0 ? formatCurrency(0) : `${friend.balance > 0 ? '+' : '-'}${formatCurrency(Math.abs(friend.balance))}`}
                          </p>
                          
                          {friend.balance !== 0 ? (
                               <div className={`flex items-center justify-center gap-1 border-2 border-black px-2 py-0.5 shadow-sm mt-1 ${
                                  friend.balance > 0 ? 'bg-neo-orange text-black' : 'bg-neo-red text-white'
                               }`}>
                                  <span className="text-[10px] font-bold uppercase leading-none">{friend.balance > 0 ? 'Owes you' : 'You owe'}</span>
                                  {friend.balance > 0 ? <ArrowDownLeft size={10} strokeWidth={4} /> : <ArrowUpRight size={10} strokeWidth={4}/>}
                              </div>
                          ) : (
                              <div className="flex items-center justify-center gap-1 bg-gray-200 dark:bg-zinc-800 border-2 border-black px-2 py-0.5 mt-1">
                                  <span className="text-[10px] font-bold uppercase leading-none text-gray-600 dark:text-zinc-400">Settled</span>
                                  <Check size={10} strokeWidth={4} className="text-gray-600 dark:text-zinc-400" />
                              </div>
                          )}
                      </div>
                  </div>
              </Link>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="w-20 h-20 bg-neo-yellow/20 dark:bg-neo-yellow/10 border-2 border-black border-dashed flex items-center justify-center">
              <UserPlus size={40} className="text-gray-600 dark:text-zinc-500" />
            </div>
            <p className="text-gray-600 dark:text-zinc-400 font-bold uppercase tracking-wider">No friends yet</p>
            <NeoButton onClick={() => setShowAddFriend(true)} variant="primary">Add your first friend</NeoButton>
          </div>
        )}

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
            <label className="block text-sm font-bold uppercase mb-2 tracking-widest dark:text-zinc-100">Select Avatar</label>
            <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-zinc-800 border-2 border-black">
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
