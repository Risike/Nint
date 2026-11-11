import React, { useEffect, useRef } from 'react';
import { GameEngine } from '../../game/engine/gameEngine';
import { BOARD_VISIBLE_HEIGHT, BOARD_WIDTH } from '../../game/engine/constants';
import { CanvasRenderer } from '../../game/rendering/canvasRenderer';
import { useSettings } from '../../context/SettingsContext';

interface PlayfieldCanvasProps {
  engine: GameEngine;
  incomingGarbage?: number;
  cellSize: number;
}

export const PlayfieldCanvas: React.FC<PlayfieldCanvasProps> = ({
  engine,
  incomingGarbage = 0,
  cellSize
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const { settings } = useSettings();

  useEffect(() => {
    rendererRef.current = new CanvasRenderer({
      cellSize,
      showGhost: settings.ghostPiece,
      showGrid: true,
      colorblindMode: settings.colorblindMode,
      theme: settings.theme
    });
  }, [cellSize, settings.ghostPiece, settings.colorblindMode, settings.theme]);

  // Hook line clear particle effects to engine line clear events
  useEffect(() => {
    const originalOnLineClear = engine.events.onLineClear;
    engine.events.onLineClear = (result) => {
      if (rendererRef.current && canvasRef.current) {
        if (result.text) {
          const midX = (10 * cellSize) / 2;
          const midY = (20 * cellSize) / 2;
          const color = result.text.includes('TETRIS') || result.text.includes('B2B') ? '#ec4899' : '#38bdf8';
          rendererRef.current.particleSystem.addFloatingText(result.text, midX, midY, color, 22);
        }

        // Emit clear particles across clearing rows
        if (engine.clearingRows.length > 0) {
          for (const row of engine.clearingRows) {
            const visibleRow = row - 20; // BOARD_BUFFER_HEIGHT
            if (visibleRow >= 0 && visibleRow < 20) {
              const y = (visibleRow + 0.5) * cellSize;
              const color = result.linesCleared === 4 ? '#ec4899' : '#06b6d4';
              rendererRef.current.particleSystem.addClearParticles(y, 10 * cellSize, color);
            }
          }
        }
      }
      originalOnLineClear?.(result);
    };

    return () => {
      engine.events.onLineClear = originalOnLineClear;
    };
  }, [engine, cellSize]);

  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const deltaMs = currentTime - lastTime;
      lastTime = currentTime;

      if (canvasRef.current && rendererRef.current) {
        rendererRef.current.particleSystem.update(deltaMs);
        rendererRef.current.render(canvasRef.current, engine, incomingGarbage);
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [engine, incomingGarbage]);

  return (
    <div className="board-container">
      <canvas
        ref={canvasRef}
        className="board-canvas"
        style={{
          width: `${BOARD_WIDTH * cellSize}px`,
          height: `${BOARD_VISIBLE_HEIGHT * cellSize}px`
        }}
      />
    </div>
  );
};
