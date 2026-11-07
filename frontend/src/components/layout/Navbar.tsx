import React from 'react';
import { Gamepad2, Trophy, BarChart3, Settings, User, Moon, Sun, Volume2, VolumeX, Swords, Globe } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const { settings, toggleTheme, updateSettings } = useSettings();

  return (
    <nav className="navbar">
      <a href="#" className="nav-brand" onClick={(e) => { e.preventDefault(); setActiveTab('home'); }}>
        <svg width="28" height="28" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="100" height="100" rx="20" fill="#0f172a"/>
          <rect x="20" y="20" width="18" height="60" rx="4" fill="#06b6d4"/>
          <rect x="62" y="20" width="18" height="60" rx="4" fill="#8b5cf6"/>
          <path d="M 38 20 L 62 60 L 62 80 L 38 40 Z" fill="#ec4899"/>
        </svg>
        <span>Nint</span>
        <span className="tagline">“Nint is not Tetris.”</span>
      </a>

      <div className="nav-links">
        <button
          className={`nav-item ${activeTab === 'solo' ? 'active' : ''}`}
          onClick={() => setActiveTab('solo')}
        >
          Solo
        </button>
        <button
          className={`nav-item ${activeTab === 'versus_ai' ? 'active' : ''}`}
          onClick={() => setActiveTab('versus_ai')}
        >
          1v1 AI
        </button>
        <button
          className={`nav-item ${activeTab === 'online' ? 'active' : ''}`}
          onClick={() => setActiveTab('online')}
        >
          Online 1v1
        </button>
        <button
          className={`nav-item ${activeTab === 'leaderboards' ? 'active' : ''}`}
          onClick={() => setActiveTab('leaderboards')}
        >
          Leaderboards
        </button>
        <button
          className={`nav-item ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          Stats
        </button>
        <button
          className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </div>

      <div className="nav-actions">
        <button
          className="icon-btn"
          onClick={() => updateSettings({ isMuted: !settings.isMuted })}
          title={settings.isMuted ? 'Unmute' : 'Mute'}
          aria-label="Toggle Sound"
        >
          {settings.isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>

        <button
          className="icon-btn"
          onClick={toggleTheme}
          title={settings.theme === 'dark' ? 'Light mode' : 'Dark mode'}
          aria-label="Toggle Theme"
        >
          {settings.theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
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
            Sign In
          </button>
        )}
      </div>
    </nav>
  );
};
