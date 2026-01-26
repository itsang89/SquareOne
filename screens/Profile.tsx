import React, { useState, useEffect } from 'react';
import { Settings, Moon, Sun, Monitor, Download, Trash2, HelpCircle, ArrowRight, Edit3, LogOut } from 'lucide-react';
import { NeoCard, Avatar, NeoButton, NeoInput, NeoModal } from '../components/NeoComponents';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase';
import { useNavigate } from 'react-router-dom';
import { PRESET_AVATARS } from '../constants';
import { useToast } from '../components/ToastContext';

type Theme = 'light' | 'dark' | 'system';

export const Profile: React.FC = () => {
  const { transactions, friends, refetch } = useAppContext();
  const { user, signOut } = useAuth();
  const { success, error: showError } = useToast();
  const navigate = useNavigate();
  
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('squareone_theme');
    return (stored as Theme) || 'light';
  });
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileAvatar, setProfileAvatar] = useState(user?.avatar || '');
  const [joinedDate, setJoinedDate] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileName(user.name);
      setProfileAvatar(user.avatar);
      
      const loadProfile = async () => {
        const { data } = await supabase
          .from('profiles')
          .select('created_at')
          .eq('id', user.id)
          .single();
        
        if (data?.created_at) {
          const date = new Date(data.created_at);
          setJoinedDate(date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
        }
      };
      loadProfile();
    }
  }, [user]);

  useEffect(() => {
    const body = document.body;
    body.classList.remove('dark', 'light');
    
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      body.classList.add(isDark ? 'dark' : 'light');
    } else {
      body.classList.add(theme);
    }
    
    localStorage.setItem('squareone_theme', theme);
  }, [theme]);

  const handleExportCSV = () => {
    try {
      const headers = ['Date', 'Title', 'Type', 'Amount', 'Payer', 'Friend', 'Note', 'Settlement'];
      const rows = transactions.map(tx => {
        const friend = friends.find(f => f.id === tx.friendId || (tx.payerId === f.id && tx.friendId === 'me'));
        const friendName = friend?.name || tx.friendId;
        const payerName = tx.payerId === 'me' ? 'Me' : friendName;
        
        return [
          new Date(tx.date).toLocaleDateString(),
          tx.title,
          tx.type,
          tx.amount.toFixed(2),
          payerName,
          friendName,
          tx.note || '',
          tx.isSettlement ? 'Yes' : 'No',
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `squareone-transactions-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      success('Exported!', 'Your transaction history has been downloaded.');
    } catch (error) {
      showError('Export failed', 'Something went wrong while generating CSV.');
    }
  };

  const handleUpdateProfile = async () => {
    if (!user || !profileName.trim()) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: profileName.trim(),
          avatar: profileAvatar,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;
      
      success('Profile updated');
      setShowEditProfile(false);
      // Wait for AuthContext to pick up changes or we could force refresh user profile if needed
    } catch (error: any) {
      showError('Update failed', error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClearAllData = async () => {
    if (!user) return;

    setIsUpdating(true);
    try {
      const { error: txError } = await supabase
        .from('transactions')
        .delete()
        .eq('user_id', user.id);

      if (txError) throw txError;

      const { error: friendsError } = await supabase
        .from('friends')
        .delete()
        .eq('user_id', user.id);

      if (friendsError) throw friendsError;

      await refetch();
      success('Data cleared', 'All your transactions and friends have been removed.');
      setShowClearConfirm(false);
    } catch (error: any) {
      showError('Failed to clear data', error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen pb-24 bg-neo-bg dark:bg-zinc-950 font-display transition-colors duration-300">
        <header className="sticky top-0 z-20 bg-neo-bg/95 dark:bg-zinc-950/95 backdrop-blur-sm p-6 flex items-center justify-between border-b-2 border-transparent dark:border-black">
             <div className="bg-neo-yellow text-black px-4 py-2 border-2 border-black shadow-neo-sm transform -rotate-1">
                <h1 className="text-xl font-black uppercase tracking-wide">Settings</h1>
            </div>
        </header>

        <main className="p-6 flex flex-col gap-8">
            <NeoCard className="relative">
                {showEditProfile ? (
                    <div className="flex flex-col gap-4">
                        <NeoInput
                            label="Name"
                            value={profileName}
                            onChange={(e) => setProfileName(e.target.value)}
                            disabled={isUpdating}
                        />
                        <div>
                            <label className="block text-xs font-bold uppercase mb-2 tracking-widest dark:text-zinc-100">Select Avatar</label>
                            <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-zinc-800 border-2 border-black">
                                {PRESET_AVATARS.map((avatarUrl, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setProfileAvatar(avatarUrl)}
                                        disabled={isUpdating}
                                        className={`w-10 h-10 border-2 transition-all hover:scale-110 active:scale-95 ${
                                            profileAvatar === avatarUrl ? 'border-black bg-neo-yellow shadow-neo-sm scale-110' : 'border-black/20 opacity-60 hover:opacity-100'
                                        }`}
                                    >
                                        <img src={avatarUrl} alt={`Preset ${idx}`} className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <NeoButton 
                              fullWidth 
                              onClick={handleUpdateProfile} 
                              isLoading={isUpdating}
                              variant="primary"
                            >
                              Save
                            </NeoButton>
                            <NeoButton 
                              fullWidth 
                              onClick={() => setShowEditProfile(false)} 
                              variant="neutral"
                              disabled={isUpdating}
                            >
                              Cancel
                            </NeoButton>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-4">
                            <Avatar src={user?.avatar || ''} alt="Profile" size="lg" className="border-[3px] shadow-sm" />
                            <div className="flex-1 min-w-0">
                                <h2 className="text-2xl font-black uppercase leading-none truncate dark:text-zinc-100">{user?.name || 'User'}</h2>
                                <p className="text-sm font-bold text-gray-500 dark:text-zinc-400 mt-1 uppercase tracking-wider">{user?.email || ''}</p>
                            </div>
                            <button 
                                onClick={() => setShowEditProfile(true)}
                                className="w-10 h-10 bg-neo-orange text-black flex items-center justify-center border-2 border-black shadow-neo-sm hover:shadow-neo active:shadow-none active:translate-y-[2px] transition-all"
                                aria-label="Edit profile"
                            >
                                <Edit3 size={18} />
                            </button>
                        </div>
                        <div className="mt-4 pt-4 border-t-2 border-black flex justify-between text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-zinc-500">
                            <span>Joined</span>
                            <span>{joinedDate || 'Recently'}</span>
                        </div>
                    </>
                )}
            </NeoCard>

            <section>
                 <h3 className="text-xs font-black uppercase tracking-widest mb-3 flex items-center gap-2 dark:text-zinc-400">
                    <Settings size={16} /> User Preferences
                </h3>
                <NeoCard className="flex flex-col gap-6">
                    <div>
                         <label className="block text-xs font-bold uppercase mb-2 dark:text-zinc-400">Appearance</label>
                         <div className="grid grid-cols-3 gap-0 border-2 border-black bg-gray-100 dark:bg-zinc-800 p-1">
                            <button 
                              onClick={() => setTheme('dark')}
                              className={`py-2 border border-black font-bold text-sm transition-colors flex items-center justify-center gap-1 ${theme === 'dark' ? 'bg-neo-yellow shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-black' : 'hover:bg-white dark:hover:bg-zinc-700 text-gray-500 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-100'}`}
                            >
                                <Moon size={16} />
                            </button>
                            <button 
                              onClick={() => setTheme('light')}
                              className={`py-2 border border-black font-bold text-sm transition-colors flex items-center justify-center gap-1 ${theme === 'light' ? 'bg-neo-yellow shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-black' : 'hover:bg-white dark:hover:bg-zinc-700 text-gray-500 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-100'}`}
                            >
                                <Sun size={16} />
                            </button>
                            <button 
                              onClick={() => setTheme('system')}
                              className={`py-2 border border-black font-bold text-sm transition-colors flex items-center justify-center gap-1 ${theme === 'system' ? 'bg-neo-yellow shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-black' : 'hover:bg-white dark:hover:bg-zinc-700 text-gray-500 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-100'}`}
                            >
                                <Monitor size={16} />
                            </button>
                        </div>
                    </div>
                </NeoCard>
            </section>

            <section>
                 <h3 className="text-xs font-black uppercase tracking-widest mb-3 flex items-center gap-2 dark:text-zinc-400">
                    <Download size={16} /> Data Management
                </h3>
                <div className="flex flex-col gap-4">
                    <button 
                      onClick={handleExportCSV}
                      className="w-full bg-white dark:bg-zinc-900 border-2 border-black p-4 shadow-neo-sm flex items-center justify-between group active:shadow-none active:translate-y-[2px] transition-all hover:bg-purple-50 dark:hover:bg-zinc-800"
                    >
                        <div className="flex items-center gap-3 text-black dark:text-zinc-100">
                            <div className="w-8 h-8 bg-neo-purple border-2 border-black flex items-center justify-center text-black">
                                <Download size={16} />
                            </div>
                            <div className="text-left">
                                <span className="block font-bold uppercase text-sm">Export to CSV</span>
                                <span className="block text-[10px] text-gray-500 dark:text-zinc-500 font-bold uppercase tracking-wider">Transaction history</span>
                            </div>
                        </div>
                        <ArrowRight size={18} className="-rotate-45 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform text-black dark:text-zinc-100" />
                    </button>

                     <button 
                       onClick={() => setShowClearConfirm(true)}
                       className="w-full bg-white dark:bg-zinc-900 border-2 border-black p-4 shadow-neo-sm flex items-center justify-between group active:shadow-none active:translate-y-[2px] transition-all hover:bg-red-50 dark:hover:bg-zinc-800"
                     >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-neo-red border-2 border-black flex items-center justify-center text-white">
                                <Trash2 size={16} />
                            </div>
                            <div className="text-left">
                                <span className="block font-bold uppercase text-sm text-red-600">Clear All Data</span>
                                <span className="block text-[10px] text-red-400 font-bold uppercase tracking-wider">Cannot be undone</span>
                            </div>
                        </div>
                    </button>

                    <button 
                      onClick={handleSignOut}
                      className="w-full bg-white dark:bg-zinc-900 border-2 border-black p-4 shadow-neo-sm flex items-center justify-between group active:shadow-none active:translate-y-[2px] transition-all hover:bg-gray-50 dark:hover:bg-zinc-800"
                    >
                        <div className="flex items-center gap-3 text-black dark:text-zinc-100">
                            <div className="w-8 h-8 bg-neo-blue border-2 border-black flex items-center justify-center text-white">
                                <LogOut size={16} />
                            </div>
                            <div className="text-left">
                                <span className="block font-bold uppercase text-sm">Sign Out</span>
                                <span className="block text-[10px] text-gray-500 dark:text-zinc-500 font-bold uppercase tracking-wider">Log out of your account</span>
                            </div>
                        </div>
                        <ArrowRight size={18} className="-rotate-45 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform text-black dark:text-zinc-100" />
                    </button>
                </div>
            </section>

            <section>
                <div className="block bg-neo-pink text-black border-2 border-black p-5 shadow-neo hover:shadow-neo-lg hover:-translate-y-0.5 transition-all flex items-center justify-between group active:translate-y-[2px] active:shadow-none cursor-pointer">
                    <div className="flex items-center gap-4">
                        <HelpCircle size={32} className="animate-pulse" />
                        <div className="flex flex-col">
                            <span className="font-black uppercase text-xl leading-none">How to use</span>
                            <span className="text-xs text-black font-bold tracking-widest mt-1 opacity-75">Master the app</span>
                        </div>
                    </div>
                     <div className="w-8 h-8 bg-white dark:bg-zinc-100 border-2 border-black flex items-center justify-center">
                        <ArrowRight size={16} className="text-black font-bold" />
                    </div>
                </div>
            </section>
            
            <div className="text-center mt-4 mb-4">
                <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-600 uppercase tracking-widest">SquareOne v1.0.0</p>
            </div>
        </main>

        <NeoModal
          isOpen={showClearConfirm}
          onClose={() => setShowClearConfirm(false)}
          title="Clear All Data?"
        >
          <p className="font-bold text-gray-600 mb-6 uppercase text-sm tracking-tight">
            This will permanently delete ALL your transactions and friends. This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <NeoButton fullWidth onClick={() => setShowClearConfirm(false)} variant="neutral">Cancel</NeoButton>
            <NeoButton fullWidth onClick={handleClearAllData} variant="accent" isLoading={isUpdating}>Yes, Clear All</NeoButton>
          </div>
        </NeoModal>
    </div>
  );
};
