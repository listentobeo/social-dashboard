import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProfileProvider } from './contexts/ProfileContext';
import { AccountProvider } from './contexts/AccountContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import Overview from './pages/Overview';
import Growth from './pages/Growth';
import Content from './pages/Content';
import Competitors from './pages/Competitors';
import AIInsights from './pages/AIInsights';
import Scripts from './pages/Scripts';
import Settings from './pages/Settings';

function ProtectedRoute({ children }) {
  const { authed } = useAuth();
  return authed ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={
            <ProtectedRoute>
              <ProfileProvider>
              <AccountProvider>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Navigate to="/overview" replace />} />
                    <Route path="/overview" element={<Overview />} />
                    <Route path="/growth" element={<Growth />} />
                    <Route path="/content" element={<Content />} />
                    <Route path="/competitors" element={<Competitors />} />
                    <Route path="/ai" element={<AIInsights />} />
                    <Route path="/scripts" element={<Scripts />} />
                    <Route path="/settings" element={<Settings />} />
                  </Routes>
                </Layout>
              </AccountProvider>
              </ProfileProvider>
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
