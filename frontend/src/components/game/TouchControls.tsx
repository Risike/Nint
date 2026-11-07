import React from 'react';
import { ArrowLeft, ArrowRight, ArrowDown, ArrowUp, RotateCcw, RotateCw, ChevronsDown, Shield } from 'lucide-react';
import { GameEngine } from '../../game/engine/gameEngine';

interface TouchControlsProps {
  engine: GameEngine;
}

export const TouchControls: React.FC<TouchControlsProps> = ({ engine }) => {
  return (
    <div className="touch-controls">
      {/* Left side: Navigation / Drops */}
      <div className="touch-dpad">
        <button className="touch-btn" onClick={() => engine.hold()} title="Hold">
          <Shield size={20} />
        </button>
        <button className="touch-btn accent" onClick={() => engine.hardDrop()} title="Hard Drop">
          <ChevronsDown size={22} />
        </button>
        <button className="touch-btn" onClick={() => engine.rotateCW()} title="Rotate CW">
          <RotateCw size={20} />
        </button>

        <button className="touch-btn" onClick={() => engine.moveLeft()} title="Move Left">
          <ArrowLeft size={22} />
        </button>
        <button className="touch-btn" onClick={() => engine.softDrop()} title="Soft Drop">
          <ArrowDown size={22} />
        </button>
        <button className="touch-btn" onClick={() => engine.moveRight()} title="Move Right">
          <ArrowRight size={22} />
        </button>
      </div>

      {/* Right side: Rotations */}
      <div className="touch-actions">
        <button className="touch-btn" onClick={() => engine.rotateCCW()} title="Rotate CCW">
          <RotateCcw size={20} />
        </button>
        <button className="touch-btn" onClick={() => engine.rotateCW()} title="Rotate CW">
          <RotateCw size={20} />
        </button>
      </div>
    </div>
  );
};
