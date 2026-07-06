import React, { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { GlobalSearch } from './components/GlobalSearch';
import { AppProvider } from './context/AppContext';
import { SearchProvider } from './context/SearchContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/ToastContext';
import { ToastContainer } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FullPageLoading } from './components/LoadingSpinner';

// Route-level code splitting — each screen is a separate JS chunk loaded on demand.
const Login = lazy(() => import('./screens/Login').then(m => ({ default: m.Login })));
const Home = lazy(() => import('./screens/Home').then(m => ({ default: m.Home })));
const Friends = lazy(() => import('./screens/Friends').then(m => ({ default: m.Friends })));
const FriendDetail = lazy(() => import('./screens/FriendDetail').then(m => ({ default: m.FriendDetail })));
const AddTransaction = lazy(() => import('./screens/AddTransaction').then(m => ({ default: m.AddTransaction })));
const SettleUp = lazy(() => import('./screens/SettleUp').then(m => ({ default: m.SettleUp })));
const History = lazy(() => import('./screens/History').then(m => ({ default: m.History })));
const Profile = lazy(() => import('./screens/Profile').then(m => ({ default: m.Profile })));

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading && !user) {
    return <FullPageLoading />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <ErrorBoundary>{children}</ErrorBoundary>;
};

const AppContent: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-neo-bg dark:bg-zinc-950 transition-colors duration-300">
      <Suspense fallback={<FullPageLoading />}>
        <Routes>
          <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
          <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/friends"
            element={
              <ProtectedRoute>
                <Friends />
              </ProtectedRoute>
            }
          />
          <Route
            path="/friends/:id"
            element={
              <ProtectedRoute>
                <FriendDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/add"
            element={
              <ProtectedRoute>
                <AddTransaction />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settle/:id"
            element={
              <ProtectedRoute>
                <SettleUp />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <History />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
      {user && <GlobalSearch />}
      {user && <BottomNav />}
      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <AuthProvider>
          <AppProvider>
            <SearchProvider>
              <ErrorBoundary>
                <AppContent />
              </ErrorBoundary>
            </SearchProvider>
          </AppProvider>
        </AuthProvider>
      </ToastProvider>
    </HashRouter>
  );
}
