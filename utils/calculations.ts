import { Transaction, ExpenseChartData } from '../types';
import { TRANSACTION_COLORS } from '../constants';

/**
 * Shared helper to calculate all friend balances in one pass
 */
export function calculateFriendBalancesMap(transactions: Transaction[]): Map<string, number> {
  const friendBalances = new Map<string, number>();
  
  if (!transactions || !Array.isArray(transactions)) return friendBalances;

  transactions.forEach(tx => {
    if (tx.isSettlement) {
      if (tx.payerId !== 'me' && tx.friendId === 'me') {
        const current = friendBalances.get(tx.payerId) || 0;
        friendBalances.set(tx.payerId, current - tx.amount);
      } else if (tx.payerId === 'me' && tx.friendId !== 'me') {
        const current = friendBalances.get(tx.friendId) || 0;
        friendBalances.set(tx.friendId, current + tx.amount);
      }
      return;
    }
    
    if (tx.payerId === 'me' && tx.friendId !== 'me') {
      const current = friendBalances.get(tx.friendId) || 0;
      friendBalances.set(tx.friendId, current + tx.amount);
    } else if (tx.payerId !== 'me' && tx.friendId === 'me') {
      const current = friendBalances.get(tx.payerId) || 0;
      friendBalances.set(tx.payerId, current - tx.amount);
    }
  });
  
  return friendBalances;
}

/**
 * Calculate the net balance for a specific friend
 */
export function calculateFriendBalance(friendId: string, transactions: Transaction[]): number {
  if (!friendId || !transactions) return 0;
  const balances = calculateFriendBalancesMap(transactions);
  return balances.get(friendId) || 0;
}

/**
 * Calculate total amount owed to the user
 */
export function calculateTotalOwed(transactions: Transaction[]): number {
  const balances = calculateFriendBalancesMap(transactions);
  return Array.from(balances.values())
    .filter(balance => balance > 0)
    .reduce((sum, balance) => sum + balance, 0);
}

/**
 * Calculate total amount the user owes
 */
export function calculateTotalOwing(transactions: Transaction[]): number {
  const balances = calculateFriendBalancesMap(transactions);
  return Math.abs(Array.from(balances.values())
    .filter(balance => balance < 0)
    .reduce((sum, balance) => sum + balance, 0));
}

/**
 * Calculate net balance
 */
export function calculateNetBalance(transactions: Transaction[]): number {
  return calculateTotalOwed(transactions) - calculateTotalOwing(transactions);
}

/**
 * Calculate debt origins for chart
 */
export function calculateDebtOrigins(transactions: Transaction[]): ExpenseChartData[] {
  if (!transactions || transactions.length === 0) return [];

  const typeTotals = new Map<string, number>();
  const activeTransactions = transactions.filter(tx => !tx.isSettlement);
  
  activeTransactions.forEach(tx => {
    const current = typeTotals.get(tx.type) || 0;
    typeTotals.set(tx.type, current + tx.amount);
  });
  
  const total = Array.from(typeTotals.values()).reduce((sum, val) => sum + val, 0);
  if (total === 0) return [];
  
  return Array.from(typeTotals.entries())
    .map(([type, amount]) => ({
      name: type,
      value: Math.round((amount / total) * 100),
      color: TRANSACTION_COLORS[type] || TRANSACTION_COLORS['General'],
    }))
    .filter(item => item.value > 0)
    .sort((a, b) => b.value - a.value);
}

/**
 * Get the last activity date string
 */
export function getLastActivity(friendId: string, transactions: Transaction[]): string {
  if (!friendId || !transactions) return 'Never';

  const friendTransactions = transactions.filter(tx => 
    tx.friendId === friendId || tx.payerId === friendId
  );
  
  if (friendTransactions.length === 0) return 'Never';
  
  const mostRecent = Math.max(...friendTransactions.map(tx => new Date(tx.date).getTime()));
  const date = new Date(mostRecent);
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  }
  
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Check if a transaction should be grayed
 */
export function shouldGrayTransaction(tx: Transaction, friendId: string, transactions: Transaction[]): boolean {
  if (!friendId || !transactions) return false;

  const friendTransactions = transactions
    .filter(t => t.friendId === friendId || t.payerId === friendId)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const currentBalance = calculateFriendBalance(friendId, transactions);
  if (Math.abs(currentBalance) < 0.01) return true;

  let lastZeroBalanceIndex = -1;
  let runningBalance = 0;
  
  for (let i = 0; i < friendTransactions.length; i++) {
    const t = friendTransactions[i];
    
    if (t.isSettlement) {
      if (t.payerId === friendId && t.friendId === 'me') runningBalance -= t.amount;
      else if (t.payerId === 'me' && t.friendId === friendId) runningBalance += t.amount;
    } else {
      if (t.payerId === 'me' && t.friendId === friendId) runningBalance += t.amount;
      else if (t.payerId === friendId && t.friendId === 'me') runningBalance -= t.amount;
    }
    
    if (Math.abs(runningBalance) < 0.01) lastZeroBalanceIndex = i;
  }
  
  if (lastZeroBalanceIndex >= 0) {
    const txIndex = friendTransactions.findIndex(t => t.id === tx.id);
    if (txIndex >= 0 && txIndex <= lastZeroBalanceIndex) return true;
  }
  
  return false;
}
