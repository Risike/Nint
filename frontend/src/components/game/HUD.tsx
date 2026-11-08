import React from 'react';

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
        <div className="stat-label">Score</div>
        <div className="stat-value" style={{ color: 'var(--accent-cyan)' }}>{score.toLocaleString()}</div>
      </div>

      <div>
        <div className="stat-label">Lines</div>
        <div className="stat-value">{lines}</div>
      </div>

      <div>
        <div className="stat-label">Level</div>
        <div className="stat-value">{level}</div>
      </div>

      <div>
        <div className="stat-label">Time</div>
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

      {combo > 0 && (
        <div style={{
          background: 'rgba(234, 179, 8, 0.15)',
          color: 'var(--accent-yellow)',
          padding: '0.25rem 0.5rem',
          borderRadius: '4px',
          fontWeight: 800,
          textAlign: 'center',
          fontSize: '0.85rem'
        }}>
          COMBO x{combo}
        </div>
      )}

      {b2b && (
        <div style={{
          background: 'rgba(236, 72, 153, 0.15)',
          color: 'var(--accent-pink)',
          padding: '0.25rem 0.5rem',
          borderRadius: '4px',
          fontWeight: 800,
          textAlign: 'center',
          fontSize: '0.85rem'
        }}>
          {b2bChain > 1 ? `B2B x${b2bChain}` : 'B2B READY'}
        </div>
      )}
    </div>
  );
};
