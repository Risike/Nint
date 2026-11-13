import React from 'react';
import { GameEngine } from '../../game/engine/gameEngine';
import { TetrominoType } from '../../game/engine/constants';
import { PlayfieldCanvas } from './PlayfieldCanvas';
import { HoldDisplay } from './HoldDisplay';
import { QueueDisplay } from './QueueDisplay';
import { CountdownOverlay } from './CountdownOverlay';
import { useI18n } from '../../i18n/useI18n';

export type VersusTone = 'cyan' | 'orange' | 'purple';

export interface VersusArenaSide {
  label: React.ReactNode;
  tone: VersusTone;
  hold: TetrominoType | null;
  canHold: boolean;
  queue: TetrominoType[];
  score: number;
  lines: number;
  combo: number;
  b2b: boolean;
  b2bChain: number;
  engine: GameEngine;
  garbage: number;
}

export interface VersusBoardEffects {
  color?: string | null;
  blind?: boolean;
  hideGhost?: boolean;
  banner?: { id: number; label: string; color: string; background: string } | null;
}

interface VersusArenaProps {
  arenaRef: React.RefObject<HTMLDivElement>;
  player: VersusArenaSide;
  opponent: VersusArenaSide;
  cellSize: number;
  vsTone?: 'red' | 'green';
  vsLabel?: string;
  isCountingDown?: boolean;
  onCountdownComplete?: () => void;
  overlay?: React.ReactNode;
  playerBoardRef?: React.RefObject<HTMLDivElement>;
  playerEffects?: VersusBoardEffects;
  opponentEffects?: VersusBoardEffects;
}

export const VersusArena: React.FC<VersusArenaProps> = ({
  arenaRef,
  player,
  opponent,
  cellSize,
  vsTone = 'red',
  vsLabel = 'VS',
  isCountingDown = false,
  onCountdownComplete,
  overlay,
  playerBoardRef,
  playerEffects,
  opponentEffects
}) => {
  return (
    <div className="versus-arena" ref={arenaRef}>
      <VersusSide
        side={player}
        cellSize={cellSize}
        showCountdown={isCountingDown}
        onCountdownComplete={onCountdownComplete}
        boardRef={playerBoardRef}
        effects={playerEffects}
      />

      <div className={`versus-vs versus-vs--${vsTone}`}>{vsLabel}</div>

      <VersusSide side={opponent} cellSize={cellSize} effects={opponentEffects} />

      {overlay}
    </div>
  );
};

interface VersusSideProps {
  side: VersusArenaSide;
  cellSize: number;
  showCountdown?: boolean;
  onCountdownComplete?: () => void;
  boardRef?: React.RefObject<HTMLDivElement>;
  effects?: VersusBoardEffects;
}

const VersusSide: React.FC<VersusSideProps> = ({
  side,
  cellSize,
  showCountdown = false,
  onCountdownComplete,
  boardRef,
  effects = {}
}) => {
  const { t } = useI18n();
  return (
    <section className="versus-side">
      <div className={`versus-side-title versus-side-title--${side.tone}`}>
        {side.label}
      </div>

      <div className="versus-compact-stats">
        <span>{t('Score')} <strong>{side.score.toLocaleString()}</strong></span>
        <span>{t('Lines')} <strong>{side.lines}</strong></span>
      </div>

      <div className="versus-side-body">
        <div className="side-panel versus-side-panel">
          <HoldDisplay piece={side.hold} canHold={side.canHold} />
          <div className="panel-card versus-stats-card">
            <div className="versus-stat-row">
              <span>{t('Score')}</span>
              <strong>{side.score.toLocaleString()}</strong>
            </div>
            <div className="versus-stat-row">
              <span>{t('Lines')}</span>
              <strong>{side.lines}</strong>
            </div>
            <div className="versus-stat-row">
              <span>{t('Combo')}</span>
              <strong style={{ color: side.combo > 0 ? 'var(--accent-cyan)' : undefined }}>
                {side.combo > 0 ? `x${side.combo}` : '—'}
              </strong>
            </div>
            <div className="versus-stat-row">
              <span>B2B</span>
              <strong style={{ color: side.b2b ? 'var(--accent-pink)' : undefined }}>
                {side.b2b ? (side.b2bChain > 1 ? `x${side.b2bChain}` : '✓') : '—'}
              </strong>
            </div>
          </div>
        </div>

        <div
          className="versus-board-wrap"
          ref={boardRef}
          style={{
            borderRadius: 'var(--radius-md)',
            boxShadow: effects.color
              ? `0 0 0 3px ${effects.color}, 0 0 30px ${effects.color}`
              : 'none',
            transition: 'box-shadow 200ms ease'
          }}
        >
          <PlayfieldCanvas
            engine={side.engine}
            incomingGarbage={side.garbage}
            cellSize={cellSize}
            hideGhost={effects.hideGhost}
          />

          {effects.blind && (
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: '16% 0',
                pointerEvents: 'none',
                borderRadius: 'inherit',
                background: 'repeating-linear-gradient(0deg, rgba(2, 6, 23, 0.9) 0 13px, rgba(15, 23, 42, 0.35) 13px 22px), repeating-linear-gradient(90deg, transparent 0 22px, rgba(2, 6, 23, 0.72) 22px 38px)',
                backdropFilter: 'blur(1.5px)',
                opacity: 0.92
              }}
            />
          )}

          {effects.banner && (
            <div
              key={effects.banner.id}
              role="status"
              aria-live="polite"
              style={{
                position: 'absolute',
                left: '50%',
                top: '10%',
                transform: 'translateX(-50%)',
                zIndex: 3,
                pointerEvents: 'none',
                padding: '0.3rem 0.6rem',
                borderRadius: '999px',
                background: effects.banner.background,
                color: effects.banner.color,
                border: `1px solid ${effects.banner.color}`,
                boxShadow: '0 5px 22px rgba(0, 0, 0, 0.45)',
                fontSize: '0.72rem',
                fontWeight: 800,
                lineHeight: 1.2,
                textAlign: 'center',
                maxWidth: 'calc(100% - 0.5rem)'
              }}
            >
              {effects.banner.label}
            </div>
          )}

          {showCountdown && onCountdownComplete && (
            <CountdownOverlay active={showCountdown} onComplete={onCountdownComplete} />
          )}
        </div>

        <div className="side-panel versus-side-panel">
          <QueueDisplay
            queue={side.queue}
            count={6}
            previewSize={Math.max(18, Math.min(64, Math.round(cellSize * 2)))}
          />
        </div>
      </div>
    </section>
  );
};
