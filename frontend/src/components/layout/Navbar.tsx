import React, { useEffect, useState } from 'react';
import { Gamepad2, Trophy, BarChart3, Settings, User, Volume2, VolumeX, Swords, Globe, Shield, Maximize2, Minimize2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useGamepadNav } from '../../context/GamepadNavContext';
import { useI18n } from '../../i18n/useI18n';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const { settings, updateSettings } = useSettings();
  const { gamepadConnected } = useGamepadNav();
  const { t } = useI18n();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const syncFullscreenState = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFullscreenState);
    syncFullscreenState();
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch (error) {
      console.warn('Unable to toggle fullscreen:', error);
    }
  };

  return (
    <nav className="navbar">
      <a href="#" className="nav-brand" onClick={(e) => { e.preventDefault(); setActiveTab('home'); }}>
        <svg width="28" height="28" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="100" height="100" rx="22" fill="#0b0f19"/>
          <rect x="1" y="1" width="98" height="98" rx="21" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5"/>
          
          {/* Left Column (Cyan I & Blue J) */}
          <rect x="15" y="15" width="16" height="16" rx="3" fill="#06b6d4" stroke="#22d3ee" strokeWidth="0.8"/>
          <rect x="16.5" y="16.5" width="13" height="4" rx="1.5" fill="#ffffff" opacity="0.35"/>
          <rect x="15" y="33" width="16" height="16" rx="3" fill="#06b6d4" stroke="#22d3ee" strokeWidth="0.8"/>
          <rect x="16.5" y="34.5" width="13" height="4" rx="1.5" fill="#ffffff" opacity="0.35"/>
          <rect x="15" y="51" width="16" height="16" rx="3" fill="#3b82f6" stroke="#60a5fa" strokeWidth="0.8"/>
          <rect x="16.5" y="52.5" width="13" height="4" rx="1.5" fill="#ffffff" opacity="0.35"/>
          <rect x="15" y="69" width="16" height="16" rx="3" fill="#3b82f6" stroke="#60a5fa" strokeWidth="0.8"/>
          <rect x="16.5" y="70.5" width="13" height="4" rx="1.5" fill="#ffffff" opacity="0.35"/>

          {/* Diagonal Bridge (Orange L & Purple T) */}
          <rect x="33" y="33" width="16" height="16" rx="3" fill="#f97316" stroke="#fb923c" strokeWidth="0.8"/>
          <rect x="34.5" y="34.5" width="13" height="4" rx="1.5" fill="#ffffff" opacity="0.35"/>
          <rect x="51" y="51" width="16" height="16" rx="3" fill="#a855f7" stroke="#c084fc" strokeWidth="0.8"/>
          <rect x="52.5" y="52.5" width="13" height="4" rx="1.5" fill="#ffffff" opacity="0.35"/>

          {/* Right Column (Yellow O & Red Z) */}
          <rect x="69" y="15" width="16" height="16" rx="3" fill="#eab308" stroke="#fde047" strokeWidth="0.8"/>
          <rect x="70.5" y="16.5" width="13" height="4" rx="1.5" fill="#ffffff" opacity="0.35"/>
          <rect x="69" y="33" width="16" height="16" rx="3" fill="#eab308" stroke="#fde047" strokeWidth="0.8"/>
          <rect x="70.5" y="34.5" width="13" height="4" rx="1.5" fill="#ffffff" opacity="0.35"/>
          <rect x="69" y="51" width="16" height="16" rx="3" fill="#ef4444" stroke="#f87171" strokeWidth="0.8"/>
          <rect x="70.5" y="52.5" width="13" height="4" rx="1.5" fill="#ffffff" opacity="0.35"/>
          <rect x="69" y="69" width="16" height="16" rx="3" fill="#ef4444" stroke="#f87171" strokeWidth="0.8"/>
          <rect x="70.5" y="70.5" width="13" height="4" rx="1.5" fill="#ffffff" opacity="0.35"/>
        </svg>
        <span>Nint</span>
        <span className="tagline">“Nint is not Tetris.”</span>
      </a>

      <div className="nav-links">
        {gamepadConnected && (
          <span className="gamepad-nav-badge" title={t('Navigate tabs with LB/LT')}>LB</span>
        )}
        <button
          className={`nav-item ${activeTab === 'solo' ? 'active' : ''}`}
          onClick={() => setActiveTab('solo')}
        >
          {t('Solo')}
        </button>
        <button
          className={`nav-item ${activeTab === 'versus_ai' ? 'active' : ''}`}
          onClick={() => setActiveTab('versus_ai')}
        >
          {t('Player vs CPU')}
        </button>
        <button
          className={`nav-item ${activeTab === 'online' ? 'active' : ''}`}
          onClick={() => setActiveTab('online')}
        >
          {t('Online Player vs Player')}
        </button>
        <button
          className={`nav-item ${activeTab === 'leaderboards' ? 'active' : ''}`}
          onClick={() => setActiveTab('leaderboards')}
        >
          {t('Leaderboards')}
        </button>
        <button
          className={`nav-item ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          {t('Stats')}
        </button>
        <button
          className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          {t('Settings')}
        </button>
        {user?.is_admin && (
          <button
            className={`nav-item ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--accent-cyan)' }}
          >
            <Shield size={14} /> {t('Admin')}
          </button>
        )}
        {gamepadConnected && (
          <span className="gamepad-nav-badge" title={t('Navigate tabs with RB/RT')}>RB</span>
        )}
      </div>

      <div className="nav-actions">
        <button
          className="icon-btn"
          onClick={() => updateSettings({ isMuted: !settings.isMuted })}
          title={settings.isMuted ? t('Unmute') : t('Mute')}
          aria-label={t('Toggle Sound')}
        >
          {settings.isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>

        <button
          className="icon-btn"
          onClick={toggleFullscreen}
          title={isFullscreen ? t('Exit Fullscreen') : t('Fullscreen')}
          aria-label={isFullscreen ? t('Exit Fullscreen') : t('Fullscreen')}
          aria-pressed={isFullscreen}
        >
          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>

        {isAuthenticated ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              className="nav-item"
              onClick={() => setActiveTab('profile')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <User size={16} />
              <span>{user?.display_name || 'Profile'}</span>
            </button>
          </div>
        ) : (
          <button
            className="btn-primary"
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
            onClick={() => setActiveTab('login')}
          >
            {t('Sign In')}
          </button>
        )}
      </div>
    </nav>
  );
};
