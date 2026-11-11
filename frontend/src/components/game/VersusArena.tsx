import React from 'react';
import { GameEngine } from '../../game/engine/gameEngine';
import { TetrominoType } from '../../game/engine/constants';
import { PlayfieldCanvas } from './PlayfieldCanvas';
import { HoldDisplay } from './HoldDisplay';
import { QueueDisplay } from './QueueDisplay';
import { CountdownOverlay } from './CountdownOverlay';

export type VersusTone = 'cyan' | 'orange' | 'purple';

export interface VersusArenaSide {
  label: React.ReactNode;
  tone: VersusTone;
  hold: TetrominoType | null;
  canHold: boolean;
  queue: TetrominoType[];
  score: number;
  lines: number;
  engine: GameEngine;
  garbage: number;
}

interface VersusArenaProps {
  arenaRef: React.RefObject<HTMLDivElement>;
  player: VersusArenaSide;
  opponent: VersusArenaSide;
  cellSize: number;
  vsTone?: 'red' | 'green';
  isCountingDown?: boolean;
  onCountdownComplete?: () => void;
  overlay?: React.ReactNode;
}

export const VersusArena: React.FC<VersusArenaProps> = ({
  arenaRef,
  player,
  opponent,
  cellSize,
  vsTone = 'red',
  isCountingDown = false,
  onCountdownComplete,
  overlay
}) => {
  return (
    <div className="versus-arena" ref={arenaRef}>
      <VersusSide side={player} cellSize={cellSize} showCountdown={isCountingDown} onCountdownComplete={onCountdownComplete} />

      <div className={`versus-vs versus-vs--${vsTone}`}>VS</div>

      <VersusSide side={opponent} cellSize={cellSize} />

      {overlay}
    </div>
  );
};

interface VersusSideProps {
  side: VersusArenaSide;
  cellSize: number;
  showCountdown?: boolean;
  onCountdownComplete?: () => void;
}

const VersusSide: React.FC<VersusSideProps> = ({
  side,
  cellSize,
  showCountdown = false,
  onCountdownComplete
}) => {
  return (
    <section className="versus-side">
      <div className={`versus-side-title versus-side-title--${side.tone}`}>
        {side.label}
      </div>

      <div className="versus-side-body">
        <div className="side-panel versus-side-panel">
          <HoldDisplay piece={side.hold} canHold={side.canHold} />
          <div className="panel-card versus-stats-card">
            <div className="versus-stat-row">
              <span>Score</span>
              <strong>{side.score.toLocaleString()}</strong>
            </div>
            <div className="versus-stat-row">
              <span>Lines</span>
              <strong>{side.lines}</strong>
            </div>
          </div>
        </div>

        <div className="versus-board-wrap">
          <PlayfieldCanvas engine={side.engine} incomingGarbage={side.garbage} cellSize={cellSize} />
          {showCountdown && onCountdownComplete && (
            <CountdownOverlay active={showCountdown} onComplete={onCountdownComplete} />
          )}
        </div>

        <div className="side-panel versus-side-panel">
          <QueueDisplay
            queue={side.queue}
            count={5}
            previewSize={Math.max(18, Math.min(64, Math.round(cellSize * 2)))}
          />
        </div>
      </div>
    </section>
  );
};
