import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { GamepadNavProvider } from './context/GamepadNavContext';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { GamepadBar } from './components/layout/GamepadBar';
import { HomePage } from './pages/HomePage';
import { SoloPage } from './pages/SoloPage';
import { VersusAiPage } from './pages/VersusAiPage';
import { OnlineVersusPage } from './pages/OnlineVersusPage';
import { LeaderboardsPage } from './pages/LeaderboardsPage';
import { StatsPage } from './pages/StatsPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ProfilePage } from './pages/ProfilePage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { AdminPage } from './pages/AdminPage';
import './styles/main.css';

export const AppContent: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [resetToken, setResetToken] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('token');
  });
  const [activeTab, setActiveTab] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('token') || window.location.pathname === '/reset-password') {
      return 'reset-password';
    }
    return 'home';
  });
  const [soloInitialMode, setSoloInitialMode] = useState<string | null>(null);
  const isGameRoute = activeTab === 'solo' || activeTab === 'versus_ai' || activeTab === 'online';

  const handleNavigate = (tab: string) => {
    if (resetToken) {
      setResetToken(null);
      window.history.replaceState({}, '', window.location.pathname.startsWith('/reset-password') ? '/' : window.location.pathname);
    }
    setActiveTab(tab);
  };

  const renderActivePage = () => {
    switch (activeTab) {
      case 'home':
        return <HomePage onSelectMode={(mode) => {
          if (mode === 'versus_ai') setActiveTab('versus_ai');
          else if (mode === 'online') setActiveTab('online');
          else {
            setSoloInitialMode(mode);
            setActiveTab('solo');
          }
        }} />;
      case 'solo':
        return (
          <SoloPage
            initialMode={soloInitialMode}
            onClearInitialMode={() => setSoloInitialMode(null)}
          />
        );
      case 'versus_ai':
        return <VersusAiPage />;
      case 'online':
        return <OnlineVersusPage onNavigate={handleNavigate} />;
      case 'leaderboards':
        return <LeaderboardsPage />;
      case 'stats':
        return <StatsPage />;
      case 'settings':
        return <SettingsPage />;
      case 'login':
        return <LoginPage onNavigate={handleNavigate} />;
      case 'register':
        return <RegisterPage onNavigate={handleNavigate} />;
      case 'profile':
        return <ProfilePage onNavigate={handleNavigate} />;
      case 'reset-password':
        return (
          <ResetPasswordPage
            token={resetToken || ''}
            onNavigate={(tab) => handleNavigate(tab)}
          />
        );
      case 'admin':
        return <AdminPage onNavigate={handleNavigate} />;
      default:
        return <HomePage onSelectMode={() => setActiveTab('solo')} />;
    }
  };

  return (
    <GamepadNavProvider
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      isAuthenticated={isAuthenticated}
    >
      <div className={`app-container${isGameRoute ? ' app-container--game' : ''}`}>
        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className={`main-content${isGameRoute ? ' main-content--game' : ''}`}>
          {renderActivePage()}
        </main>
        <Footer />
        <GamepadBar />
      </div>
    </GamepadNavProvider>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <SettingsProvider>
        <AppContent />
      </SettingsProvider>
    </AuthProvider>
  );
};

export default App;
