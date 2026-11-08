import React, { useEffect, useRef } from 'react';
import { Trophy, RotateCcw, Home, CheckCircle2 } from 'lucide-react';
import { useGamepadNav, useGamepadBack } from '../../context/GamepadNavContext';

interface GameOverModalProps {
  isOpen: boolean;
  isVictory?: boolean;
  customMessage?: string;
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
  // Online Rematch
  rematchPlayerReady?: boolean;
  rematchOpponentReady?: boolean;
  rematchOpponentLeft?: boolean;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isOpen,
  isVictory = false,
  customMessage,
  mode,
  stats,
  isSaved = false,
  onRestart,
  onExit,
  rematchPlayerReady = false,
  rematchOpponentReady = false,
  rematchOpponentLeft = false
}) => {
  const { setFocusedElement } = useGamepadNav();
  const playAgainBtnRef = useRef<HTMLButtonElement | null>(null);
  const [canInteract, setCanInteract] = React.useState(false);

  useGamepadBack(() => {
    if (isOpen) {
      if (canInteract) {
        onExit();
      }
      return true;
    }
    return false;
  }, [isOpen, canInteract, onExit]);

  useEffect(() => {
    if (isOpen) {
      setCanInteract(false);
      const timer = setTimeout(() => {
        setCanInteract(true);
        if (playAgainBtnRef.current) {
          setFocusedElement(playAgainBtnRef.current);
        }
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setCanInteract(false);
    }
  }, [isOpen, setFocusedElement]);

  if (!isOpen) return null;

  const handleRestart = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!canInteract) return;
    onRestart();
  };

  const handleExit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!canInteract) return;
    onExit();
  };

  const formatDuration = (ms: number) => {
    const totalSec = (ms / 1000).toFixed(2);
    return `${totalSec}s`;
  };

  const isOnline = mode === 'online_1v1';

  // Determine button state and label for online rematch
  let restartButtonLabel = 'Play Again';
  let isRestartDisabled = !canInteract;
  let restartButtonBg: string | undefined = undefined;

  if (isOnline) {
    if (rematchOpponentLeft) {
      restartButtonLabel = 'Opponent Left';
      isRestartDisabled = true;
    } else if (rematchPlayerReady && rematchOpponentReady) {
      restartButtonLabel = 'Starting... (2/2)';
      isRestartDisabled = true;
    } else if (rematchPlayerReady) {
      restartButtonLabel = 'Waiting... (1/2)';
      isRestartDisabled = true;
    } else if (rematchOpponentReady) {
      restartButtonLabel = 'Accept Rematch (1/2)';
      restartButtonBg = 'linear-gradient(135deg, #10b981, #06b6d4)';
    }
  }

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
        {customMessage && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '-0.5rem', marginBottom: '0.5rem' }}>
            {customMessage}
          </p>
        )}

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

        {isSaved ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: 'var(--accent-green)', fontSize: '0.85rem' }}>
            <CheckCircle2 size={16} />
            <span>Score saved to leaderboard!</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <span>Log in to submit scores to the leaderboard</span>
          </div>
        )}

        {/* Online Rematch Status Indicators */}
        {isOnline && (
          <div style={{ marginTop: '0.25rem' }}>
            {rematchOpponentLeft && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: 'var(--accent-red)',
                padding: '0.5rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                textAlign: 'center',
                fontWeight: 600
              }}>
                ⚠️ Opponent left the room
              </div>
            )}

            {!rematchOpponentLeft && rematchPlayerReady && rematchOpponentReady && (
              <div style={{
                background: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                color: 'var(--accent-green)',
                padding: '0.5rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                textAlign: 'center',
                fontWeight: 600
              }}>
                🚀 Both players ready! Launching rematch... (2/2)
              </div>
            )}

            {!rematchOpponentLeft && rematchPlayerReady && !rematchOpponentReady && (
              <div style={{
                background: 'rgba(6, 182, 212, 0.15)',
                border: '1px solid rgba(6, 182, 212, 0.4)',
                color: 'var(--accent-cyan)',
                padding: '0.5rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                textAlign: 'center',
                fontWeight: 600
              }}>
                ⏳ Waiting for opponent to accept rematch... (1/2)
              </div>
            )}

            {!rematchOpponentLeft && !rematchPlayerReady && rematchOpponentReady && (
              <div style={{
                background: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                color: 'var(--accent-green)',
                padding: '0.5rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                textAlign: 'center',
                fontWeight: 600
              }}>
                🎮 Opponent wants a rematch! (1/2)
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button
            className="btn-secondary"
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: canInteract ? 1 : 0.6 }}
            onClick={handleExit}
            disabled={!canInteract}
          >
            <Home size={18} /> Menu
          </button>
          <button
            ref={playAgainBtnRef}
            className="btn-primary"
            style={{
              flex: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              opacity: isRestartDisabled ? 0.6 : 1,
              background: restartButtonBg
            }}
            onClick={handleRestart}
            disabled={isRestartDisabled}
          >
            <RotateCcw size={18} /> {restartButtonLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
