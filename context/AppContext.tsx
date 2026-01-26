import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Friend, Transaction } from '../types';
import { calculateFriendBalance, getLastActivity } from '../utils/calculations';
import { supabase } from '../utils/supabase';
import { AuthContext } from './AuthContext';

interface AppContextType {
  friends: Friend[];
  transactions: Transaction[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  addTransaction: (transaction: Transaction) => Promise<{ success: boolean; error?: Error }>;
  updateFriend: (friendId: string, updates: Partial<Friend>) => Promise<{ success: boolean; error?: Error }>;
  deleteTransaction: (transactionId: string) => Promise<{ success: boolean; error?: Error }>;
  addFriend: (friend: Omit<Friend, 'id' | 'balance' | 'lastActivity' | 'status'>) => Promise<{ success: boolean; error?: Error }>;
  deleteFriend: (friendId: string) => Promise<{ success: boolean; error?: Error }>;
  getFriendById: (friendId: string) => Friend | undefined;
  isProcessing: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authContext = useContext(AuthContext);
  const user = authContext?.user || null;
  const [friends, setFriends] = useState<Friend[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) {
      setFriends([]);
      setTransactions([]);
      setLoading(false);
      return;
    }

    // Guest users use local storage only, no Supabase queries
    if (user.id === 'guest') {
      console.log('Guest mode: skipping database queries');
      setFriends([]);
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Load friends
      const { data: friendsData, error: friendsError } = await supabase
        .from('friends')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (friendsError) {
        console.warn('Error loading friends (table may not exist):', friendsError.message);
        // Don't throw, just use empty data
      }

      // Load transactions
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (transactionsError) {
        console.warn('Error loading transactions (table may not exist):', transactionsError.message);
        // Don't throw, just use empty data
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

      // Calculate friend balances and status
      const mappedFriends: Friend[] = (friendsData || []).map(f => {
        const balance = calculateFriendBalance(f.id, mappedTransactions);
        const lastActivity = getLastActivity(f.id, mappedTransactions);
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

      setFriends(mappedFriends);
      setTransactions(mappedTransactions);
    } catch (err: any) {
      console.error('Unexpected error loading data:', err);
      // Set empty data instead of throwing
      setFriends([]);
      setTransactions([]);
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
        () => loadData()
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
        () => loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(friendsChannel);
      supabase.removeChannel(transactionsChannel);
    };
  }, [user, loadData]);

  const addTransaction = useCallback(async (transaction: Transaction) => {
    if (!user) return { success: false, error: new Error('User not authenticated') };

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

  const updateFriend = useCallback(async (friendId: string, updates: Partial<Friend>) => {
    if (!user) return { success: false, error: new Error('User not authenticated') };

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
    updateFriend,
    deleteTransaction,
    addFriend,
    deleteFriend,
    getFriendById,
    isProcessing,
  }), [
    friends,
    transactions,
    loading,
    error,
    loadData,
    addTransaction,
    updateFriend,
    deleteTransaction,
    addFriend,
    deleteFriend,
    getFriendById,
    isProcessing,
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
