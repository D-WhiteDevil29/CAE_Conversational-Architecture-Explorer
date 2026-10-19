import { useState } from 'react';
import { MainLayout } from './components/layout/MainLayout';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AuthPage } from './components/auth/AuthPage';
import { ThemeProvider } from './hooks/useTheme.jsx';
import { ChatProvider } from './contexts/ChatContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { FavoritesProvider } from './contexts/FavoritesContext';
import { ValidationProvider } from './contexts/ValidationContext';
import { ToastContainer } from './components/ui/toast';
import { FavoritesPanel } from './components/favorites/FavoritesPanel';
import { motion } from 'framer-motion';

function AppContent() {
  const { user, isLoading } = useAuth();
  const [currentView, setCurrentView] = useState('chat'); // 'chat' or 'admin'

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-purple-950/10">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="h-12 w-12 border-4 border-purple-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  if (currentView === 'admin') {
    return (
      <FavoritesProvider>
        <AdminDashboard onNavigate={() => setCurrentView('chat')} />
        <FavoritesPanel />
      </FavoritesProvider>
    );
  }

  return (
    <FavoritesProvider>
      <ChatProvider>
        <MainLayout onNavigateToAdmin={() => setCurrentView('admin')} />
        <FavoritesPanel />
      </ChatProvider>
    </FavoritesProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <ValidationProvider>
            <AppContent />
            <ToastContainer />
          </ValidationProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
