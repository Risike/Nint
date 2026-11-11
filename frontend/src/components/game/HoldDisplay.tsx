import React, { useEffect, useRef } from 'react';
import { TetrominoType } from '../../game/engine/constants';
import { CanvasRenderer } from '../../game/rendering/canvasRenderer';
import { useI18n } from '../../i18n/useI18n';
import { useAuth } from '../../context/AuthContext';
import { normalizePieceSkin } from '../../game/rendering/pieceSkins';

interface HoldDisplayProps {
  piece: TetrominoType | null;
  canHold?: boolean;
}

export const HoldDisplay: React.FC<HoldDisplayProps> = ({ piece, canHold = true }) => {
  const { t } = useI18n();
  const { user } = useAuth();
  const pieceSkin = normalizePieceSkin(user?.cosmetics?.piece_skin);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      CanvasRenderer.renderPreview(canvasRef.current, piece, 18, pieceSkin);
    }
  }, [piece, pieceSkin]);

  return (
    <div className="panel-card" style={{ opacity: canHold ? 1 : 0.5 }}>
      <div className="panel-title">{t('Hold')}</div>
      <canvas ref={canvasRef} style={{ width: '72px', height: '72px' }} />
    </div>
  );
};
