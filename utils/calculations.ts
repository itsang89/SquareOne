import { Transaction, Friend, ExpenseChartData } from '../types';

/**
 * Calculate the net balance for a specific friend based on all transactions.
 * Positive = they owe you, Negative = you owe them
 */
export function calculateFriendBalance(friendId: string, transactions: Transaction[]): number {
  return transactions
    .filter(tx => 
      (tx.friendId === friendId && tx.payerId === 'me') || 
      (tx.payerId === friendId && tx.friendId === 'me')
    )
    .reduce((balance, tx) => {
      if (tx.isSettlement) {
        // Fix: Settlements reduce the absolute balance
        // If they owe you (positive balance) and they pay, balance decreases
        // If you owe them (negative balance) and you pay, balance increases (less negative)
        if (tx.payerId === friendId && tx.friendId === 'me') {
          // They paid you, reducing what they owe
          return balance - tx.amount;
        } else if (tx.payerId === 'me' && tx.friendId === friendId) {
          // You paid them, reducing what you owe
          return balance + tx.amount;
        }
        return balance;
      }
      
      if (tx.payerId === 'me' && tx.friendId === friendId) {
        // You paid, so they owe you
        return balance + tx.amount;
      } else if (tx.payerId === friendId && tx.friendId === 'me') {
        // They paid, so you owe them
        return balance - tx.amount;
      }
      
      return balance;
    }, 0);
}

/**
 * Calculate total amount owed to the user (positive balances from all friends)
 */
export function calculateTotalOwed(transactions: Transaction[]): number {
  const friendBalances = new Map<string, number>();
  
  transactions.forEach(tx => {
    if (tx.isSettlement) {
      // Fix: Settlements reduce balances based on who paid
      if (tx.payerId !== 'me' && tx.friendId === 'me') {
        // Friend paid you, reducing what they owe
        const current = friendBalances.get(tx.payerId) || 0;
        friendBalances.set(tx.payerId, current - tx.amount);
      } else if (tx.payerId === 'me' && tx.friendId !== 'me') {
        // You paid friend, reducing what you owe (doesn't affect total owed)
        const current = friendBalances.get(tx.friendId) || 0;
        friendBalances.set(tx.friendId, current + tx.amount);
      }
      return;
    }
    
    if (tx.payerId === 'me' && tx.friendId !== 'me') {
      // You paid, friend owes you
      const current = friendBalances.get(tx.friendId) || 0;
      friendBalances.set(tx.friendId, current + tx.amount);
    } else if (tx.payerId !== 'me' && tx.friendId === 'me') {
      // Friend paid, you owe them
      const current = friendBalances.get(tx.payerId) || 0;
      friendBalances.set(tx.payerId, current - tx.amount);
    }
  });
  
  return Array.from(friendBalances.values())
    .filter(balance => balance > 0)
    .reduce((sum, balance) => sum + balance, 0);
}

/**
 * Calculate total amount the user owes (negative balances from all friends)
 */
export function calculateTotalOwing(transactions: Transaction[]): number {
  const friendBalances = new Map<string, number>();
  
  transactions.forEach(tx => {
    if (tx.isSettlement) {
      // Fix: Settlements reduce balances based on who paid
      if (tx.payerId !== 'me' && tx.friendId === 'me') {
        // Friend paid you, reducing what they owe (doesn't affect total owing)
        const current = friendBalances.get(tx.payerId) || 0;
        friendBalances.set(tx.payerId, current - tx.amount);
      } else if (tx.payerId === 'me' && tx.friendId !== 'me') {
        // You paid friend, reducing what you owe
        const current = friendBalances.get(tx.friendId) || 0;
        friendBalances.set(tx.friendId, current + tx.amount);
      }
      return;
    }
    
    if (tx.payerId === 'me' && tx.friendId !== 'me') {
      // You paid, friend owes you
      const current = friendBalances.get(tx.friendId) || 0;
      friendBalances.set(tx.friendId, current + tx.amount);
    } else if (tx.payerId !== 'me' && tx.friendId === 'me') {
      // Friend paid, you owe them
      const current = friendBalances.get(tx.payerId) || 0;
      friendBalances.set(tx.payerId, current - tx.amount);
    }
  });
  
  return Math.abs(Array.from(friendBalances.values())
    .filter(balance => balance < 0)
    .reduce((sum, balance) => sum + balance, 0));
}

/**
 * Calculate net balance (total owed - total owing)
 */
export function calculateNetBalance(transactions: Transaction[]): number {
  return calculateTotalOwed(transactions) - calculateTotalOwing(transactions);
}

/**
 * Calculate debt origins grouped by transaction type for the chart
 */
export function calculateDebtOrigins(transactions: Transaction[]): ExpenseChartData[] {
  const typeTotals = new Map<string, number>();
  
  // Only count non-settlement transactions
  transactions
    .filter(tx => !tx.isSettlement)
    .forEach(tx => {
      const current = typeTotals.get(tx.type) || 0;
      typeTotals.set(tx.type, current + tx.amount);
    });
  
  const total = Array.from(typeTotals.values()).reduce((sum, val) => sum + val, 0);
  
  if (total === 0) {
    // Return default empty data
    return [
      { name: 'Dining', value: 0, color: '#FF4D4D' },
      { name: 'Rent', value: 0, color: '#C3F53C' },
      { name: 'Travel', value: 0, color: '#FFDE59' },
    ];
  }
  
  // Map transaction types to chart categories
  const typeMap: Record<string, { name: string; color: string }> = {
    'Meal': { name: 'Dining', color: '#FF4D4D' },
    'Poker': { name: 'Dining', color: '#FF4D4D' },
    'Shopping': { name: 'Dining', color: '#FF4D4D' },
    'Loan': { name: 'Rent', color: '#C3F53C' },
    'Transport': { name: 'Travel', color: '#FFDE59' },
    'General': { name: 'Travel', color: '#FFDE59' },
  };
  
  const categoryTotals = new Map<string, { value: number; color: string }>();
  
  typeTotals.forEach((amount, type) => {
    const category = typeMap[type] || { name: 'Travel', color: '#FFDE59' };
    const current = categoryTotals.get(category.name) || { value: 0, color: category.color };
    categoryTotals.set(category.name, {
      value: current.value + amount,
      color: category.color,
    });
  });
  
  // Convert to array and calculate percentages
  return Array.from(categoryTotals.entries())
    .map(([name, data]) => ({
      name,
      value: Math.round((data.value / total) * 100),
      color: data.color,
    }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Get the last activity date for a friend based on their most recent transaction
 */
export function getLastActivity(friendId: string, transactions: Transaction[]): string {
  const friendTransactions = transactions.filter(tx => 
    (tx.friendId === friendId && tx.payerId === 'me') || 
    (tx.payerId === friendId && tx.friendId === 'me')
  );
  
  if (friendTransactions.length === 0) {
    return 'Never';
  }
  
  const mostRecent = friendTransactions
    .map(tx => new Date(tx.date).getTime())
    .sort((a, b) => b - a)[0];
  
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
 * Check if a transaction should be grayed out (friend's balance is zero)
 * This marks transactions as "settled" when the friend's current balance is zero.
 * Once grayed, transactions stay gray even if balance becomes non-zero later.
 * 
 * Logic: If current balance is zero, gray all transactions.
 * If balance is non-zero, check if this transaction existed when balance was last zero.
 * We determine this by checking if the transaction is older than the most recent transaction
 * that made the balance non-zero.
 */
export function shouldGrayTransaction(tx: Transaction, friendId: string, transactions: Transaction[]): boolean {
  // Get all transactions for this friend, sorted by date
  const friendTransactions = transactions.filter(t =>
    (t.friendId === friendId && t.payerId === 'me') ||
    (t.payerId === friendId && t.friendId === 'me')
  ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate current balance
  const currentBalance = calculateFriendBalance(friendId, transactions);
  
  // If balance is currently zero, gray all transactions
  if (Math.abs(currentBalance) < 0.01) {
    return true;
  }

  // If balance is non-zero, we need to find when it last became non-zero
  // We'll check the balance after each transaction chronologically
  // If a transaction existed when balance was zero, it should stay gray
  
  // Find the most recent point where balance was zero
  let lastZeroBalanceIndex = -1;
  let runningBalance = 0;
  
  for (let i = 0; i < friendTransactions.length; i++) {
    const t = friendTransactions[i];
    
    // Calculate balance change for this transaction
    if (t.isSettlement) {
      if (t.payerId === friendId && t.friendId === 'me') {
        runningBalance -= t.amount; // Friend paid you, reduces what they owe
      } else if (t.payerId === 'me' && t.friendId === friendId) {
        runningBalance += t.amount; // You paid friend, reduces what you owe
      }
    } else {
      if (t.payerId === 'me' && t.friendId === friendId) {
        runningBalance += t.amount; // You paid, friend owes you
      } else if (t.payerId === friendId && t.friendId === 'me') {
        runningBalance -= t.amount; // Friend paid, you owe them
      }
    }
    
    // Check if balance is zero after this transaction
    if (Math.abs(runningBalance) < 0.01) {
      lastZeroBalanceIndex = i;
    }
  }
  
  // If we found a point where balance was zero, and this transaction is before or at that point, gray it
  if (lastZeroBalanceIndex >= 0) {
    const txIndex = friendTransactions.findIndex(t => t.id === tx.id);
    if (txIndex >= 0 && txIndex <= lastZeroBalanceIndex) {
      return true;
    }
  }
  
  return false;
}

