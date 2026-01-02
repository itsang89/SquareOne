import { Friend, Transaction, ExpenseChartData, User } from './types';

export const CURRENT_USER: User = {
  id: 'me',
  name: 'Alex',
  email: 'alex@squareone.app',
  avatar: 'https://picsum.photos/id/64/200/200'
};

export const MOCK_FRIENDS: Friend[] = [
  {
    id: '1',
    name: 'Sarah Jenkins',
    handle: '@sarahj',
    avatar: 'https://picsum.photos/id/338/200/200',
    balance: 124.50,
    lastActivity: 'Yesterday',
    status: 'active'
  },
  {
    id: '2',
    name: 'Mike Ross',
    handle: '@mikeross',
    avatar: 'https://picsum.photos/id/305/200/200',
    balance: -12.50,
    lastActivity: 'Oct 24',
    status: 'active'
  },
  {
    id: '3',
    name: 'Charlie Day',
    handle: '@greenman',
    avatar: 'https://picsum.photos/id/237/200/200',
    balance: 0,
    lastActivity: 'Oct 20',
    status: 'settled'
  },
  {
    id: '4',
    name: 'David Lee',
    handle: '@davidl',
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

export const DEBT_ORIGINS_DATA: ExpenseChartData[] = [
  { name: 'Dining', value: 45, color: '#FF4D4D' }, // red
  { name: 'Rent', value: 30, color: '#C3F53C' },  // green
  { name: 'Travel', value: 25, color: '#FFDE59' }, // yellow
];

export const TRANSACTION_TAGS = [
  { label: 'Meal', color: 'bg-neo-pink', icon: 'pizza' },
  { label: 'Transport', color: 'bg-neo-yellow', icon: 'car' },
  { label: 'Groceries', color: 'bg-neo-blue', icon: 'shopping-bag' },
  { label: 'Poker', color: 'bg-neo-green', icon: 'club' },
  { label: 'Movies', color: 'bg-neo-purple', icon: 'film' },
];