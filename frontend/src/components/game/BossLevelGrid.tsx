import React from 'react';
import { Check, Lock, Skull } from 'lucide-react';
import { BOSS_LEVELS } from '../../game/bossLevels';
import { useI18n } from '../../i18n/useI18n';

interface BossLevelGridProps {
  unlockedLevel: number;
  onSelect: (level: number) => void;
}

export const BossLevelGrid: React.FC<BossLevelGridProps> = ({
  unlockedLevel,
  onSelect
}) => {
  const { t } = useI18n();

  const handleCardKey = (action: () => void) => (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '0.75rem',
        textAlign: 'left'
      }}
    >
      {BOSS_LEVELS.map((definition) => {
        const locked = definition.level > unlockedLevel;
        const completed = definition.level < unlockedLevel;
        const unlockHint = t('Beat Level {level} to unlock.', {
          level: definition.level - 1
        });

        return (
          <div
            key={definition.level}
            className="panel-card"
            data-boss-level={definition.level}
            data-boss-locked={locked ? 'true' : 'false'}
            role={locked ? undefined : 'button'}
            tabIndex={locked ? undefined : 0}
            aria-disabled={locked || undefined}
            title={locked ? unlockHint : undefined}
            style={{
              padding: '0.9rem',
              cursor: locked ? 'not-allowed' : 'pointer',
              gap: '0.35rem',
              borderColor: locked ? 'var(--border-color)' : definition.color,
              borderStyle: locked ? 'dashed' : 'solid',
              opacity: locked ? 0.55 : 1,
              transition: 'transform 0.2s'
            }}
            onClick={locked ? undefined : () => onSelect(definition.level)}
            onKeyDown={locked ? undefined : handleCardKey(() => onSelect(definition.level))}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span
                style={{
                  background: definition.background,
                  color: definition.color,
                  borderRadius: '999px',
                  padding: '0.12rem 0.45rem',
                  fontSize: '0.68rem',
                  fontWeight: 900
                }}
              >
                Lv {definition.level}
              </span>
              {locked ? (
                <Lock size={17} color="var(--text-muted)" />
              ) : completed ? (
                <Check size={17} color="var(--accent-green)" />
              ) : (
                <Skull size={17} color={definition.color} />
              )}
            </div>

            <div style={{ fontWeight: 800, fontSize: '0.92rem', width: '100%' }}>
              {t('Level')} {definition.level}
            </div>

            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', width: '100%' }}>
              {t('{hp} HP', { hp: definition.hp.toLocaleString() })}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', width: '100%' }}>
              {t('Start speed: {level}', { level: definition.startingSpeedLevel })}
            </div>

            {locked && (
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', width: '100%' }}>
                {unlockHint}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};