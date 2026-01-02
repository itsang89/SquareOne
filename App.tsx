import React from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Login } from './screens/Login';
import { Home } from './screens/Home';
import { Friends } from './screens/Friends';
import { FriendDetail } from './screens/FriendDetail';
import { AddTransaction } from './screens/AddTransaction';
import { SettleUp } from './screens/SettleUp';
import { History } from './screens/History';
import { Profile } from './screens/Profile';
import { BottomNav } from './components/BottomNav';
import { AppProvider } from './context/AppContext';

const AppContent: React.FC = () => {
  return (
    <>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Home />} />
        <Route path="/friends" element={<Friends />} />
        <Route path="/friends/:id" element={<FriendDetail />} />
        <Route path="/add" element={<AddTransaction />} />
        <Route path="/settle/:id" element={<SettleUp />} />
        <Route path="/history" element={<History />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
      <BottomNav />
    </>
  );
};

export default function App() {
  return (
    <HashRouter>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </HashRouter>
  );
}