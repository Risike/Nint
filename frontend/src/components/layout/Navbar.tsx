import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX, Shield, Maximize2, Minimize2, ShoppingBag, Home, Gamepad2, Users, Trophy, UserRound, Settings as SettingsIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useGamepadNav } from '../../context/GamepadNavContext';
import { useI18n } from '../../i18n/useI18n';
import { MAIN_NAV_ITEMS, type MainTab } from '../../navigation';
import { toggleFullscreen } from '../../utils/fullscreen';
import { UserName } from '../user/UserName';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const NAV_ICONS: Record<MainTab, LucideIcon> = {
  home: Home,
  solo: Gamepad2,
  online: Users,
  leaderboards: Trophy,
  player: UserRound,
  shop: ShoppingBag,
  settings: SettingsIcon
};

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const { user, isAuthenticated } = useAuth();
  const { settings, toggleMute } = useSettings();
  const { gamepadConnected } = useGamepadNav();
  const { t } = useI18n();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const syncFullscreenState = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFullscreenState);
    syncFullscreenState();
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
  }, []);

  const isItemActive = (tab: string) =>
    activeTab === tab
    || (tab === 'solo' && activeTab === 'versus_ai')
    || (tab === 'leaderboards' && activeTab === 'player-public');

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
          <span className="gamepad-nav-badge" title={t('Previous tab')}>LB</span>
        )}
        {MAIN_NAV_ITEMS.map((item) => {
          const Icon = NAV_ICONS[item.tab];
          return (
            <button
              key={item.tab}
              className={`nav-item ${isItemActive(item.tab) ? 'active' : ''}`}
              onClick={() => setActiveTab(item.tab)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <Icon size={14} />
              {t(item.label)}
            </button>
          );
        })}
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
          <span className="gamepad-nav-badge" title={t('Next tab')}>RB</span>
        )}
      </div>

      <div className="nav-actions">
        <button
          className="icon-btn"
          onClick={toggleMute}
          title={settings.isMuted ? t('Unmute') : t('Mute')}
          aria-label={t('Toggle Sound')}
        >
          {settings.isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>

        <button
          className="icon-btn"
          onClick={() => { void toggleFullscreen(); }}
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
              <UserName displayName={user?.display_name || 'Profile'} cosmetics={user?.cosmetics} size="0.9rem" showTitle={false} />
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
