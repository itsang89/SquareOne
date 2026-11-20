import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Moon, Sun, Monitor, Download, Trash2, HelpCircle, ChevronRight, Edit3, LogOut, KeyRound, Tags, Repeat } from 'lucide-react';
import { NeoButton } from '../components/NeoButton';
import { NeoInput } from '../components/NeoInput';
import { NeoModal } from '../components/NeoModal';
import { NeoCard } from '../components/NeoCard';
import { Avatar } from '../components/Avatar';
import { HowToUseModal } from '../components/HowToUseModal';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase';
import { Link, useNavigate } from 'react-router-dom';
import { PRESET_AVATARS } from '../constants';
import { useToast } from '../components/ToastContext';
import { springs, fadeIn, staggerContainer, staggerItem, bounceIn, moonRotate, sunRotateScale, monitorPulse } from '../utils/animations';
import { useAnimations } from '../hooks/useAnimations';
import { toCsv } from '../utils/csv';
import { applyTheme, getStoredTheme, Theme } from '../utils/theme';

export const Profile: React.FC = () => {
  const { entries, friends, accounts, categories, refetch } = useAppContext();
  const { user, signOut, refreshUser } = useAuth();
  const { success, error: showError } = useToast();
  const navigate = useNavigate();
  const { getVariants, getTransition } = useAnimations();
  
  const [theme, setTheme] = useState<Theme>(getStoredTheme);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showHowToUse, setShowHowToUse] = useState(false);
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
    applyTheme(theme);
  }, [theme]);

  const handleExportCSV = () => {
    try {
      const name = (list: { id: string; name: string }[], id?: string) => list.find((x) => x.id === id)?.name ?? '';
      const headers = ['Date', 'Kind', 'Title', 'Category', 'Account', 'To account', 'Amount', 'Currency', 'FX to HKD', 'Friend', 'Friend shares', 'Note'];
      const rows = entries.map(e => [
        new Date(e.occurredAt).toISOString(),
        e.kind,
        e.title,
        name(categories, e.categoryId),
        name(accounts, e.accountId),
        name(accounts, e.toAccountId),
        e.amount.toFixed(2),
        e.currency,
        String(e.fxRate),
        name(friends, e.friendId),
        e.shares.map(sh => `${name(friends, sh.friendId)}:${sh.amount.toFixed(2)}`).join('; '),
        e.note || '',
      ]);

      const csvContent = toCsv([headers, ...rows]);

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `squareone-entries-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      success('Exported!', 'Your entries have been downloaded.');
    } catch {
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
      
      await refreshUser();
      success('Profile updated');
      setShowEditProfile(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showError('Update failed', message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClearAllData = async () => {
    if (!user) return;

    setIsUpdating(true);
    try {
      // One server transaction: entries, subscriptions, friends and the frozen legacy rows.
      const { error: clearError } = await supabase.rpc('clear_my_data');
      if (clearError) throw clearError;

      await refetch();
      success('Data cleared', 'Entries, subscriptions and friends have been removed.');
      setShowClearConfirm(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showError('Failed to clear data', message);
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
        <header className="sticky top-0 z-20 bg-neo-bg/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b-2 border-black px-5 py-4">
            <h1 className="text-3xl font-black uppercase leading-none dark:text-zinc-100">Settings</h1>
        </header>

        <main className="p-6 flex flex-col gap-8">
            <NeoCard className="relative">
                <AnimatePresence mode="wait">
                  {showEditProfile ? (
                    <motion.div 
                      key="edit-mode"
                      className="flex flex-col gap-4"
                      variants={getVariants(staggerContainer)}
                      initial="hidden"
                      animate="visible"
                      exit={{ opacity: 0, x: -20 }}
                      transition={getTransition(springs.gentle)}
                    >
                        <motion.div variants={getVariants(staggerItem)}>
                          <NeoInput
                              label="Name"
                              value={profileName}
                              onChange={(e) => setProfileName(e.target.value)}
                              disabled={isUpdating}
                          />
                        </motion.div>
                        <motion.div variants={getVariants(staggerItem)}>
                            <label className="block text-xs font-bold uppercase mb-2 tracking-widest dark:text-zinc-100">Select Avatar</label>
                            <motion.div 
                              className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-zinc-800 border-2 border-black"
                              variants={getVariants(staggerContainer)}
                              initial="hidden"
                              animate="visible"
                            >
                                {PRESET_AVATARS.map((avatarUrl, idx) => (
                                    <motion.button
                                        key={idx}
                                        onClick={() => setProfileAvatar(avatarUrl)}
                                        disabled={isUpdating}
                                        className={`w-10 h-10 border-2 ${
                                            profileAvatar === avatarUrl ? 'border-black bg-neo-yellow shadow-neo-sm' : 'border-black/20 opacity-60'
                                        }`}
                                        variants={getVariants(bounceIn)}
                                        whileHover={{ scale: 1.1, opacity: 1 }}
                                        whileTap={{ scale: 0.95 }}
                                        animate={profileAvatar === avatarUrl ? { scale: 1.1 } : { scale: 1 }}
                                        transition={getTransition(springs.bouncy)}
                                    >
                                        <img src={avatarUrl} alt={`Preset ${idx}`} className="w-full h-full object-cover" />
                                        {profileAvatar === avatarUrl && (
                                          <motion.div
                                            className="absolute inset-0 border-2 border-black pointer-events-none"
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={springs.elastic}
                                          />
                                        )}
                                    </motion.button>
                                ))}
                            </motion.div>
                        </motion.div>
                        <motion.div 
                          className="flex gap-3"
                          variants={getVariants(staggerItem)}
                        >
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
                        </motion.div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="view-mode"
                      variants={getVariants(fadeIn)}
                      initial="hidden"
                      animate="visible"
                      exit={{ opacity: 0, x: 20 }}
                      transition={getTransition(springs.gentle)}
                    >
                        <div className="flex items-center gap-4">
                            <Avatar src={user?.avatar || ''} alt="Profile" size="lg" className="border-[3px] shadow-sm" />
                            <div className="flex-1 min-w-0">
                                <h2 className="text-xl font-black leading-tight truncate dark:text-zinc-100">{user?.name || 'User'}</h2>
                                <p className="text-sm font-medium text-gray-600 dark:text-zinc-400 mt-0.5 truncate">{user?.email || ''}</p>
                            </div>
                            <motion.button 
                                onClick={() => setShowEditProfile(true)}
                                className="w-11 h-11 bg-neo-orange text-black flex items-center justify-center border-2 border-black shadow-neo-sm"
                                aria-label="Edit profile"
                                whileHover={{ 
                                  scale: 1.05,
                                  rotate: 15,
                                  boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)',
                                }}
                                whileTap={{ 
                                  scale: 0.95,
                                  rotate: 0,
                                  boxShadow: '0px 0px 0px 0px rgba(0,0,0,1)',
                                  y: 2,
                                }}
                            >
                                <Edit3 size={18} />
                            </motion.button>
                        </div>
                        <div className="mt-4 pt-4 border-t-2 border-black flex justify-between text-[10px] font-bold uppercase tracking-widest text-gray-600 dark:text-zinc-400">
                            <span>Joined</span>
                            <span>{joinedDate || 'Recently'}</span>
                        </div>
                    </motion.div>
                  )}
                </AnimatePresence>
            </NeoCard>

            <section>
                 <h3 className="text-xs font-black uppercase tracking-widest mb-3 flex items-center gap-2 dark:text-zinc-400">
                    <Settings size={16} /> User Preferences
                </h3>
                <NeoCard className="flex flex-col gap-6">
                    <div>
                         <label className="block text-xs font-bold uppercase mb-2 dark:text-zinc-400">Appearance</label>
                         <div className="grid grid-cols-3 gap-0 border-2 border-black bg-gray-100 dark:bg-zinc-800 p-1 relative">
                            <motion.button 
                              onClick={() => setTheme('dark')}
                              className={`py-2 border border-black font-bold text-sm flex items-center justify-center gap-1 relative z-10 ${theme === 'dark' ? 'bg-neo-yellow shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-black' : 'text-gray-600 dark:text-zinc-400'}`}
                              whileHover={theme !== 'dark' ? { 
                                backgroundColor: 'rgba(127,127,127,0.12)',
                              } : {}}
                              whileTap={{ scale: 0.95 }}
                            >
                                <motion.div
                                  variants={moonRotate}
                                  animate={theme === 'dark' ? 'active' : 'inactive'}
                                >
                                  <Moon size={16} />
                                </motion.div>
                                <span>Dark</span>
                            </motion.button>
                            <motion.button 
                              onClick={() => setTheme('light')}
                              className={`py-2 border border-black font-bold text-sm flex items-center justify-center gap-1 relative z-10 ${theme === 'light' ? 'bg-neo-yellow shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-black' : 'text-gray-600 dark:text-zinc-400'}`}
                              whileHover={theme !== 'light' ? { 
                                backgroundColor: 'rgba(127,127,127,0.12)',
                              } : {}}
                              whileTap={{ scale: 0.95 }}
                            >
                                <motion.div
                                  variants={sunRotateScale}
                                  animate={theme === 'light' ? 'active' : 'inactive'}
                                >
                                  <Sun size={16} />
                                </motion.div>
                                <span>Light</span>
                            </motion.button>
                            <motion.button 
                              onClick={() => setTheme('system')}
                              className={`py-2 border border-black font-bold text-sm flex items-center justify-center gap-1 relative z-10 ${theme === 'system' ? 'bg-neo-yellow shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-black' : 'text-gray-600 dark:text-zinc-400'}`}
                              whileHover={theme !== 'system' ? { 
                                backgroundColor: 'rgba(127,127,127,0.12)',
                              } : {}}
                              whileTap={{ scale: 0.95 }}
                            >
                                <motion.div
                                  variants={monitorPulse}
                                  animate={theme === 'system' ? 'active' : 'inactive'}
                                >
                                  <Monitor size={16} />
                                </motion.div>
                                <span>System</span>
                            </motion.button>
                        </div>
                    </div>
                </NeoCard>
            </section>

            {(() => {
              const row = 'w-full min-h-14 px-4 py-3 flex items-center justify-between gap-3 text-left text-black dark:text-zinc-100 hover:bg-gray-50 dark:hover:bg-zinc-800';
              const tile = (bg: string, Icon: typeof Tags) => (
                <span className={`w-8 h-8 shrink-0 ${bg} border-2 border-black grid place-items-center text-black`}><Icon size={16} aria-hidden="true" /></span>
              );
              const body = (label: string, hint?: string, danger = false) => (
                <span className="min-w-0">
                  <span className={`block font-bold ${danger ? 'text-neo-danger' : ''}`}>{label}</span>
                  {hint && <span className={`block text-xs font-medium ${danger ? 'text-neo-danger' : 'text-gray-600 dark:text-zinc-400'}`}>{hint}</span>}
                </span>
              );
              const group = 'bg-white dark:bg-zinc-900 border-2 border-black shadow-neo-sm divide-y divide-black/10 dark:divide-white/10';
              const links: { to: string; label: string; hint: string; icon: typeof Tags; bg: string }[] = [
                { to: '/settings/categories', label: 'Categories', hint: 'Names, icons and colours', icon: Tags, bg: 'bg-neo-yellow' },
                { to: '/settings/subscriptions', label: 'Subscriptions', hint: 'Recurring bills logged automatically', icon: Repeat, bg: 'bg-neo-yellow' },
                { to: '/profile/agent-access', label: 'Agent access', hint: 'Let Claude log entries for you', icon: KeyRound, bg: 'bg-neo-purple' },
                { to: '/profile/import', label: 'Import from Money+', hint: 'Bring in a CSV export', icon: Download, bg: 'bg-neo-purple' },
              ];
              return (
                <>
                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-widest mb-2 text-gray-600 dark:text-zinc-400">Manage</h3>
                    <div className={group}>
                      {links.map(({ to, label, hint, icon, bg }) => (
                        <Link key={to} to={to} className={row}>
                          <span className="flex items-center gap-3 min-w-0">{tile(bg, icon)}{body(label, hint)}</span>
                          <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-gray-600 dark:text-zinc-400" />
                        </Link>
                      ))}
                      <button type="button" onClick={handleExportCSV} className={row}>
                        <span className="flex items-center gap-3 min-w-0">{tile('bg-neo-blue', Download)}{body('Export to CSV', 'All entries')}</span>
                      </button>
                      <button type="button" onClick={() => setShowHowToUse(true)} className={row}>
                        <span className="flex items-center gap-3 min-w-0">{tile('bg-neo-pink', HelpCircle)}{body('How to use', 'Quick tour of the app')}</span>
                        <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-gray-600 dark:text-zinc-400" />
                      </button>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-widest mb-2 text-gray-600 dark:text-zinc-400">Account</h3>
                    <div className={group}>
                      <button type="button" onClick={handleSignOut} className={row}>
                        <span className="flex items-center gap-3 min-w-0">{tile('bg-neo-bg dark:bg-zinc-200', LogOut)}{body('Sign out')}</span>
                      </button>
                      <button type="button" onClick={() => setShowClearConfirm(true)} className={row}>
                        <span className="flex items-center gap-3 min-w-0">{tile('bg-neo-red', Trash2)}{body('Clear all data', 'Deletes every entry and friend. Cannot be undone.', true)}</span>
                      </button>
                    </div>
                  </section>
                </>
              );
            })()}

            <div className="text-center mt-4 mb-4">
                <p className="text-[10px] font-bold text-gray-600 dark:text-zinc-500 uppercase tracking-widest">SquareOne v1.0.0</p>
            </div>
        </main>

        <NeoModal
          isOpen={showClearConfirm}
          onClose={() => setShowClearConfirm(false)}
          title="Clear All Data?"
        >
          <p className="font-bold text-gray-600 mb-6 uppercase text-sm tracking-tight">
            This will permanently delete ALL your entries and friends. This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <NeoButton fullWidth onClick={() => setShowClearConfirm(false)} variant="neutral">Cancel</NeoButton>
            <NeoButton fullWidth onClick={handleClearAllData} variant="accent" isLoading={isUpdating}>Yes, Clear All</NeoButton>
          </div>
        </NeoModal>

        <HowToUseModal 
          isOpen={showHowToUse} 
          onClose={() => setShowHowToUse(false)} 
        />
    </div>
  );
};
