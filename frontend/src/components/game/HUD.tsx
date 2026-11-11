import React from 'react';
import { useI18n } from '../../i18n/useI18n';

interface HUDProps {
  score: number;
  lines: number;
  level: number;
  timeMs: number;
  combo: number;
  b2b: boolean;
  b2bChain?: number;
  pps?: number;
  apm?: number;
}

export const HUD: React.FC<HUDProps> = ({
  score,
  lines,
  level,
  timeMs,
  combo,
  b2b,
  b2bChain = 0,
  pps = 0,
  apm = 0
}) => {
  const { t } = useI18n();
  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    const centis = Math.floor((ms % 1000) / 10);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}`;
  };

  return (
    <div className="panel-card" style={{ gap: '0.6rem', textAlign: 'left', alignItems: 'stretch' }}>
      <div>
        <div className="stat-label">{t('Score')}</div>
        <div className="stat-value" style={{ color: 'var(--accent-cyan)' }}>{score.toLocaleString()}</div>
      </div>

      <div>
        <div className="stat-label">{t('Lines')}</div>
        <div className="stat-value">{lines}</div>
      </div>

      <div>
        <div className="stat-label">{t('Level')}</div>
        <div className="stat-value">{level}</div>
      </div>

      <div>
        <div className="stat-label">{t('Time')}</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'monospace' }}>
          {formatTime(timeMs)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.2rem' }}>
        <div>
          <div className="stat-label">PPS</div>
          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{pps.toFixed(2)}</div>
        </div>
        <div>
          <div className="stat-label">APM</div>
          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{apm.toFixed(1)}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.2rem' }}>
        <div style={{ flex: 1 }}>
          <div className="stat-label">{t('Combo')}</div>
          <div style={{
            fontWeight: 800,
            fontSize: '0.9rem',
            color: combo > 0 ? 'var(--accent-yellow)' : 'var(--text-muted)'
          }}>
            {combo > 0 ? `x${combo}` : '—'}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div className="stat-label">B2B</div>
          <div style={{
            fontWeight: 800,
            fontSize: '0.9rem',
            color: b2b ? 'var(--accent-pink)' : 'var(--text-muted)'
          }}>
            {b2b ? (b2bChain > 1 ? `x${b2bChain}` : '✓') : '—'}
          </div>
        </div>
      </div>
    </div>
  );
};
