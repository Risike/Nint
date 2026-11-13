import React, { useEffect, useRef, useState } from 'react';
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
  level?: number;
  nextAttackMs: number;
  pendingAttackName: string | null;
  activeEffects: BossEffectBadge[];
  impactKey?: number;
}

interface DamageTrail {
  fromPct: number;
  anchorPct: number;
}

export const BossHUD: React.FC<BossHUDProps> = ({
  hp,
  maxHp,
  level,
  nextAttackMs,
  pendingAttackName,
  activeEffects,
  impactKey = 0
}) => {
  const { t } = useI18n();
  const hpPercent = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const seconds = Math.max(0, nextAttackMs / 1000).toFixed(1);
  const isAttackPending = Boolean(pendingAttackName);
  const [damageTrail, setDamageTrail] = useState<DamageTrail | null>(null);
  const previousHpRef = useRef(hp);
  const previousMaxHpRef = useRef(maxHp);
  const damageAnchorHpRef = useRef(hp);
  const damageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const previousHp = previousHpRef.current;
    const previousMaxHp = previousMaxHpRef.current;
    previousHpRef.current = hp;
    previousMaxHpRef.current = maxHp;

    // A new fight, a new boss level or a heal cancels any pending damage segment.
    if (hp >= previousHp || maxHp !== previousMaxHp) {
      if (damageTimerRef.current) {
        clearTimeout(damageTimerRef.current);
        damageTimerRef.current = null;
      }
      damageAnchorHpRef.current = hp;
      setDamageTrail(null);
      return;
    }

    // Keep the start of the first hit of a sequence so rapid damage extends the
    // same white segment instead of leaving older damage red again.
    damageAnchorHpRef.current = damageTimerRef.current
      ? Math.max(damageAnchorHpRef.current, previousHp)
      : previousHp;

    const currentPct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
    const anchorPct = Math.max(
      currentPct,
      Math.min(100, (damageAnchorHpRef.current / maxHp) * 100)
    );
    const widthPct = anchorPct - currentPct;

    if (widthPct <= 0) {
      setDamageTrail(null);
      return;
    }

    setDamageTrail({ fromPct: currentPct, anchorPct });
    if (damageTimerRef.current) clearTimeout(damageTimerRef.current);
    damageTimerRef.current = setTimeout(() => {
      setDamageTrail(null);
      damageTimerRef.current = null;
    }, 2000);
  }, [hp, maxHp]);

  useEffect(() => () => {
    if (damageTimerRef.current) clearTimeout(damageTimerRef.current);
  }, []);

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
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem', rowGap: '0.15rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
              <span style={{ fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>{t('Boss HP')}</span>
              {typeof level === 'number' && (
                <span
                  style={{
                    padding: '0.08rem 0.4rem',
                    borderRadius: '999px',
                    background: 'rgba(239, 68, 68, 0.18)',
                    border: '1px solid rgba(248, 113, 113, 0.4)',
                    color: 'var(--accent-red)',
                    fontSize: '0.66rem',
                    fontWeight: 800,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {t('Level')} {level}
                </span>
              )}
            </div>
            <span style={{ flexShrink: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {Math.max(0, hp).toLocaleString()} / {maxHp.toLocaleString()}
            </span>
          </div>
          <div style={{ position: 'relative' }}>
            <div
              role="progressbar"
              data-boss-hp-bar="true"
              aria-label={t('Boss HP')}
              aria-valuemin={0}
              aria-valuemax={maxHp}
              aria-valuenow={Math.max(0, hp)}
              style={{
                position: 'relative',
                height: '14px',
                borderRadius: '999px',
                overflow: 'hidden',
                background: 'rgba(15, 23, 42, 0.95)',
                border: '1px solid rgba(248, 113, 113, 0.45)',
                boxShadow: 'inset 0 1px 4px rgba(0, 0, 0, 0.65)'
              }}
            >
              {damageTrail && (
                <div
                  data-boss-damage-trail="true"
                  data-damage-from={damageTrail.fromPct}
                  data-damage-to={damageTrail.anchorPct}
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: '0%',
                    width: `${damageTrail.anchorPct}%`,
                    top: 0,
                    bottom: 0,
                    zIndex: 0,
                    background: 'linear-gradient(180deg, #ffffff, #e2e8f0)',
                    boxShadow: '0 0 10px rgba(255, 255, 255, 0.85)',
                    borderRadius: '999px',
                    transition: 'width 180ms ease-out, opacity 180ms ease-out',
                    pointerEvents: 'none'
                  }}
                />
              )}
              <div
                style={{
                  position: 'relative',
                  zIndex: 1,
                  width: `${hpPercent}%`,
                  height: '100%',
                  borderRadius: 'inherit',
                  background: 'linear-gradient(90deg, #991b1b, #ef4444, #fb7185)',
                  transition: 'width 180ms ease-out'
                }}
              />
            </div>
            {impactKey > 0 && (
              <span key={`boss-impact-${impactKey}`} className="boss-hp-impact" aria-hidden="true" />
            )}
          </div>
        </div>
        <div style={{ flex: '0 0 clamp(88px, 14vw, 170px)', display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'flex-end' }}>
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
