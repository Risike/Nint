import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
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
import './styles/main.css';

export const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('home');

  const renderActivePage = () => {
    switch (activeTab) {
      case 'home':
        return <HomePage onSelectMode={(mode) => {
          if (mode === 'versus_ai') setActiveTab('versus_ai');
          else if (mode === 'online') setActiveTab('online');
          else setActiveTab('solo');
        }} />;
      case 'solo':
        return <SoloPage />;
      case 'versus_ai':
        return <VersusAiPage />;
      case 'online':
        return <OnlineVersusPage />;
      case 'leaderboards':
        return <LeaderboardsPage />;
      case 'stats':
        return <StatsPage />;
      case 'settings':
        return <SettingsPage />;
      case 'login':
        return <LoginPage onNavigate={setActiveTab} />;
      case 'register':
        return <RegisterPage onNavigate={setActiveTab} />;
      case 'profile':
        return <ProfilePage onNavigate={setActiveTab} />;
      default:
        return <HomePage onSelectMode={() => setActiveTab('solo')} />;
    }
  };

  return (
    <div className="app-container">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="main-content">
        {renderActivePage()}
      </main>
      <Footer />
    </div>
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
