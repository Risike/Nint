import React from 'react';
import { Check, Lock } from 'lucide-react';
import { CPU_LEVELS } from '../../game/cpuLevels';
import { useI18n } from '../../i18n/useI18n';

interface CpuLevelGridProps {
  unlockedLevel: number;
  onSelect: (level: number) => void;
  variant?: 'compact' | 'detailed';
}

export const CpuLevelGrid: React.FC<CpuLevelGridProps> = ({
  unlockedLevel,
  onSelect,
  variant = 'compact'
}) => {
  const { t } = useI18n();
  const detailed = variant === 'detailed';

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
        gridTemplateColumns: detailed
          ? 'repeat(auto-fit, minmax(260px, 1fr))'
          : 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: detailed ? '1.25rem' : '0.75rem',
        textAlign: 'left'
      }}
    >
      {CPU_LEVELS.map((definition) => {
        const locked = definition.level > unlockedLevel;
        const completed = definition.level < unlockedLevel;
        const Icon = definition.icon;
        const unlockHint = t('Beat Level {level} to unlock.', {
          level: definition.level - 1
        });

        return (
          <div
            key={definition.level}
            className="panel-card"
            data-cpu-level={definition.level}
            data-cpu-locked={locked ? 'true' : 'false'}
            role={locked ? undefined : 'button'}
            tabIndex={locked ? undefined : 0}
            aria-disabled={locked || undefined}
            title={locked ? unlockHint : undefined}
            style={{
              padding: detailed ? '1.5rem' : '0.9rem',
              cursor: locked ? 'not-allowed' : 'pointer',
              gap: detailed ? '0.65rem' : '0.35rem',
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
                  fontSize: detailed ? '0.72rem' : '0.68rem',
                  fontWeight: 900
                }}
              >
                Lv {definition.level}
              </span>
              {locked ? (
                <Lock size={detailed ? 22 : 17} color="var(--text-muted)" />
              ) : completed ? (
                <Check size={detailed ? 22 : 17} color="var(--accent-green)" />
              ) : (
                <Icon size={detailed ? 22 : 17} color={definition.color} />
              )}
            </div>

            <div style={{ fontWeight: 800, fontSize: detailed ? '1.15rem' : '0.92rem', width: '100%' }}>
              {t('Level')} {definition.level}
            </div>

            <div style={{ fontSize: detailed ? '0.82rem' : '0.7rem', color: 'var(--text-muted)', width: '100%' }}>
              {t(definition.tier)} · {t(definition.tagline)}
            </div>

            {detailed && !locked && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                {t(definition.description)}
              </p>
            )}

            {locked && (
              <div style={{ fontSize: detailed ? '0.78rem' : '0.68rem', color: 'var(--text-muted)', width: '100%' }}>
                {unlockHint}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
