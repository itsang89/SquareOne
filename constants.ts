import { Friend, Transaction, ExpenseChartData, User } from './types';

export const MOCK_FRIENDS: Friend[] = [
  {
    id: '1',
    name: 'Sarah Jenkins',
    avatar: 'https://picsum.photos/id/338/200/200',
    balance: 124.50,
    lastActivity: 'Yesterday',
    status: 'active'
  },
  {
    id: '2',
    name: 'Mike Ross',
    avatar: 'https://picsum.photos/id/305/200/200',
    balance: -12.50,
    lastActivity: 'Oct 24',
    status: 'active'
  },
  {
    id: '3',
    name: 'Charlie Day',
    avatar: 'https://picsum.photos/id/237/200/200',
    balance: 0,
    lastActivity: 'Oct 20',
    status: 'settled'
  },
  {
    id: '4',
    name: 'David Lee',
    avatar: 'https://picsum.photos/id/1005/200/200',
    balance: 120.00,
    lastActivity: '2 days ago',
    status: 'active'
  }
];

export const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 't1',
    title: 'Pizza Night',
    amount: 45.00,
    date: '2023-10-24T19:30:00',
    type: 'Meal',
    payerId: 'me',
    friendId: '1',
    note: 'Pizza Hut large pepperonis'
  },
  {
    id: 't2',
    title: 'Uber to JFK',
    amount: 24.50,
    date: '2023-10-22T08:15:00',
    type: 'Transport',
    payerId: 'me',
    friendId: '1'
  },
  {
    id: 't3',
    title: 'Taco Bell',
    amount: 12.50,
    date: '2023-10-24T12:00:00',
    type: 'Meal',
    payerId: '2', // Mike paid
    friendId: '2'
  },
  {
    id: 't4',
    title: 'Utilities Share',
    amount: 120.00,
    date: '2023-10-23T09:00:00',
    type: 'Loan',
    payerId: 'me',
    friendId: '4'
  },
   {
    id: 't5',
    title: 'Poker Buy-in',
    amount: 200.00,
    date: '2023-10-21T20:00:00',
    type: 'Poker',
    payerId: 'me',
    friendId: '2'
  }
];

export const TRANSACTION_TAGS = [
  { label: 'Meal', color: 'bg-neo-pink', icon: 'pizza' },
  { label: 'Transport', color: 'bg-neo-yellow', icon: 'car' },
  { label: 'Groceries', color: 'bg-neo-blue', icon: 'shopping-bag' },
  { label: 'Poker', color: 'bg-neo-green', icon: 'club' },
  { label: 'Movies', color: 'bg-neo-purple', icon: 'film' },
];

export const PRESET_AVATARS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Buddy',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Midnight',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Peanut',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Luna',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Oliver',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Sophie',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Jack',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Milo',
];