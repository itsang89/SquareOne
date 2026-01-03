import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Friend, Transaction } from '../types';
import { calculateFriendBalance, getLastActivity } from '../utils/calculations';
import { supabase } from '../utils/supabase';
import { AuthContext } from './AuthContext';

interface AppContextType {
  friends: Friend[];
  transactions: Transaction[];
  loading: boolean;
  addTransaction: (transaction: Transaction) => Promise<void>;
  updateFriend: (friendId: string, updates: Partial<Friend>) => Promise<void>;
  deleteTransaction: (transactionId: string) => Promise<void>;
  addFriend: (friend: Omit<Friend, 'id' | 'balance' | 'lastActivity' | 'status'>) => Promise<void>;
  deleteFriend: (friendId: string) => Promise<void>;
  getFriendById: (friendId: string) => Friend | undefined;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authContext = useContext(AuthContext);
  const user = authContext?.user || null;
  const session = authContext?.session || null;
  const [friends, setFriends] = useState<Friend[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Load data from Supabase when user is authenticated
  useEffect(() => {
    if (!user || !session) {
      setFriends([]);
      setTransactions([]);
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        // Load friends
        const { data: friendsData, error: friendsError } = await supabase
          .from('friends')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (friendsError) {
          console.error('Error loading friends:', friendsError);
        }

        // Load transactions
        const { data: transactionsData, error: transactionsError } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false });

        if (transactionsError) {
          console.error('Error loading transactions:', transactionsError);
        }

        // Map database format to app format
        const mappedFriends: Friend[] = (friendsData || []).map(f => ({
          id: f.id,
          user_id: f.user_id,
          name: f.name,
          avatar: f.avatar || '',
          balance: 0, // Will be calculated
          lastActivity: 'Never', // Will be calculated
          status: 'active', // Will be calculated
        }));

        const mappedTransactions: Transaction[] = (transactionsData || []).map(t => ({
          id: t.id,
          user_id: t.user_id,
          title: t.title,
          amount: typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount,
          date: t.date,
          type: t.type,
          // If the payer in DB is the current user, app payer is 'me', and friend is the friend_id
          // If the payer in DB is NOT the current user, app payer is the friend_id, and friend is 'me'
          payerId: t.payer_id === user.id ? 'me' : t.friend_id,
          friendId: t.payer_id === user.id ? t.friend_id : 'me',
          note: t.note || undefined,
          isSettlement: t.is_settlement || false,
        }));

        setFriends(mappedFriends);
        setTransactions(mappedTransactions);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Set up real-time subscriptions
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
        () => {
          loadData();
        }
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
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(friendsChannel);
      supabase.removeChannel(transactionsChannel);
    };
  }, [user, session]);

  // Update friend balances whenever transactions change
  useEffect(() => {
    if (loading) return;

    setFriends(prevFriends => {
      return prevFriends.map(friend => {
        const balance = calculateFriendBalance(friend.id, transactions);
        const lastActivity = getLastActivity(friend.id, transactions);
        const status = balance === 0 ? 'settled' : 'active';
        
        return {
          ...friend,
          balance,
          lastActivity,
          status,
        };
      });
    });
  }, [transactions, loading]);

  const addTransaction = useCallback(async (transaction: Transaction) => {
    if (!user) return;

    try {
      const dbTransaction = {
        id: transaction.id,
        user_id: user.id,
        title: transaction.title,
        amount: transaction.amount,
        date: transaction.date,
        type: transaction.type,
        // payer_id can be the user's UUID (if 'me') or the friend's UUID
        payer_id: transaction.payerId === 'me' ? user.id : (transaction.friendId === 'me' ? transaction.payerId : transaction.payerId),
        // friend_id MUST always be the friend's UUID from the friends table
        friend_id: transaction.friendId === 'me' ? transaction.payerId : transaction.friendId,
        note: transaction.note || null,
        is_settlement: transaction.isSettlement || false,
      };

      const { error } = await supabase
        .from('transactions')
        .upsert(dbTransaction, { onConflict: 'id' });

      if (error) {
        console.error('Error saving transaction:', error);
        throw error;
      }

      // Update local state optimistically
      setTransactions(prev => {
        const exists = prev.find(t => t.id === transaction.id);
        if (exists) {
          return prev.map(t => t.id === transaction.id ? transaction : t);
        }
        return [...prev, transaction];
      });
    } catch (error) {
      console.error('Error adding transaction:', error);
      throw error;
    }
  }, [user]);

  const updateFriend = useCallback(async (friendId: string, updates: Partial<Friend>) => {
    if (!user) return;

    try {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;

      const { error } = await supabase
        .from('friends')
        .update(dbUpdates)
        .eq('id', friendId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating friend:', error);
        throw error;
      }

      // Update local state
      setFriends(prev => prev.map(f => f.id === friendId ? { ...f, ...updates } : f));
    } catch (error) {
      console.error('Error updating friend:', error);
      throw error;
    }
  }, [user]);

  const deleteTransaction = useCallback(async (transactionId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transactionId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting transaction:', error);
        throw error;
      }

      // Update local state
      setTransactions(prev => prev.filter(t => t.id !== transactionId));
    } catch (error) {
      console.error('Error deleting transaction:', error);
      throw error;
    }
  }, [user]);

  const addFriend = useCallback(async (friendData: Omit<Friend, 'balance' | 'lastActivity' | 'status'>) => {
    if (!user) return;

    try {
      const dbFriend = {
        user_id: user.id,
        name: friendData.name,
        avatar: friendData.avatar || null,
      };

      const { data, error } = await supabase
        .from('friends')
        .insert(dbFriend)
        .select()
        .single();

      if (error) {
        console.error('Error adding friend:', error);
        throw error;
      }

      // Update local state
      const newFriend: Friend = {
        id: data.id,
        user_id: data.user_id,
        name: data.name,
        avatar: data.avatar || '',
        balance: 0,
        lastActivity: 'Never',
        status: 'active',
      };
      setFriends(prev => [...prev, newFriend]);
    } catch (error) {
      console.error('Error adding friend:', error);
      throw error;
    }
  }, [user]);

  const deleteFriend = useCallback(async (friendId: string) => {
    if (!user) return;

    try {
      // First delete all transactions related to this friend
      const { error: txError } = await supabase
        .from('transactions')
        .delete()
        .or(`payer_id.eq.${friendId},friend_id.eq.${friendId}`)
        .eq('user_id', user.id);

      if (txError) {
        console.error('Error deleting friend transactions:', txError);
        throw txError;
      }

      // Then delete the friend
      const { error } = await supabase
        .from('friends')
        .delete()
        .eq('id', friendId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting friend:', error);
        throw error;
      }

      // Update local state
      setFriends(prev => prev.filter(f => f.id !== friendId));
      setTransactions(prev => prev.filter(t => t.payerId !== friendId && t.friendId !== friendId));
    } catch (error) {
      console.error('Error deleting friend:', error);
      throw error;
    }
  }, [user]);

  const getFriendById = useCallback((friendId: string): Friend | undefined => {
    return friends.find(f => f.id === friendId);
  }, [friends]);

  const value: AppContextType = {
    friends,
    transactions,
    loading,
    addTransaction,
    updateFriend,
    deleteTransaction,
    addFriend,
    deleteFriend,
    getFriendById,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useAppContext(): AppContextType {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}

