import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Friend, FriendStatus, Transaction } from '../types';
import { calculateFriendBalance, getLastActivity } from '../utils/calculations';
import { supabase } from '../utils/supabase';
import {
  readGuestSnapshot,
  writeGuestSnapshot,
  type GuestPersistedFriend,
} from '../utils/guestStorage';
import {
  readCustomTypesFromLocal,
  writeCustomTypesToLocal,
} from '../utils/customTypesStorage';
import { AuthContext } from './AuthContext';

function transactionInvolvesFriend(t: Transaction, friendId: string): boolean {
  return (
    (t.payerId === friendId || t.friendId === friendId) &&
    (t.payerId === 'me' || t.friendId === 'me')
  );
}

function buildGuestFriendsList(
  base: GuestPersistedFriend[],
  transactions: Transaction[]
): Friend[] {
  return base.map((f) => {
    const balance = calculateFriendBalance(f.id, transactions);
    const lastActivity = getLastActivity(f.id, transactions);
    const status: FriendStatus = Math.abs(balance) < 0.01 ? 'settled' : 'active';
    return {
      id: f.id,
      name: f.name,
      avatar: f.avatar,
      balance,
      lastActivity,
      status,
    };
  });
}

interface AppContextType {
  friends: Friend[];
  transactions: Transaction[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  addTransaction: (transaction: Transaction) => Promise<{ success: boolean; error?: Error }>;
  updateTransaction: (transaction: Transaction) => Promise<{ success: boolean; error?: Error }>;
  updateFriend: (friendId: string, updates: Partial<Friend>) => Promise<{ success: boolean; error?: Error }>;
  deleteTransaction: (transactionId: string) => Promise<{ success: boolean; error?: Error }>;
  addFriend: (friend: Omit<Friend, 'id' | 'balance' | 'lastActivity' | 'status'>) => Promise<{ success: boolean; error?: Error }>;
  deleteFriend: (friendId: string) => Promise<{ success: boolean; error?: Error }>;
  getFriendById: (friendId: string) => Friend | undefined;
  isProcessing: boolean;
  customTypes: string[];
  addCustomType: (name: string) => Promise<{ success: boolean; error?: Error }>;
  removeCustomType: (name: string) => Promise<{ success: boolean; error?: Error }>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authContext = useContext(AuthContext);
  const user = authContext?.user || null;
  const [friends, setFriends] = useState<Friend[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customTypes, setCustomTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  /** Latest committed transactions for balance math when the transactions query fails but friends load. */
  const transactionsRef = useRef<Transaction[]>([]);
  /** Tracks which user ID has already had its first data load, so background refreshes don't show skeletons. */
  const loadedUserIdRef = useRef<string | null>(null);
  /** Shared debounce timer for all Realtime subscription callbacks. */
  const realtimeRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    transactionsRef.current = transactions;
  }, [transactions]);

  const loadCustomTypes = useCallback(async () => {
    if (!user) {
      setCustomTypes([]);
      return;
    }
    if (user.id === 'guest') {
      setCustomTypes(readCustomTypesFromLocal());
      return;
    }
    const { data, error } = await supabase
      .from('custom_types')
      .select('name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    if (error) {
      console.warn('Error loading custom_types (table may not exist):', error.message);
      return;
    }
    setCustomTypes((data || []).map((r: { name: string }) => r.name));
  }, [user]);

  const loadData = useCallback(async () => {
    if (!user) {
      setFriends([]);
      setTransactions([]);
      setCustomTypes([]);
      setLoading(false);
      loadedUserIdRef.current = null;
      return;
    }

    // Only show the loading skeleton on the first fetch for this user identity.
    // Background refreshes (e.g. auth token refresh on tab focus) silently update.
    const isFirstLoad = loadedUserIdRef.current !== user.id;
    loadedUserIdRef.current = user.id;

    if (user.id === 'guest') {
      if (isFirstLoad) setLoading(true);
      setError(null);
      const snap = readGuestSnapshot();
      const base = snap?.friends ?? [];
      const txs = snap?.transactions ?? [];
      setFriends(buildGuestFriendsList(base, txs));
      setTransactions(txs);
      setCustomTypes(readCustomTypesFromLocal());
      setLoading(false);
      return;
    }

    if (isFirstLoad) setLoading(true);
    setError(null);
    try {
      const [friendsRes, transactionsRes, customTypesRes] = await Promise.all([
        supabase
          .from('friends')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false }),
        supabase
          .from('custom_types')
          .select('name')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true }),
      ]);

      const friendsError = friendsRes.error;
      const friendsData = friendsRes.data;
      const transactionsError = transactionsRes.error;
      const transactionsData = transactionsRes.data;
      const customTypesError = customTypesRes.error;
      const customTypesData = customTypesRes.data;

      if (friendsError) {
        console.warn('Error loading friends:', friendsError.message);
      }

      if (transactionsError) {
        console.warn('Error loading transactions:', transactionsError.message);
      }

      if (customTypesError) {
        console.warn('Error loading custom_types (table may not exist):', customTypesError.message);
      }

      // Surface a recoverable error when core data (friends or transactions) fails
      // so the UI can show a retry prompt rather than silently appearing empty.
      if (friendsError || transactionsError) {
        const msg = [friendsError?.message, transactionsError?.message]
          .filter(Boolean)
          .join('; ');
        setError(new Error(msg));
      } else {
        setError(null);
      }

      const mappedTransactions: Transaction[] = (transactionsData || []).map(t => ({
        id: t.id,
        user_id: t.user_id,
        title: t.title,
        amount: typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount,
        date: t.date,
        type: t.type,
        payerId: t.payer_id === user.id ? 'me' : t.friend_id,
        friendId: t.payer_id === user.id ? t.friend_id : 'me',
        note: t.note || undefined,
        isSettlement: t.is_settlement || false,
      }));

      const txsForBalances = transactionsError
        ? transactionsRef.current
        : mappedTransactions;

      // Calculate friend balances and status
      const mappedFriends: Friend[] = (friendsData || []).map(f => {
        const balance = calculateFriendBalance(f.id, txsForBalances);
        const lastActivity = getLastActivity(f.id, txsForBalances);
        const status = Math.abs(balance) < 0.01 ? 'settled' : 'active';

        return {
          id: f.id,
          user_id: f.user_id,
          name: f.name,
          avatar: f.avatar || '',
          balance,
          lastActivity,
          status,
        };
      });

      // Do not overwrite a successful snapshot with [] when only one query failed.
      if (!friendsError) {
        setFriends(mappedFriends);
      }
      if (!transactionsError) {
        setTransactions(mappedTransactions);
      }
      if (!customTypesError) {
        setCustomTypes((customTypesData || []).map((r: { name: string }) => r.name));
      }
    } catch (err: any) {
      console.error('Unexpected error loading data:', err);
      // Set empty data instead of throwing
      setFriends([]);
      setTransactions([]);
      setCustomTypes([]);
      setError(err instanceof Error ? err : new Error(err.message || 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!user || user.id === 'guest') return;

    const scheduleRealtimeRefresh = () => {
      if (realtimeRefreshTimer.current) clearTimeout(realtimeRefreshTimer.current);
      realtimeRefreshTimer.current = setTimeout(() => void loadData(), 400);
    };

    const friendsChannel = supabase
      .channel('friends-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friends',
          filter: `user_id=eq.${user.id}`,
        },
        scheduleRealtimeRefresh
      )
      .subscribe();

    const transactionsChannel = supabase
      .channel('transactions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${user.id}`,
        },
        scheduleRealtimeRefresh
      )
      .subscribe();

    const customTypesChannel = supabase
      .channel('custom-types-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'custom_types',
          filter: `user_id=eq.${user.id}`,
        },
        scheduleRealtimeRefresh
      )
      .subscribe();

    return () => {
      supabase.removeChannel(friendsChannel);
      supabase.removeChannel(transactionsChannel);
      supabase.removeChannel(customTypesChannel);
    };
  }, [user, loadData, loadCustomTypes]);

  const addCustomType = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        return { success: false, error: new Error('Empty type name') };
      }
      if (!user) {
        return { success: false, error: new Error('User not authenticated') };
      }

      if (user.id === 'guest') {
        setCustomTypes((prev) => {
          if (prev.includes(trimmed)) return prev;
          const next = [...prev, trimmed];
          writeCustomTypesToLocal(next);
          return next;
        });
        return { success: true };
      }

      try {
        const { error } = await supabase.from('custom_types').insert({
          user_id: user.id,
          name: trimmed,
        });
        if (error) {
          if (error.code === '23505') {
            await loadCustomTypes();
            return { success: true };
          }
          throw error;
        }
        await loadCustomTypes();
        return { success: true };
      } catch (err: unknown) {
        console.error('Error adding custom type:', err);
        return {
          success: false,
          error: err instanceof Error ? err : new Error(String(err)),
        };
      }
    },
    [user, loadCustomTypes]
  );

  const removeCustomType = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        return { success: false, error: new Error('Empty type name') };
      }
      if (!user) {
        return { success: false, error: new Error('User not authenticated') };
      }

      if (user.id === 'guest') {
        setCustomTypes((prev) => {
          const next = prev.filter((n) => n !== trimmed);
          writeCustomTypesToLocal(next);
          return next;
        });
        return { success: true };
      }

      try {
        const { error } = await supabase
          .from('custom_types')
          .delete()
          .eq('user_id', user.id)
          .eq('name', trimmed);
        if (error) throw error;
        await loadCustomTypes();
        return { success: true };
      } catch (err: unknown) {
        console.error('Error removing custom type:', err);
        return {
          success: false,
          error: err instanceof Error ? err : new Error(String(err)),
        };
      }
    },
    [user, loadCustomTypes]
  );

  const addTransaction = useCallback(async (transaction: Transaction) => {
    if (!user) return { success: false, error: new Error('User not authenticated') };

    if (user.id === 'guest') {
      setIsProcessing(true);
      try {
        const snap = readGuestSnapshot() ?? { friends: [], transactions: [] };
        const nextTxs = [...snap.transactions, transaction];
        writeGuestSnapshot({ friends: snap.friends, transactions: nextTxs });
        setFriends(buildGuestFriendsList(snap.friends, nextTxs));
        setTransactions(nextTxs);
        return { success: true };
      } finally {
        setIsProcessing(false);
      }
    }

    setIsProcessing(true);
    try {
      const dbTransaction = {
        id: transaction.id,
        user_id: user.id,
        title: transaction.title,
        amount: transaction.amount,
        date: transaction.date,
        type: transaction.type,
        payer_id: transaction.payerId === 'me' ? user.id : (transaction.friendId === 'me' ? transaction.payerId : transaction.payerId),
        friend_id: transaction.friendId === 'me' ? transaction.payerId : transaction.friendId,
        note: transaction.note || null,
        is_settlement: transaction.isSettlement || false,
      };

      const { error } = await supabase
        .from('transactions')
        .upsert(dbTransaction, { onConflict: 'id' });

      if (error) throw error;

      // Optimistic update handled by real-time subscription or manual refresh
      await loadData();
      return { success: true };
    } catch (err: any) {
      console.error('Error adding transaction:', err);
      return { success: false, error: err instanceof Error ? err : new Error(err.message || 'Failed to add transaction') };
    } finally {
      setIsProcessing(false);
    }
  }, [user, loadData]);

  const updateTransaction = useCallback(async (transaction: Transaction) => {
    if (!user) return { success: false, error: new Error('User not authenticated') };

    if (user.id === 'guest') {
      setIsProcessing(true);
      try {
        const snap = readGuestSnapshot();
        if (!snap) {
          return { success: false, error: new Error('No guest data') };
        }
        const idx = snap.transactions.findIndex((t) => t.id === transaction.id);
        if (idx === -1) {
          return { success: false, error: new Error('Transaction not found') };
        }
        const nextTxs = [...snap.transactions];
        nextTxs[idx] = transaction;
        writeGuestSnapshot({ friends: snap.friends, transactions: nextTxs });
        setFriends(buildGuestFriendsList(snap.friends, nextTxs));
        setTransactions(nextTxs);
        return { success: true };
      } finally {
        setIsProcessing(false);
      }
    }

    setIsProcessing(true);
    try {
      const dbTransaction = {
        id: transaction.id,
        user_id: user.id,
        title: transaction.title,
        amount: transaction.amount,
        date: transaction.date,
        type: transaction.type,
        payer_id: transaction.payerId === 'me' ? user.id : (transaction.friendId === 'me' ? transaction.payerId : transaction.payerId),
        friend_id: transaction.friendId === 'me' ? transaction.payerId : transaction.friendId,
        note: transaction.note || null,
        is_settlement: transaction.isSettlement || false,
      };

      const { error } = await supabase
        .from('transactions')
        .upsert(dbTransaction, { onConflict: 'id' });

      if (error) throw error;

      await loadData();
      return { success: true };
    } catch (err: any) {
      console.error('Error updating transaction:', err);
      return { success: false, error: err instanceof Error ? err : new Error(err.message || 'Failed to update transaction') };
    } finally {
      setIsProcessing(false);
    }
  }, [user, loadData]);

  const updateFriend = useCallback(async (friendId: string, updates: Partial<Friend>) => {
    if (!user) return { success: false, error: new Error('User not authenticated') };

    if (user.id === 'guest') {
      setIsProcessing(true);
      try {
        const snap = readGuestSnapshot();
        if (!snap) {
          return { success: false, error: new Error('No guest data') };
        }
        const idx = snap.friends.findIndex((f) => f.id === friendId);
        if (idx === -1) {
          return { success: false, error: new Error('Friend not found') };
        }
        const nextBase = [...snap.friends];
        nextBase[idx] = {
          ...nextBase[idx],
          ...(updates.name !== undefined ? { name: updates.name } : {}),
          ...(updates.avatar !== undefined ? { avatar: updates.avatar } : {}),
        };
        writeGuestSnapshot({ friends: nextBase, transactions: snap.transactions });
        setFriends(buildGuestFriendsList(nextBase, snap.transactions));
        return { success: true };
      } finally {
        setIsProcessing(false);
      }
    }

    setIsProcessing(true);
    try {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;

      const { error } = await supabase
        .from('friends')
        .update(dbUpdates)
        .eq('id', friendId)
        .eq('user_id', user.id);

      if (error) throw error;

      await loadData();
      return { success: true };
    } catch (err: any) {
      console.error('Error updating friend:', err);
      return { success: false, error: err instanceof Error ? err : new Error(err.message || 'Failed to update friend') };
    } finally {
      setIsProcessing(false);
    }
  }, [user, loadData]);

  const deleteTransaction = useCallback(async (transactionId: string) => {
    if (!user) return { success: false, error: new Error('User not authenticated') };

    if (user.id === 'guest') {
      setIsProcessing(true);
      try {
        const snap = readGuestSnapshot();
        if (!snap) {
          return { success: false, error: new Error('No guest data') };
        }
        const nextTxs = snap.transactions.filter((t) => t.id !== transactionId);
        writeGuestSnapshot({ friends: snap.friends, transactions: nextTxs });
        setFriends(buildGuestFriendsList(snap.friends, nextTxs));
        setTransactions(nextTxs);
        return { success: true };
      } finally {
        setIsProcessing(false);
      }
    }

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transactionId)
        .eq('user_id', user.id);

      if (error) throw error;

      await loadData();
      return { success: true };
    } catch (err: any) {
      console.error('Error deleting transaction:', err);
      return { success: false, error: err instanceof Error ? err : new Error(err.message || 'Failed to delete transaction') };
    } finally {
      setIsProcessing(false);
    }
  }, [user, loadData]);

  const addFriend = useCallback(async (friendData: Omit<Friend, 'id' | 'balance' | 'lastActivity' | 'status'>) => {
    if (!user) return { success: false, error: new Error('User not authenticated') };

    if (user.id === 'guest') {
      setIsProcessing(true);
      try {
        const snap = readGuestSnapshot() ?? { friends: [], transactions: [] };
        const newFriend: GuestPersistedFriend = {
          id: crypto.randomUUID(),
          name: friendData.name,
          avatar: friendData.avatar || '',
        };
        const nextFriends = [...snap.friends, newFriend];
        writeGuestSnapshot({ friends: nextFriends, transactions: snap.transactions });
        setFriends(buildGuestFriendsList(nextFriends, snap.transactions));
        setTransactions(snap.transactions);
        return { success: true };
      } finally {
        setIsProcessing(false);
      }
    }

    setIsProcessing(true);
    try {
      const dbFriend = {
        user_id: user.id,
        name: friendData.name,
        avatar: friendData.avatar || null,
      };

      const { error } = await supabase
        .from('friends')
        .insert(dbFriend);

      if (error) throw error;

      await loadData();
      return { success: true };
    } catch (err: any) {
      console.error('Error adding friend:', err);
      return { success: false, error: err instanceof Error ? err : new Error(err.message || 'Failed to add friend') };
    } finally {
      setIsProcessing(false);
    }
  }, [user, loadData]);

  const deleteFriend = useCallback(async (friendId: string) => {
    if (!user) return { success: false, error: new Error('User not authenticated') };

    if (user.id === 'guest') {
      setIsProcessing(true);
      try {
        const snap = readGuestSnapshot();
        if (!snap) {
          return { success: false, error: new Error('No guest data') };
        }
        const nextFriends = snap.friends.filter((f) => f.id !== friendId);
        const nextTxs = snap.transactions.filter((t) => !transactionInvolvesFriend(t, friendId));
        writeGuestSnapshot({ friends: nextFriends, transactions: nextTxs });
        setFriends(buildGuestFriendsList(nextFriends, nextTxs));
        setTransactions(nextTxs);
        return { success: true };
      } finally {
        setIsProcessing(false);
      }
    }

    setIsProcessing(true);
    try {
      // Transactions deleted via DB cascade or manually
      const { error: txError } = await supabase
        .from('transactions')
        .delete()
        .or(`payer_id.eq.${friendId},friend_id.eq.${friendId}`)
        .eq('user_id', user.id);

      if (txError) throw txError;

      const { error } = await supabase
        .from('friends')
        .delete()
        .eq('id', friendId)
        .eq('user_id', user.id);

      if (error) throw error;

      await loadData();
      return { success: true };
    } catch (err: any) {
      console.error('Error deleting friend:', err);
      return { success: false, error: err instanceof Error ? err : new Error(err.message || 'Failed to delete friend') };
    } finally {
      setIsProcessing(false);
    }
  }, [user, loadData]);

  const getFriendById = useCallback((friendId: string): Friend | undefined => {
    return friends.find(f => f.id === friendId);
  }, [friends]);

  const value = useMemo(() => ({
    friends,
    transactions,
    loading,
    error,
    refetch: loadData,
    addTransaction,
    updateTransaction,
    updateFriend,
    deleteTransaction,
    addFriend,
    deleteFriend,
    getFriendById,
    isProcessing,
    customTypes,
    addCustomType,
    removeCustomType,
  }), [
    friends,
    transactions,
    loading,
    error,
    loadData,
    addTransaction,
    updateTransaction,
    updateFriend,
    deleteTransaction,
    addFriend,
    deleteFriend,
    getFriendById,
    isProcessing,
    customTypes,
    addCustomType,
    removeCustomType,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useAppContext(): AppContextType {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
