import React, { useState } from 'react';
import { ArrowLeft, BarChart3, UserRound } from 'lucide-react';
import { useI18n } from '../i18n/useI18n';
import { StatsPage } from './StatsPage';
import { ShopPage } from './ShopPage';
import { useGamepadBack } from '../context/GamepadNavContext';

interface PlayerPageProps {
  onNavigate: (tab: string) => void;
}

type PlayerView = 'menu' | 'stats' | 'player';

const PLAYER_LINKS = [
  {
    view: 'stats' as const,
    label: 'Stats',
    description: 'Personal bests, lifetime performance overview and match records.',
    icon: BarChart3,
    color: 'var(--accent-cyan)',
    background: 'rgba(6, 182, 212, 0.2)'
  },
  {
    view: 'player' as const,
    label: 'Player',
    description: 'Change your player name and equip the cosmetics you own.',
    icon: UserRound,
    color: 'var(--accent-green)',
    background: 'rgba(34, 197, 94, 0.2)'
  }
];

export const PlayerPage: React.FC<PlayerPageProps> = ({ onNavigate }) => {
  const { t } = useI18n();
  const [view, setView] = useState<PlayerView>('menu');

  useGamepadBack(() => {
    if (view !== 'stats') return false;
    setView('menu');
    return true;
  }, [view]);

  const handleCardKey = (action: () => void) => (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };

  if (view === 'stats') {
    return (
      <div style={{ width: '100%', maxWidth: '1040px' }}>
        <button
          className="btn-secondary"
          onClick={() => setView('menu')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', marginBottom: '1.25rem' }}
        >
          <ArrowLeft size={16} /> {t('Back to player menu')}
        </button>
        <StatsPage />
      </div>
    );
  }

  if (view === 'player') {
    return (
      <div style={{ width: '100%', maxWidth: '1040px' }}>
        <button
          className="btn-secondary"
          onClick={() => setView('menu')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', marginBottom: '1.25rem' }}
        >
          <ArrowLeft size={16} /> {t('Back to player menu')}
        </button>
        <ShopPage onNavigate={onNavigate} mode="player" onBack={() => setView('menu')} />
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: '960px', textAlign: 'center', marginTop: '1rem' }}>
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.4rem' }}>{t('Player')}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          {t('Your statistics and player customization.')}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', textAlign: 'left' }}>
        {PLAYER_LINKS.map(({ view: nextView, label, description, icon: Icon, color, background }) => (
          <div
            key={nextView}
            className="panel-card"
            role="button"
            tabIndex={0}
            style={{ padding: '1.35rem', cursor: 'pointer', transition: 'transform 0.2s' }}
            onClick={() => setView(nextView)}
            onKeyDown={handleCardKey(() => setView(nextView))}
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
