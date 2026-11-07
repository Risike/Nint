import React from 'react';
import { Trophy, RotateCcw, Home, CheckCircle2 } from 'lucide-react';

interface GameOverModalProps {
  isOpen: boolean;
  isVictory?: boolean;
  mode: string;
  stats: {
    score: number;
    lines: number;
    level: number;
    duration: number;
    piecesPlaced: number;
    pps: number;
    apm: number;
    tetrises: number;
    tSpins: number;
    maxCombo: number;
    maxB2B: number;
  };
  isSaved?: boolean;
  onRestart: () => void;
  onExit: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isOpen,
  isVictory = false,
  mode,
  stats,
  isSaved = false,
  onRestart,
  onExit
}) => {
  if (!isOpen) return null;

  const formatDuration = (ms: number) => {
    const totalSec = (ms / 1000).toFixed(2);
    return `${totalSec}s`;
  };

  return (
    <div className="overlay-backdrop">
      <div className="modal-card">
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{
            background: isVictory ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            color: isVictory ? 'var(--accent-green)' : 'var(--accent-red)',
            padding: '1rem',
            borderRadius: '50%'
          }}>
            <Trophy size={40} />
          </div>
        </div>

        <h2 className="modal-title" style={{ color: isVictory ? 'var(--accent-green)' : 'var(--text-primary)' }}>
          {isVictory ? 'VICTORY!' : 'GAME OVER'}
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.75rem',
          background: 'var(--bg-tertiary)',
          padding: '1rem',
          borderRadius: 'var(--radius-md)',
          textAlign: 'left'
        }}>
          <div>
            <div className="stat-label">Score</div>
            <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--accent-cyan)' }}>
              {stats.score.toLocaleString()}
            </div>
          </div>

          <div>
            <div className="stat-label">Lines</div>
            <div style={{ fontWeight: 800, fontSize: '1.2rem' }}>
              {stats.lines}
            </div>
          </div>

          <div>
            <div className="stat-label">Time</div>
            <div style={{ fontWeight: 700 }}>
              {formatDuration(stats.duration)}
            </div>
          </div>

          <div>
            <div className="stat-label">Speed</div>
            <div style={{ fontWeight: 700 }}>
              {stats.pps} PPS / {stats.apm} APM
            </div>
          </div>

          <div>
            <div className="stat-label">Tetrises / T-Spins</div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
              {stats.tetrises} / {stats.tSpins}
            </div>
          </div>

          <div>
            <div className="stat-label">Max Combo / B2B</div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
              x{stats.maxCombo > 0 ? stats.maxCombo : 0} / {stats.maxB2B}
            </div>
          </div>
        </div>

        {isSaved && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: 'var(--accent-green)', fontSize: '0.85rem' }}>
            <CheckCircle2 size={16} />
            <span>Score saved to leaderboard!</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button className="btn-secondary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} onClick={onExit}>
            <Home size={18} /> Menu
          </button>
          <button className="btn-primary" style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} onClick={onRestart}>
            <RotateCcw size={18} /> Play Again
          </button>
        </div>
      </div>
    </div>
  );
};
