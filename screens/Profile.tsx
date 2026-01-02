import React, { useState, useEffect } from 'react';
import { Settings, Moon, Sun, Monitor, Download, Trash2, HelpCircle, ArrowRight, Edit3, LogOut } from 'lucide-react';
import { NeoCard, Avatar } from '../components/NeoComponents';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase';
import { useNavigate } from 'react-router-dom';

type Currency = 'HKD' | 'USD' | 'GBP';
type Theme = 'light' | 'dark' | 'system';

export const Profile: React.FC = () => {
  const { transactions, friends } = useAppContext();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [currency, setCurrency] = useState<Currency>(() => {
    const stored = localStorage.getItem('squareone_currency');
    return (stored as Currency) || 'HKD';
  });
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('squareone_theme');
    return (stored as Theme) || 'light';
  });
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileAvatar, setProfileAvatar] = useState(user?.avatar || '');
  const [joinedDate, setJoinedDate] = useState<string>('');

  // Load user profile data
  useEffect(() => {
    if (user) {
      setProfileName(user.name);
      setProfileAvatar(user.avatar);
      
      // Load joined date from profile
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

  // Fix: Apply theme to body
  useEffect(() => {
    const body = document.body;
    body.classList.remove('dark', 'light');
    if (theme === 'dark') {
      body.classList.add('dark');
    } else if (theme === 'light') {
      body.classList.add('light');
    }
    // System theme would require media query listener, simplified for now
  }, [theme]);

  // Fix: Persist currency
  useEffect(() => {
    localStorage.setItem('squareone_currency', currency);
  }, [currency]);

  // Fix: Persist theme
  useEffect(() => {
    localStorage.setItem('squareone_theme', theme);
  }, [theme]);

  const handleExportCSV = () => {
    // Fix: Generate CSV from transactions
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
  };

  const handleUpdateProfile = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: profileName,
          avatar: profileAvatar,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        console.error('Error updating profile:', error);
        alert('Failed to update profile');
      } else {
        setShowEditProfile(false);
        // Profile will be reloaded via AuthContext
        window.location.reload();
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile');
    }
  };

  const handleClearAllData = async () => {
    if (!showClearConfirm) {
      setShowClearConfirm(true);
      return;
    }

    if (!user) return;

    try {
      // Delete all transactions
      const { error: txError } = await supabase
        .from('transactions')
        .delete()
        .eq('user_id', user.id);

      if (txError) {
        console.error('Error deleting transactions:', txError);
        alert('Failed to clear transactions');
        return;
      }

      // Delete all friends
      const { error: friendsError } = await supabase
        .from('friends')
        .delete()
        .eq('user_id', user.id);

      if (friendsError) {
        console.error('Error deleting friends:', friendsError);
        alert('Failed to clear friends');
        return;
      }

      setShowClearConfirm(false);
      window.location.reload();
    } catch (error) {
      console.error('Error clearing data:', error);
      alert('Failed to clear data');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen pb-24 bg-neo-bg font-display">
        <header className="sticky top-0 z-20 bg-neo-bg/95 backdrop-blur-sm p-6 flex items-center justify-between">
             <div className="bg-neo-yellow text-black px-4 py-2 border-2 border-black shadow-neo-sm transform -rotate-1">
                <h1 className="text-xl font-black uppercase tracking-wide">Settings</h1>
            </div>
        </header>

        <main className="p-6 flex flex-col gap-8">
            <NeoCard className="relative">
                {showEditProfile ? (
                    <div className="flex flex-col gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase mb-2">Name</label>
                            <input
                                type="text"
                                value={profileName}
                                onChange={(e) => setProfileName(e.target.value)}
                                className="w-full h-12 bg-gray-50 border-2 border-black px-4 text-lg font-bold focus:outline-none focus:bg-neo-yellow/20 focus:shadow-neo"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase mb-2">Avatar URL</label>
                            <input
                                type="text"
                                value={profileAvatar}
                                onChange={(e) => setProfileAvatar(e.target.value)}
                                placeholder="https://..."
                                className="w-full h-12 bg-gray-50 border-2 border-black px-4 text-lg font-bold focus:outline-none focus:bg-neo-yellow/20 focus:shadow-neo"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleUpdateProfile}
                                className="flex-1 h-12 bg-neo-green border-2 border-black shadow-neo-sm hover:shadow-neo active:shadow-none active:translate-y-[2px] transition-all font-bold uppercase text-sm"
                            >
                                Save
                            </button>
                            <button
                                onClick={() => {
                                    setShowEditProfile(false);
                                    setProfileName(user?.name || '');
                                    setProfileAvatar(user?.avatar || '');
                                }}
                                className="flex-1 h-12 bg-gray-200 border-2 border-black shadow-neo-sm hover:shadow-neo active:shadow-none active:translate-y-[2px] transition-all font-bold uppercase text-sm"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-4">
                            <Avatar src={user?.avatar || ''} alt="Profile" size="lg" className="border-[3px] shadow-sm" />
                            <div className="flex-1 min-w-0">
                                <h2 className="text-2xl font-black uppercase leading-none truncate">{user?.name || 'User'}</h2>
                                <p className="text-sm font-bold text-gray-500 mt-1 uppercase tracking-wider">{user?.email || ''}</p>
                            </div>
                            <button 
                                onClick={() => setShowEditProfile(true)}
                                className="w-10 h-10 bg-neo-orange text-black flex items-center justify-center border-2 border-black shadow-neo-sm hover:shadow-neo active:shadow-none active:translate-y-[2px] transition-all"
                            >
                                <Edit3 size={18} />
                            </button>
                        </div>
                        <div className="mt-4 pt-4 border-t-2 border-black flex justify-between text-[10px] font-bold uppercase tracking-widest text-gray-500">
                            <span>Joined</span>
                            <span>{joinedDate || 'Recently'}</span>
                        </div>
                    </>
                )}
            </NeoCard>

            <section>
                 <h3 className="text-xs font-black uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Settings size={16} /> User Preferences
                </h3>
                <NeoCard className="flex flex-col gap-6">
                    <div>
                        <div className="flex justify-between items-baseline mb-2">
                            <label className="block text-xs font-bold uppercase">Primary Currency</label>
                            <span className="text-[10px] font-bold bg-neo-green px-1 border border-black uppercase text-black">Auto-convert</span>
                        </div>
                        <div className="grid grid-cols-3 gap-0 border-2 border-black bg-gray-100 p-1">
                            <button 
                              onClick={() => setCurrency('HKD')}
                              className={`py-2 border border-black font-bold text-sm transition-colors ${currency === 'HKD' ? 'bg-neo-blue text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'hover:bg-white text-gray-500 hover:text-black'}`}
                            >
                              HKD
                            </button>
                            <button 
                              onClick={() => setCurrency('USD')}
                              className={`py-2 border border-black font-bold text-sm transition-colors ${currency === 'USD' ? 'bg-neo-blue text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'hover:bg-white text-gray-500 hover:text-black'}`}
                            >
                              USD
                            </button>
                            <button 
                              onClick={() => setCurrency('GBP')}
                              className={`py-2 border border-black font-bold text-sm transition-colors ${currency === 'GBP' ? 'bg-neo-blue text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'hover:bg-white text-gray-500 hover:text-black'}`}
                            >
                              GBP
                            </button>
                        </div>
                    </div>

                    <div>
                         <label className="block text-xs font-bold uppercase mb-2">Appearance</label>
                         <div className="grid grid-cols-3 gap-0 border-2 border-black bg-gray-100 p-1">
                            <button 
                              onClick={() => setTheme('dark')}
                              className={`py-2 border border-black font-bold text-sm transition-colors flex items-center justify-center gap-1 ${theme === 'dark' ? 'bg-neo-yellow shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-black' : 'hover:bg-white text-gray-500 hover:text-black'}`}
                            >
                                <Moon size={16} />
                            </button>
                            <button 
                              onClick={() => setTheme('light')}
                              className={`py-2 border border-black font-bold text-sm transition-colors flex items-center justify-center gap-1 ${theme === 'light' ? 'bg-neo-yellow shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-black' : 'hover:bg-white text-gray-500 hover:text-black'}`}
                            >
                                <Sun size={16} />
                            </button>
                            <button 
                              onClick={() => setTheme('system')}
                              className={`py-2 border border-black font-bold text-sm transition-colors flex items-center justify-center gap-1 ${theme === 'system' ? 'bg-neo-yellow shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-black' : 'hover:bg-white text-gray-500 hover:text-black'}`}
                            >
                                <Monitor size={16} />
                            </button>
                        </div>
                    </div>
                </NeoCard>
            </section>

            <section>
                 <h3 className="text-xs font-black uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Download size={16} /> Data Management
                </h3>
                <div className="flex flex-col gap-4">
                    <button 
                      onClick={handleExportCSV}
                      className="w-full bg-white border-2 border-black p-4 shadow-neo-sm flex items-center justify-between group active:shadow-none active:translate-y-[2px] transition-all hover:bg-purple-50"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-neo-purple border-2 border-black flex items-center justify-center text-black">
                                <Download size={16} />
                            </div>
                            <div className="text-left">
                                <span className="block font-bold uppercase text-sm">Export to CSV</span>
                                <span className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider">Transaction history</span>
                            </div>
                        </div>
                        <ArrowRight size={18} className="-rotate-45 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </button>

                     <button 
                       onClick={handleClearAllData}
                       className={`w-full bg-white border-2 border-black p-4 shadow-neo-sm flex items-center justify-between group active:shadow-none active:translate-y-[2px] transition-all ${showClearConfirm ? 'hover:bg-red-100' : 'hover:bg-red-50'}`}
                     >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-neo-red border-2 border-black flex items-center justify-center text-white">
                                <Trash2 size={16} />
                            </div>
                            <div className="text-left">
                                <span className="block font-bold uppercase text-sm text-red-600">
                                  {showClearConfirm ? 'Confirm Clear?' : 'Clear All Data'}
                                </span>
                                <span className="block text-[10px] text-red-400 font-bold uppercase tracking-wider">
                                  {showClearConfirm ? 'Click again to confirm' : 'Cannot be undone'}
                                </span>
                            </div>
                        </div>
                    </button>

                    <button 
                      onClick={handleSignOut}
                      className="w-full bg-white border-2 border-black p-4 shadow-neo-sm flex items-center justify-between group active:shadow-none active:translate-y-[2px] transition-all hover:bg-gray-50"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-neo-blue border-2 border-black flex items-center justify-center text-white">
                                <LogOut size={16} />
                            </div>
                            <div className="text-left">
                                <span className="block font-bold uppercase text-sm">Sign Out</span>
                                <span className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider">Log out of your account</span>
                            </div>
                        </div>
                        <ArrowRight size={18} className="-rotate-45 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
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
                     <div className="w-8 h-8 bg-white border-2 border-black flex items-center justify-center">
                        <ArrowRight size={16} className="text-black font-bold" />
                    </div>
                </div>
            </section>
            
            <div className="text-center mt-4 mb-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">SquareOne v1.0.0</p>
            </div>
        </main>
    </div>
  );
};