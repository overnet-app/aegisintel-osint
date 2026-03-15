import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ErrorBoundary } from './components/ErrorBoundary';

// Lazy load pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const DeepSearchTracker = lazy(() => import('./pages/DeepSearchTracker'));
const DossierList = lazy(() => import('./pages/DossierList'));
const DossierView = lazy(() => import('./pages/DossierView'));
const Settings = lazy(() => import('./pages/Settings'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const LiveFeed = lazy(() => import('./pages/LiveFeed'));
const GlobalMap = lazy(() => import('./pages/GlobalMap'));
const ReverseLookupPage = lazy(() => import('./pages/ReverseLookupPage'));

const LoadingSpinner = () => (
    <div className="loading-screen">
        <div className="loader"></div>
    </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return (
    <div className="loading-screen">
      <div className="loader"></div>
    </div>
  );

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <>{children}</>;
};

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route path="/*" element={
          <ProtectedRoute>
            <Layout>
              <Suspense fallback={<LoadingSpinner />}>
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/tracker/:sessionId" element={<DeepSearchTracker />} />
                  <Route path="/dossiers" element={<DossierList />} />
                  <Route path="/dossiers/:id" element={<DossierView />} />
                  <Route path="/activity" element={<LiveFeed />} />
                  <Route path="/network" element={<GlobalMap />} />
                  <Route path="/reverse-lookup" element={<ReverseLookupPage />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Suspense>
            </Layout>
          </ProtectedRoute>
        } />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <NotificationProvider>
          <Router>
            <AppRoutes />
          </Router>
        </NotificationProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
