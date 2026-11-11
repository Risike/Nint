import React from 'react';
import { Bot, Flame, Shield, Smile, Swords, Timer, Users, Zap } from 'lucide-react';
import { useI18n } from '../i18n/useI18n';

export type SoloMenuMode = 'marathon' | 'sprint' | 'ultra' | 'zen';

interface SoloModeMenuProps {
  onSelectMode: (mode: SoloMenuMode) => void;
  onStartCpu?: (level: number) => void;
}

const sectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.9rem',
  padding: '1.25rem',
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-lg)',
  textAlign: 'left'
};

const sectionTitleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.55rem',
  fontSize: '1.15rem',
  fontWeight: 800
};

const cardStyle: React.CSSProperties = {
  padding: '1.15rem',
  cursor: 'pointer',
  transition: 'transform 0.2s'
};

const cpuLevels = [
  { level: 2, name: 'Beginner', tagline: 'Relaxed Pace', color: 'var(--accent-green)', background: 'rgba(34, 197, 94, 0.2)', icon: Shield },
  { level: 4, name: 'Casual', tagline: 'Balanced Battle', color: 'var(--accent-cyan)', background: 'rgba(6, 182, 212, 0.2)', icon: Bot },
  { level: 6, name: 'Intermediate', tagline: 'Fast Paced', color: 'var(--accent-blue)', background: 'rgba(59, 130, 246, 0.2)', icon: Zap },
  { level: 8, name: 'Advanced', tagline: 'Aggressive AI', color: 'var(--accent-pink)', background: 'rgba(236, 72, 153, 0.2)', icon: Flame },
  { level: 10, name: 'Master', tagline: 'Peak Competitive AI', color: 'var(--accent-red)', background: 'rgba(239, 68, 68, 0.2)', icon: Swords }
] as const;

export const SoloModeMenu: React.FC<SoloModeMenuProps> = ({ onSelectMode, onStartCpu }) => {
  const { t } = useI18n();

  const handleCardKey = (action: () => void) => (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '960px', marginTop: '1rem', textAlign: 'center' }}>
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.4rem' }}>{t('Solo')}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          {t('Play alone or challenge a CPU opponent.')}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <section style={sectionStyle} aria-labelledby="single-player-heading">
          <div>
            <h2 id="single-player-heading" style={sectionTitleStyle}>
              <Smile size={20} color="var(--accent-cyan)" />
              {t('Single Player')}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
              {t('Choose a single-player mode to begin.')}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.85rem' }}>
            <div
              className="panel-card"
              role="button"
              tabIndex={0}
              style={cardStyle}
              onClick={() => onSelectMode('marathon')}
              onKeyDown={handleCardKey(() => onSelectMode('marathon'))}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.55rem' }}>
                <div style={{ background: 'rgba(6, 182, 212, 0.2)', color: 'var(--accent-cyan)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', display: 'flex' }}>
                  <Flame size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>{t('Marathon')}</h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('150 Lines Challenge')}</span>
                </div>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {t('Clear 150 lines as gravity steadily speeds up every 10 lines. Push for the ultimate high score!')}
              </p>
            </div>

            <div
              className="panel-card"
              role="button"
              tabIndex={0}
              style={cardStyle}
              onClick={() => onSelectMode('sprint')}
              onKeyDown={handleCardKey(() => onSelectMode('sprint'))}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.55rem' }}>
                <div style={{ background: 'rgba(234, 179, 8, 0.2)', color: 'var(--accent-yellow)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', display: 'flex' }}>
                  <Zap size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>{t('Sprint (40 Lines)')}</h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('Speedrun Attack')}</span>
                </div>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {t('Clear 40 lines as fast as humanly possible. Test your speed, execution, and personal best time.')}
              </p>
            </div>

            <div
              className="panel-card"
              role="button"
              tabIndex={0}
              style={cardStyle}
              onClick={() => onSelectMode('ultra')}
              onKeyDown={handleCardKey(() => onSelectMode('ultra'))}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.55rem' }}>
                <div style={{ background: 'rgba(236, 72, 153, 0.2)', color: 'var(--accent-pink)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', display: 'flex' }}>
                  <Timer size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>{t('Ultra')}</h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('3 Minutes Score Attack')}</span>
                </div>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {t('Score as many points as possible before the 3-minute timer expires. Maximize B2B chains and T-Spins.')}
              </p>
            </div>

            <div
              className="panel-card"
              role="button"
              tabIndex={0}
              style={cardStyle}
              onClick={() => onSelectMode('zen')}
              onKeyDown={handleCardKey(() => onSelectMode('zen'))}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.55rem' }}>
                <div style={{ background: 'rgba(168, 85, 247, 0.2)', color: 'var(--accent-purple)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', display: 'flex' }}>
                  <Smile size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>{t('Practice')}</h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('Configurable Endless')}</span>
                </div>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {t('Configure gravity, immortal recovery, lock delays, and starting downstack lines to practice freely.')}
              </p>
            </div>
          </div>
        </section>

        <section style={sectionStyle} aria-labelledby="two-players-heading">
          <div>
            <h2 id="two-players-heading" style={sectionTitleStyle}>
              <Users size={20} color="var(--accent-blue)" />
              {t('Two Players')}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
              {t('Face the CPU at five difficulty levels.')}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
            {cpuLevels.map(({ level, name, tagline, color, background, icon: Icon }) => (
              <div
                key={level}
                className="panel-card"
                role="button"
                tabIndex={0}
                style={{ padding: '0.9rem', cursor: 'pointer', gap: '0.35rem', borderColor: color }}
                onClick={() => onStartCpu?.(level)}
                onKeyDown={handleCardKey(() => onStartCpu?.(level))}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <span style={{ background, color, borderRadius: '999px', padding: '0.12rem 0.45rem', fontSize: '0.68rem', fontWeight: 900 }}>
                    Lv {level}
                  </span>
                  <Icon size={17} color={color} />
                </div>
                <div style={{ fontWeight: 800, fontSize: '0.92rem', width: '100%' }}>{t(name)}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', width: '100%' }}>{t(tagline)}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
