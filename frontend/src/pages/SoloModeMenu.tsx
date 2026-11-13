import React, { useState } from 'react';
import { ArrowLeft, Bomb, Bot, Crosshair, Flame, Skull, Smile, Swords, Timer, Zap, type LucideIcon } from 'lucide-react';
import { BossLevelGrid } from '../components/game/BossLevelGrid';
import { CpuLevelGrid } from '../components/game/CpuLevelGrid';
import { useI18n } from '../i18n/useI18n';
import { useGamepadBack } from '../context/GamepadNavContext';

export type SoloMenuMode =
  | 'marathon'
  | 'sprint'
  | 'ultra'
  | 'zen'
  | 'boss'
  | 'blast-contest'
  | 'blast-training'
  | 'blast-fight';

export type SoloMenuCategory = 'classic' | 'blast' | 'cpu' | 'boss';

interface SoloModeMenuProps {
  onSelectMode: (mode: SoloMenuMode) => void;
  onStartCpu?: (level: number) => void;
  onStartBoss?: (level: number) => void;
  unlockedCpuLevel?: number;
  unlockedBossLevel?: number;
  initialCategory?: SoloMenuCategory | null;
}

interface ModeCardDefinition {
  mode: SoloMenuMode;
  title: string;
  subtitle: string;
  description: string;
  icon: LucideIcon;
  color: string;
  background: string;
}

interface CategoryCardDefinition {
  id: SoloMenuCategory;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  background: string;
}

const cardStyle: React.CSSProperties = {
  padding: '1.15rem',
  cursor: 'pointer',
  transition: 'transform 0.2s'
};

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

const CATEGORY_CARDS: readonly CategoryCardDefinition[] = [
  {
    id: 'classic',
    title: 'Classic',
    description: 'Choose a single-player mode to begin.',
    icon: Smile,
    color: 'var(--accent-cyan)',
    background: 'rgba(6, 182, 212, 0.2)'
  },
  {
    id: 'cpu',
    title: 'Versus CPU',
    description: 'Face the CPU at ten difficulty levels. Beat a level to unlock the next.',
    icon: Bot,
    color: 'var(--accent-blue)',
    background: 'rgba(59, 130, 246, 0.2)'
  },
  {
    id: 'boss',
    title: 'Boss Battle',
    description: 'Defeat the boss before its attacks overwhelm you.',
    icon: Skull,
    color: 'var(--accent-red)',
    background: 'rgba(239, 68, 68, 0.2)'
  },
  {
    id: 'blast',
    title: 'Blast',
    description: 'Complete rows to detonate bombs, chain explosions and clear the board.',
    icon: Bomb,
    color: 'var(--accent-orange)',
    background: 'rgba(249, 115, 22, 0.2)'
  }
];

const CLASSIC_MODES: readonly ModeCardDefinition[] = [
  {
    mode: 'marathon',
    title: 'Marathon',
    subtitle: '150 Lines Challenge',
    description: 'Clear 150 lines as gravity steadily speeds up every 10 lines. Push for the ultimate high score!',
    icon: Flame,
    color: 'var(--accent-cyan)',
    background: 'rgba(6, 182, 212, 0.2)'
  },
  {
    mode: 'sprint',
    title: 'Sprint (40 Lines)',
    subtitle: 'Speedrun Attack',
    description: 'Clear 40 lines as fast as humanly possible. Test your speed, execution, and personal best time.',
    icon: Zap,
    color: 'var(--accent-yellow)',
    background: 'rgba(234, 179, 8, 0.2)'
  },
  {
    mode: 'ultra',
    title: 'Ultra',
    subtitle: '3 Minutes Score Attack',
    description: 'Score as many points as possible before the 3-minute timer expires. Maximize B2B chains and T-Spins.',
    icon: Timer,
    color: 'var(--accent-pink)',
    background: 'rgba(236, 72, 153, 0.2)'
  },
  {
    mode: 'zen',
    title: 'Practice',
    subtitle: 'Configurable Endless',
    description: 'Configure gravity, immortal recovery, lock delays, and starting downstack lines to practice freely.',
    icon: Smile,
    color: 'var(--accent-purple)',
    background: 'rgba(168, 85, 247, 0.2)'
  }
];

const BLAST_MODES: readonly ModeCardDefinition[] = [
  {
    mode: 'blast-contest',
    title: 'Adventure',
    subtitle: '50 Stages • 100 Pieces',
    description: 'Clear each stage with a limited stock of bomb pieces. Explosions refill your stock.',
    icon: Crosshair,
    color: 'var(--accent-orange)',
    background: 'rgba(249, 115, 22, 0.2)'
  },
  {
    mode: 'blast-training',
    title: 'Training',
    subtitle: 'Endless Practice',
    description: 'Practice explosions endlessly with four upcoming pieces and your choice of speed.',
    icon: Flame,
    color: 'var(--accent-yellow)',
    background: 'rgba(234, 179, 8, 0.2)'
  },
  {
    mode: 'blast-fight',
    title: 'Fight',
    subtitle: '8 Opponents',
    description: 'Blast through enemy fortresses and defeat eight opponents.',
    icon: Swords,
    color: 'var(--accent-red)',
    background: 'rgba(239, 68, 68, 0.2)'
  }
];

export const SoloModeMenu: React.FC<SoloModeMenuProps> = ({
  onSelectMode,
  onStartCpu,
  onStartBoss,
  unlockedCpuLevel = 1,
  unlockedBossLevel = 1,
  initialCategory = null
}) => {
  const { t } = useI18n();
  const [activeCategory, setActiveCategory] = useState<SoloMenuCategory | null>(initialCategory);

  useGamepadBack(() => {
    if (activeCategory === null) return false;
    setActiveCategory(null);
    return true;
  }, [activeCategory]);

  const handleCardKey = (action: () => void) => (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };

  const renderModeCard = (definition: ModeCardDefinition) => {
    const Icon = definition.icon;
    return (
      <div
        key={definition.mode}
        className="panel-card"
        role="button"
        tabIndex={0}
        data-solo-mode={definition.mode}
        style={cardStyle}
        onClick={() => onSelectMode(definition.mode)}
        onKeyDown={handleCardKey(() => onSelectMode(definition.mode))}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.55rem' }}>
          <div style={{ background: definition.background, color: definition.color, padding: '0.5rem', borderRadius: 'var(--radius-sm)', display: 'flex' }}>
            <Icon size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>{t(definition.title)}</h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t(definition.subtitle)}</span>
          </div>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          {t(definition.description)}
        </p>
      </div>
    );
  };

  if (activeCategory !== null) {
    const category = CATEGORY_CARDS.find(card => card.id === activeCategory)!;
    const CategoryIcon = category.icon;
    const modes = activeCategory === 'classic'
      ? CLASSIC_MODES
      : activeCategory === 'blast'
        ? BLAST_MODES
        : [];

    return (
      <div style={{ width: '100%', maxWidth: '960px', marginTop: '1rem', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1.25rem' }}>
          <button
            type="button"
            className="btn-secondary"
            data-solo-back="true"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            onClick={() => setActiveCategory(null)}
          >
            <ArrowLeft size={16} /> {t('Back')}
          </button>
        </div>

        <div style={{ marginBottom: '1.75rem' }}>
          <div style={{ display: 'inline-flex', padding: '0.7rem', borderRadius: '50%', background: category.background, color: category.color, marginBottom: '0.5rem' }}>
            <CategoryIcon size={28} />
          </div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.4rem' }}>{t(category.title)}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{t(category.description)}</p>
        </div>

        {activeCategory === 'cpu' ? (
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
        ) : activeCategory === 'boss' ? (
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
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.85rem' }}>
            {modes.map(renderModeCard)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: '960px', marginTop: '1rem', textAlign: 'center' }}>
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.4rem' }}>{t('Solo')}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          {t('Play alone or challenge a CPU opponent.')}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', textAlign: 'left' }}>
        {CATEGORY_CARDS.map((category) => {
          const Icon = category.icon;
          return (
            <div
              key={category.id}
              className="panel-card"
              role="button"
              tabIndex={0}
              data-solo-category={category.id}
              style={{ padding: '1.35rem', cursor: 'pointer', transition: 'transform 0.2s' }}
              onClick={() => setActiveCategory(category.id)}
              onKeyDown={handleCardKey(() => setActiveCategory(category.id))}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.65rem' }}>
                <div style={{ background: category.background, color: category.color, padding: '0.6rem', borderRadius: 'var(--radius-sm)', display: 'flex' }}>
                  <Icon size={22} />
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>{t(category.title)}</h3>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                {t(category.description)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
