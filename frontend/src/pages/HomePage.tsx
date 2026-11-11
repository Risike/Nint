import React, { useEffect, useState } from 'react';
import { BarChart3, Gamepad2, Megaphone, Settings, ShoppingBag, Trophy, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ApiClient } from '../services/api';
import { useI18n } from '../i18n/useI18n';

interface HomePageProps {
  onNavigate: (tab: string) => void;
}

const HOME_LINKS = [
  {
    tab: 'solo',
    label: 'Solo',
    description: 'Play alone or challenge a CPU opponent.',
    icon: Gamepad2,
    color: 'var(--accent-cyan)',
    background: 'rgba(6, 182, 212, 0.2)'
  },
  {
    tab: 'online',
    label: 'Multiplayer',
    description: 'Play online against another player.',
    icon: Users,
    color: 'var(--accent-purple)',
    background: 'rgba(168, 85, 247, 0.2)'
  },
  {
    tab: 'leaderboards',
    label: 'Leaderboards',
    description: 'Real verified scores submitted by authenticated players.',
    icon: Trophy,
    color: 'var(--accent-yellow)',
    background: 'rgba(234, 179, 8, 0.2)'
  },
  {
    tab: 'stats',
    label: 'Stats',
    description: 'Personal bests, lifetime performance overview and match records.',
    icon: BarChart3,
    color: 'var(--accent-green)',
    background: 'rgba(34, 197, 94, 0.2)'
  },
  {
    tab: 'shop',
    label: 'Shop',
    description: 'Spend credits on skins, colors, decorations, and titles.',
    icon: ShoppingBag,
    color: 'var(--accent-orange)',
    background: 'rgba(249, 115, 22, 0.2)'
  },
  {
    tab: 'settings',
    label: 'Settings',
    description: 'Customize your audio, keyboard keybinds, gamepad controller buttons, and accessibility.',
    icon: Settings,
    color: 'var(--accent-pink)',
    background: 'rgba(236, 72, 153, 0.2)'
  }
] as const;

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const { isGuest } = useAuth();
  const { t } = useI18n();
  const [newsMessage, setNewsMessage] = useState('');

  const handleCardKey = (action: () => void) => (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };

  useEffect(() => {
    ApiClient.getNews().then(data => {
      if (data.message) setNewsMessage(data.message);
    }).catch(() => {});
  }, []);

  return (
    <div style={{ width: '100%', maxWidth: '960px', textAlign: 'center', marginTop: '1rem' }}>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 style={{
          fontSize: '3rem',
          fontWeight: 900,
          letterSpacing: '-0.03em',
          background: 'linear-gradient(135deg, #06b6d4, #8b5cf6, #ec4899)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '0.5rem'
        }}>
          Nint
        </h1>
        <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
          “Nint is not Tetris.”
        </p>
        <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginTop: '0.4rem', maxWidth: '600px', margin: '0.4rem auto 0' }}>
          {t('A modern, high-performance, Guideline-compliant online falling-block puzzle game.')}
        </p>

        {isGuest && (
          <div style={{
            display: 'inline-block',
            marginTop: '1rem',
            padding: '0.4rem 0.8rem',
            background: 'var(--bg-tertiary)',
            borderRadius: '999px',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)'
          }}>
            {t('Playing as')} <strong>{t('Guest')}</strong> {t('(Local progress only. Sign in to climb global leaderboards!)')}
          </div>
        )}
        {newsMessage && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            marginTop: '1rem', padding: '0.75rem 1rem',
            background: 'rgba(6, 182, 212, 0.1)',
            border: '1px solid rgba(6, 182, 212, 0.25)',
            borderRadius: 'var(--radius-sm)',
            textAlign: 'left', maxWidth: '600px', margin: '1rem auto 0'
          }}>
            <Megaphone size={18} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{newsMessage}</span>
          </div>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1.25rem',
        textAlign: 'left'
      }}>
        {HOME_LINKS.map(({ tab, label, description, icon: Icon, color, background }) => (
          <div
            key={tab}
            className="panel-card"
            role="button"
            tabIndex={0}
            style={{ padding: '1.35rem', cursor: 'pointer', transition: 'transform 0.2s' }}
            onClick={() => onNavigate(tab)}
            onKeyDown={handleCardKey(() => onNavigate(tab))}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.65rem' }}>
              <div style={{ background, color, padding: '0.6rem', borderRadius: 'var(--radius-sm)', display: 'flex' }}>
                <Icon size={22} />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>{t(label)}</h3>
            </div>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              {t(description)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
