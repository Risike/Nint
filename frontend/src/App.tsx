import React, { useState } from 'react';
import { Eye, X } from 'lucide-react';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider, useSettings } from './context/SettingsContext';
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
import { PlayerPage } from './pages/PlayerPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ProfilePage } from './pages/ProfilePage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { AdminPage } from './pages/AdminPage';
import { ShopPage } from './pages/ShopPage';
import { useI18n } from './i18n/useI18n';
import { ThemeProvider, useThemeCatalog } from './context/ThemeContext';
import { NameDecorationProvider } from './context/NameDecorationContext';
import { toggleFullscreen } from './utils/fullscreen';
import './styles/main.css';

export const AppContent: React.FC = () => {
  const { toggleMute, previewTheme, setPreviewTheme } = useSettings();
  const { themes } = useThemeCatalog();
  const { t, language } = useI18n();
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
  const [cpuInitialLevel, setCpuInitialLevel] = useState<number | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  // Solo keeps normal page scrolling so its scrollbar stays at the far right,
  // like the leaderboards. The versus arena still uses the locked game layout.
  const isGameRoute = activeTab === 'versus_ai' || activeTab === 'online';

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
        return <HomePage onNavigate={handleNavigate} />;
      case 'solo':
        return (
          <SoloPage
            onStartCpu={(level) => {
              setCpuInitialLevel(level);
              setActiveTab('versus_ai');
            }}
          />
        );
      case 'versus_ai':
        return (
          <VersusAiPage
            initialDifficulty={cpuInitialLevel}
            onClearInitialDifficulty={() => setCpuInitialLevel(null)}
          />
        );
      case 'online':
        return <OnlineVersusPage onNavigate={handleNavigate} />;
      case 'leaderboards':
        return (
          <LeaderboardsPage
            onSelectPlayer={(userId) => {
              setSelectedPlayerId(userId);
              setActiveTab('player-public');
            }}
          />
        );
      case 'player':
        return <PlayerPage onNavigate={handleNavigate} />;
      case 'player-public':
        return selectedPlayerId ? (
          <StatsPage userId={selectedPlayerId} onBack={() => setActiveTab('leaderboards')} />
        ) : (
          <LeaderboardsPage />
        );
      case 'stats':
        return <PlayerPage onNavigate={handleNavigate} />;
      case 'shop':
        return <ShopPage onNavigate={handleNavigate} />;
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
        return <HomePage onNavigate={handleNavigate} />;
    }
  };

  return (
    <GamepadNavProvider
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onMenuMute={toggleMute}
      onMenuFullscreen={toggleFullscreen}
    >
      <div className={`app-container${isGameRoute ? ' app-container--game' : ''}`}>
        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
        {previewTheme && (
          <div className="theme-preview-banner" role="status" aria-live="polite">
            <span className="theme-preview-banner__label">
              <Eye size={16} aria-hidden="true" />
              {t('Previewing {theme}', { theme: themes[previewTheme]?.labels[language] || previewTheme })}
            </span>
            <button
              type="button"
              className="btn-secondary theme-preview-banner__exit"
              onClick={() => setPreviewTheme(null)}
            >
              <X size={14} aria-hidden="true" />
              {t('Exit preview')}
            </button>
          </div>
        )}
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
    <ThemeProvider>
      <NameDecorationProvider>
        <AuthProvider>
          <SettingsProvider>
            <AppContent />
          </SettingsProvider>
        </AuthProvider>
      </NameDecorationProvider>
    </ThemeProvider>
  );
};

export default App;
