import React, { useEffect, useRef } from 'react';
import { TetrominoType } from '../../game/engine/constants';
import { CanvasRenderer } from '../../game/rendering/canvasRenderer';
import { useI18n } from '../../i18n/useI18n';
import { useAuth } from '../../context/AuthContext';
import { normalizePieceSkin, PieceSkin } from '../../game/rendering/pieceSkins';

interface QueueDisplayProps {
  queue: TetrominoType[];
  count?: number;
  previewSize?: number;
}

export const QueueDisplay: React.FC<QueueDisplayProps> = ({ queue, count = 6, previewSize = 64 }) => {
  const { t } = useI18n();
  const { user } = useAuth();
  const pieceSkin = normalizePieceSkin(user?.cosmetics?.piece_skin);
  const pieces = queue.slice(0, count);

  return (
    <div className="panel-card" style={{ gap: '0.4rem' }}>
      <div className="panel-title">{t('Next')}</div>
      {pieces.map((type, idx) => (
        <PreviewSlot key={idx} piece={type} size={previewSize} pieceSkin={pieceSkin} />
      ))}
    </div>
  );
};

const PreviewSlot: React.FC<{ piece: TetrominoType; size: number; pieceSkin: PieceSkin }> = ({ piece, size, pieceSkin }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      CanvasRenderer.renderPreview(canvasRef.current, piece, 16, pieceSkin);
    }
  }, [piece, pieceSkin]);

  return <canvas ref={canvasRef} style={{ width: `${size}px`, height: `${size}px` }} />;
};
