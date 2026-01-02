import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Friend, Transaction } from '../types';
import { MOCK_FRIENDS, MOCK_TRANSACTIONS } from '../constants';
import { calculateFriendBalance, getLastActivity } from '../utils/calculations';

interface AppContextType {
  friends: Friend[];
  transactions: Transaction[];
  addTransaction: (transaction: Transaction) => void;
  updateFriend: (friendId: string, updates: Partial<Friend>) => void;
  deleteTransaction: (transactionId: string) => void;
  addFriend: (friend: Omit<Friend, 'balance' | 'lastActivity' | 'status'>) => void;
  getFriendById: (friendId: string) => Friend | undefined;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  FRIENDS: 'squareone_friends',
  TRANSACTIONS: 'squareone_transactions',
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load data from localStorage on mount
  useEffect(() => {
    try {
      const storedFriends = localStorage.getItem(STORAGE_KEYS.FRIENDS);
      const storedTransactions = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);

      if (storedFriends && storedTransactions) {
        setFriends(JSON.parse(storedFriends));
        setTransactions(JSON.parse(storedTransactions));
      } else {
        // Initialize with mock data
        setFriends(MOCK_FRIENDS);
        setTransactions(MOCK_TRANSACTIONS);
        // Save initial data
        localStorage.setItem(STORAGE_KEYS.FRIENDS, JSON.stringify(MOCK_FRIENDS));
        localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(MOCK_TRANSACTIONS));
      }
    } catch (error) {
      console.error('Error loading data from localStorage:', error);
      // Fallback to mock data
      setFriends(MOCK_FRIENDS);
      setTransactions(MOCK_TRANSACTIONS);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // Update friend balances whenever transactions change
  useEffect(() => {
    if (!isInitialized) return;

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
  }, [transactions, isInitialized]);

  // Persist friends to localStorage whenever they change
  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(STORAGE_KEYS.FRIENDS, JSON.stringify(friends));
    } catch (error) {
      console.error('Error saving friends to localStorage:', error);
    }
  }, [friends, isInitialized]);

  // Persist transactions to localStorage whenever they change
  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
    } catch (error) {
      console.error('Error saving transactions to localStorage:', error);
    }
  }, [transactions, isInitialized]);

  const addTransaction = useCallback((transaction: Transaction) => {
    setTransactions(prev => {
      // Check if transaction with this ID already exists
      const exists = prev.find(t => t.id === transaction.id);
      if (exists) {
        // Update existing transaction
        return prev.map(t => t.id === transaction.id ? transaction : t);
      }
      // Add new transaction
      return [...prev, transaction];
    });
  }, []);

  const updateFriend = useCallback((friendId: string, updates: Partial<Friend>) => {
    setFriends(prev => prev.map(f => f.id === friendId ? { ...f, ...updates } : f));
  }, []);

  const deleteTransaction = useCallback((transactionId: string) => {
    setTransactions(prev => prev.filter(t => t.id !== transactionId));
  }, []);

  const addFriend = useCallback((friendData: Omit<Friend, 'balance' | 'lastActivity' | 'status'>) => {
    const newFriend: Friend = {
      ...friendData,
      balance: 0,
      lastActivity: 'Never',
      status: 'active',
    };
    setFriends(prev => [...prev, newFriend]);
  }, []);

  const getFriendById = useCallback((friendId: string): Friend | undefined => {
    return friends.find(f => f.id === friendId);
  }, [friends]);

  const value: AppContextType = {
    friends,
    transactions,
    addTransaction,
    updateFriend,
    deleteTransaction,
    addFriend,
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

