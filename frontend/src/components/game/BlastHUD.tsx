import React from 'react';
import { Bomb, Flame, Swords, Target } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';
import {
  BLAST_CONTEST_STAGES,
  BLAST_FIGHT_ENEMIES,
  BLAST_FIGHT_ROUNDS,
  type BlastMode
} from '../../game/engine/blast';

interface BlastHUDProps {
  mode: BlastMode;
  score: number;
  blocks: number;
  chain: number;
  bestChain: number;
  level: number;
  stage: number;
  round: number;
  piecesLeft: number;
  enemyHp: number;
  enemyMaxHp: number;
  timeMs: number;
}

export const BlastHUD: React.FC<BlastHUDProps> = ({
  mode,
  score,
  blocks,
  chain,
  bestChain,
  level,
  stage,
  round,
  piecesLeft,
  enemyHp,
  enemyMaxHp,
  timeMs
}) => {
  const { t } = useI18n();
  const totalSec = Math.floor(timeMs / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  const Icon = mode === 'contest' ? Target : mode === 'training' ? Flame : Swords;
  const hpPercent = enemyMaxHp > 0 ? Math.max(0, Math.min(100, (enemyHp / enemyMaxHp) * 100)) : 0;
  const enemy = mode === 'fight'
    ? BLAST_FIGHT_ENEMIES[Math.max(0, Math.min(BLAST_FIGHT_ROUNDS - 1, round - 1))]
    : null;

  return (
    <div className="panel-card" style={{ gap: '0.6rem', textAlign: 'left', alignItems: 'stretch' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--accent-orange)' }}>
        <Bomb size={16} />
        <span style={{ fontWeight: 800, letterSpacing: '0.04em' }}>Blast</span>
        <Icon size={14} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
      </div>

      <div>
        <div className="stat-label">{t('Score')}</div>
        <div className="stat-value" style={{ color: 'var(--accent-cyan)' }}>{score.toLocaleString()}</div>
      </div>

      <div>
        <div className="stat-label">{t('Blocks Destroyed')}</div>
        <div className="stat-value" style={{ color: 'var(--accent-orange)' }}>{blocks}</div>
      </div>

      {mode === 'contest' && (
        <>
          <div>
            <div className="stat-label">{t('Stage')}</div>
            <div className="stat-value">{stage}<span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}> / {BLAST_CONTEST_STAGES}</span></div>
          </div>
          <div>
            <div className="stat-label">{t('Pieces Left')}</div>
            <div className="stat-value" style={{ color: piecesLeft <= 10 ? 'var(--accent-red)' : 'var(--text-primary)' }}>
              {piecesLeft}
            </div>
          </div>
        </>
      )}

      {mode === 'fight' && (
        <>
          <div>
            <div className="stat-label">{t('Opponent')}</div>
            <div className="stat-value" style={{ fontSize: '0.95rem' }}>{enemy?.name}</div>
          </div>
          <div>
            <div className="stat-label">{t('Round')}</div>
            <div className="stat-value">{round}<span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}> / {BLAST_FIGHT_ROUNDS}</span></div>
          </div>
          <div>
            <div className="stat-label">{t('Enemy HP')}</div>
            <div style={{ height: '10px', borderRadius: '999px', background: 'var(--bg-tertiary)', overflow: 'hidden', marginTop: '0.3rem' }}>
              <div
                style={{
                  width: `${hpPercent}%`,
                  height: '100%',
                  background: hpPercent <= 25 ? 'var(--accent-red)' : 'linear-gradient(90deg, #f97316, #ef4444)',
                  transition: 'width 180ms ease'
                }}
              />
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {Math.ceil(enemyHp)} / {enemyMaxHp}
            </div>
          </div>
        </>
      )}

      {mode === 'training' && (
        <div>
          <div className="stat-label">{t('Speed')}</div>
          <div className="stat-value">{level}</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.8rem' }}>
        <div style={{ flex: 1 }}>
          <div className="stat-label">{t('Chain')}</div>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: chain > 1 ? 'var(--accent-yellow)' : 'var(--text-muted)' }}>
            {chain > 1 ? `x${chain}` : '—'}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div className="stat-label">{t('Best Chain')}</div>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: bestChain > 1 ? 'var(--accent-orange)' : 'var(--text-muted)' }}>
            {bestChain > 0 ? `x${bestChain}` : '—'}
          </div>
        </div>
      </div>

      <div>
        <div className="stat-label">{t('Time')}</div>
        <div style={{ fontSize: '1.05rem', fontWeight: 700, fontFamily: 'monospace' }}>
          {minutes}:{seconds.toString().padStart(2, '0')}
        </div>
      </div>

      {mode === 'fight' && enemy && (
        <div style={{ paddingTop: '0.55rem', borderTop: '1px solid var(--border-color)' }}>
          <div className="stat-label">{t('Enemy ability')}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
            {t(enemy.ability)}
          </div>
        </div>
      )}
    </div>
  );
};
