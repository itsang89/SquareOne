export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

export type FriendStatus = 'settled' | 'active';

export interface Friend {
  id: string; // UUID
  user_id?: string; // UUID
  name: string;
  avatar: string;
  balance: number; // Positive = they owe you, Negative = you owe them
  lastActivity: string;
  status: FriendStatus;
}

export type TransactionType = 
  | 'Meal' 
  | 'Poker' 
  | 'Transport' 
  | 'Loan' 
  | 'Shopping' 
  | 'General' 
  | 'Groceries' 
  | 'Movies' 
  | string;

export interface Transaction {
  id: string; // UUID
  user_id?: string; // UUID
  title: string;
  amount: number;
  date: string; // ISO date string
  type: TransactionType;
  payerId: string; // 'me' or friendId
  friendId: string; // UUID - The other person involved
  note?: string;
  isSettlement?: boolean;
}

export interface ExpenseChartData {
  name: string;
  value: number;
  color: string;
}

export interface AuthResult {
  success: boolean;
  error?: Error;
}

export interface AppActionResult {
  success: boolean;
  error?: Error;
}
