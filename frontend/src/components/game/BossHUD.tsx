import React from 'react';
import { Clock3, Skull } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';

export interface BossEffectBadge {
  label: string;
  color: string;
  background: string;
}

interface BossHUDProps {
  hp: number;
  maxHp: number;
  nextAttackMs: number;
  pendingAttackName: string | null;
  activeEffects: BossEffectBadge[];
}

export const BossHUD: React.FC<BossHUDProps> = ({
  hp,
  maxHp,
  nextAttackMs,
  pendingAttackName,
  activeEffects
}) => {
  const { t } = useI18n();
  const hpPercent = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const seconds = Math.max(0, nextAttackMs / 1000).toFixed(1);
  const isAttackPending = Boolean(pendingAttackName);

  return (
    <div
      className="panel-card boss-hud"
      style={{
        width: '100%',
        padding: '0.65rem 0.9rem',
        gap: '0.55rem',
        borderColor: 'rgba(239, 68, 68, 0.45)',
        background: 'linear-gradient(135deg, rgba(127, 29, 29, 0.32), rgba(15, 23, 42, 0.92))'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', width: '100%' }}>
        <div style={{ display: 'flex', color: 'var(--accent-red)' }}>
          <Skull size={24} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.3rem' }}>
            <span style={{ fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.02em' }}>{t('Boss HP')}</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
              {Math.max(0, hp).toLocaleString()} / {maxHp.toLocaleString()}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label={t('Boss HP')}
            aria-valuemin={0}
            aria-valuemax={maxHp}
            aria-valuenow={Math.max(0, hp)}
            style={{
              height: '14px',
              borderRadius: '999px',
              overflow: 'hidden',
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(248, 113, 113, 0.45)',
              boxShadow: 'inset 0 1px 4px rgba(0, 0, 0, 0.65)'
            }}
          >
            <div
              style={{
                width: `${hpPercent}%`,
                height: '100%',
                borderRadius: 'inherit',
                background: 'linear-gradient(90deg, #991b1b, #ef4444, #fb7185)',
                transition: 'width 180ms ease-out'
              }}
            />
          </div>
        </div>
        <div style={{ flex: '0 0 170px', display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'flex-end' }}>
          <Clock3 size={15} color="var(--accent-yellow)" />
          <div style={{ textAlign: 'right', minWidth: 0 }}>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
              {t('Next attack')}
            </div>
            <div
              title={pendingAttackName ?? undefined}
              style={{
                fontSize: isAttackPending ? '0.72rem' : '0.92rem',
                fontWeight: 800,
                lineHeight: 1.2,
                color: isAttackPending ? 'var(--accent-red)' : 'var(--accent-yellow)',
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {pendingAttackName ?? `${seconds}s`}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', paddingLeft: '2.1rem', minHeight: '18px' }}>
        {activeEffects.map((effect) => (
          <span
            key={effect.label}
            style={{
              padding: '0.12rem 0.42rem',
              borderRadius: '999px',
              background: effect.background,
              color: effect.color,
              border: `1px solid ${effect.color}`,
              fontSize: '0.66rem',
              fontWeight: 700
            }}
          >
            {effect.label}
          </span>
        ))}
      </div>
    </div>
  );
};
