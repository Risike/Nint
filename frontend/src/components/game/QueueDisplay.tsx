import React, { useEffect, useRef } from 'react';
import { TetrominoType } from '../../game/engine/constants';
import { CanvasRenderer } from '../../game/rendering/canvasRenderer';

interface QueueDisplayProps {
  queue: TetrominoType[];
  count?: number;
  previewSize?: number;
}

export const QueueDisplay: React.FC<QueueDisplayProps> = ({ queue, count = 5, previewSize = 64 }) => {
  const pieces = queue.slice(0, count);

  return (
    <div className="panel-card" style={{ gap: '0.4rem' }}>
      <div className="panel-title">Next</div>
      {pieces.map((type, idx) => (
        <PreviewSlot key={idx} piece={type} size={previewSize} />
      ))}
    </div>
  );
};

const PreviewSlot: React.FC<{ piece: TetrominoType; size: number }> = ({ piece, size }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      CanvasRenderer.renderPreview(canvasRef.current, piece, 16);
    }
  }, [piece]);

  return <canvas ref={canvasRef} style={{ width: `${size}px`, height: `${size}px` }} />;
};
