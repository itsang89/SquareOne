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
const AddEntry = lazy(() => import('./screens/AddEntry').then(m => ({ default: m.AddEntry })));
const Ledger = lazy(() => import('./screens/Ledger').then(m => ({ default: m.Ledger })));
const Wallet = lazy(() => import('./screens/Wallet').then(m => ({ default: m.Wallet })));
const Charts = lazy(() => import('./screens/Charts').then(m => ({ default: m.Charts })));
const Categories = lazy(() => import('./screens/Categories').then(m => ({ default: m.Categories })));
const Subscriptions = lazy(() => import('./screens/Subscriptions').then(m => ({ default: m.Subscriptions })));
const Profile = lazy(() => import('./screens/Profile').then(m => ({ default: m.Profile })));
const AgentAccess = lazy(() => import('./screens/AgentAccess').then(m => ({ default: m.AgentAccess })));
const ImportMoneyPlus = lazy(() => import('./screens/ImportMoneyPlus').then(m => ({ default: m.ImportMoneyPlus })));
const ConnectAgent = lazy(() => import('./screens/ConnectAgent').then(m => ({ default: m.ConnectAgent })));

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
          <Route path="/connect-agent" element={<ErrorBoundary><ConnectAgent /></ErrorBoundary>} />
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
                <AddEntry />
              </ProtectedRoute>
            }
          />
          <Route
            path="/entry/:id"
            element={
              <ProtectedRoute>
                <AddEntry />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ledger"
            element={
              <ProtectedRoute>
                <Ledger />
              </ProtectedRoute>
            }
          />
          <Route
            path="/wallet"
            element={
              <ProtectedRoute>
                <Wallet />
              </ProtectedRoute>
            }
          />
          <Route
            path="/charts"
            element={
              <ProtectedRoute>
                <Charts />
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
          <Route
            path="/settings/categories"
            element={
              <ProtectedRoute>
                <Categories />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/subscriptions"
            element={
              <ProtectedRoute>
                <Subscriptions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/import"
            element={
              <ProtectedRoute>
                <ImportMoneyPlus />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/agent-access"
            element={
              <ProtectedRoute>
                <AgentAccess key={user?.id} />
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
