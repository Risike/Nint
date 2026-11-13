import React from 'react';
import { Bomb, Bot, Crosshair, Flame, Skull, Smile, Swords, Timer, Zap } from 'lucide-react';
import { BossLevelGrid } from '../components/game/BossLevelGrid';
import { CpuLevelGrid } from '../components/game/CpuLevelGrid';
import { useI18n } from '../i18n/useI18n';

export type SoloMenuMode =
  | 'marathon'
  | 'sprint'
  | 'ultra'
  | 'zen'
  | 'boss'
  | 'blast-contest'
  | 'blast-training'
  | 'blast-fight';

interface SoloModeMenuProps {
  onSelectMode: (mode: SoloMenuMode) => void;
  onStartCpu?: (level: number) => void;
  onStartBoss?: (level: number) => void;
  unlockedCpuLevel?: number;
  unlockedBossLevel?: number;
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

export const SoloModeMenu: React.FC<SoloModeMenuProps> = ({
  onSelectMode,
  onStartCpu,
  onStartBoss,
  unlockedCpuLevel = 1,
  unlockedBossLevel = 1
}) => {
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
        <section style={sectionStyle} aria-labelledby="classic-heading">
          <div>
            <h2 id="classic-heading" style={sectionTitleStyle}>
              <Smile size={20} color="var(--accent-cyan)" />
              {t('Classic')}
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

        <section style={sectionStyle} aria-labelledby="blast-heading">
          <div>
            <h2 id="blast-heading" style={sectionTitleStyle}>
              <Bomb size={20} color="var(--accent-orange)" />
              Blast
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
              {t('Complete rows to detonate bombs, chain explosions and clear the board.')}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.85rem' }}>
            <div
              className="panel-card"
              role="button"
              tabIndex={0}
              style={cardStyle}
              onClick={() => onSelectMode('blast-contest')}
              onKeyDown={handleCardKey(() => onSelectMode('blast-contest'))}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.55rem' }}>
                <div style={{ background: 'rgba(249, 115, 22, 0.2)', color: 'var(--accent-orange)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', display: 'flex' }}>
                  <Crosshair size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>{t('Contest')}</h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('50 Stages • 100 Pieces')}</span>
                </div>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {t('Clear each stage with a limited stock of bomb pieces. Explosions refill your stock.')}
              </p>
            </div>

            <div
              className="panel-card"
              role="button"
              tabIndex={0}
              style={cardStyle}
              onClick={() => onSelectMode('blast-training')}
              onKeyDown={handleCardKey(() => onSelectMode('blast-training'))}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.55rem' }}>
                <div style={{ background: 'rgba(234, 179, 8, 0.2)', color: 'var(--accent-yellow)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', display: 'flex' }}>
                  <Flame size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>{t('Training')}</h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('Endless Practice')}</span>
                </div>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {t('Practice explosions endlessly with four upcoming pieces and your choice of speed.')}
              </p>
            </div>

            <div
              className="panel-card"
              role="button"
              tabIndex={0}
              style={cardStyle}
              onClick={() => onSelectMode('blast-fight')}
              onKeyDown={handleCardKey(() => onSelectMode('blast-fight'))}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.55rem' }}>
                <div style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--accent-red)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', display: 'flex' }}>
                  <Swords size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>{t('Fight')}</h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('8 Opponents')}</span>
                </div>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {t('Blast through enemy fortresses and defeat eight opponents.')}
              </p>
            </div>
          </div>
        </section>

        <section style={sectionStyle} aria-labelledby="versus-cpu-heading">
          <div>
            <h2 id="versus-cpu-heading" style={sectionTitleStyle}>
              <Bot size={20} color="var(--accent-blue)" />
              {t('Versus CPU')}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
              {t('Face the CPU at ten difficulty levels. Beat a level to unlock the next.')}
            </p>
          </div>

          <CpuLevelGrid
            unlockedLevel={unlockedCpuLevel}
            onSelect={(level) => onStartCpu?.(level)}
          />
        </section>

        <section style={sectionStyle} aria-labelledby="boss-battle-heading">
          <div>
            <h2 id="boss-battle-heading" style={sectionTitleStyle}>
              <Skull size={20} color="var(--accent-red)" />
              {t('Boss Battle')}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
              {t('Fight a boss that attacks every 30 seconds. Score points to reduce its health bar. A Tetris blocks its attack.')}{' '}
              {t('Beat a level to unlock the next one.')}
            </p>
          </div>

          <BossLevelGrid
            unlockedLevel={unlockedBossLevel}
            onSelect={(level) => onStartBoss ? onStartBoss(level) : onSelectMode('boss')}
          />
        </section>
      </div>
    </div>
  );
};
