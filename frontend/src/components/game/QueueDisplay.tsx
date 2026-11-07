import React, { useEffect, useRef } from 'react';
import { TetrominoType } from '../../game/engine/constants';
import { CanvasRenderer } from '../../game/rendering/canvasRenderer';

interface QueueDisplayProps {
  queue: TetrominoType[];
  count?: number;
}

export const QueueDisplay: React.FC<QueueDisplayProps> = ({ queue, count = 5 }) => {
  const pieces = queue.slice(0, count);

  return (
    <div className="panel-card" style={{ gap: '0.4rem' }}>
      <div className="panel-title">Next</div>
      {pieces.map((type, idx) => (
        <PreviewSlot key={idx} piece={type} />
      ))}
    </div>
  );
};

const PreviewSlot: React.FC<{ piece: TetrominoType }> = ({ piece }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      CanvasRenderer.renderPreview(canvasRef.current, piece, 16);
    }
  }, [piece]);

  return <canvas ref={canvasRef} style={{ width: '64px', height: '64px' }} />;
};
