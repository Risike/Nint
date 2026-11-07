import React, { useEffect, useRef } from 'react';
import { TetrominoType } from '../../game/engine/constants';
import { CanvasRenderer } from '../../game/rendering/canvasRenderer';

interface HoldDisplayProps {
  piece: TetrominoType | null;
  canHold?: boolean;
}

export const HoldDisplay: React.FC<HoldDisplayProps> = ({ piece, canHold = true }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      CanvasRenderer.renderPreview(canvasRef.current, piece, 18);
    }
  }, [piece]);

  return (
    <div className="panel-card" style={{ opacity: canHold ? 1 : 0.5 }}>
      <div className="panel-title">Hold</div>
      <canvas ref={canvasRef} style={{ width: '72px', height: '72px' }} />
    </div>
  );
};
