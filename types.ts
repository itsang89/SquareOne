export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

export interface Friend {
  id: string; // UUID
  user_id?: string; // UUID - for database (optional for backward compatibility)
  name: string;
  handle: string;
  avatar: string;
  balance: number; // Positive = they owe you, Negative = you owe them
  lastActivity: string;
  status: 'settled' | 'active';
}

export type TransactionType = 'Meal' | 'Poker' | 'Transport' | 'Loan' | 'Shopping' | 'General' | string;

export interface Transaction {
  id: string; // UUID
  user_id?: string; // UUID - for database (optional for backward compatibility)
  title: string;
  amount: number;
  date: string; // ISO date string
  type: TransactionType;
  payerId: string; // 'me' or friendId
  friendId: string; // UUID - The other person involved (friend ID)
  note?: string;
  isSettlement?: boolean;
}

export interface ExpenseChartData {
  name: string;
  value: number;
  color: string;
}