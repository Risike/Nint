import { useState, useEffect } from 'react';

/**
 * Dynamically computes optimal tetromino cell size based on viewport height,
 * allowing the playfield to scale to the available window height
 * without altering UI element positions.
 */
export function useDynamicCellSize(isVersus: boolean = false): number {
  const calculateSize = (): number => {
    if (typeof window === 'undefined') return isVersus ? 24 : 28;

    const vh = window.innerHeight;
    const vw = window.innerWidth;

    if (isVersus) {
      // 2 boards side-by-side: MUST fit comfortably without horizontal overflow
      // Vertical space overhead: navbar (~56px) + padding (~24px) + top bar (~48px) + header (~28px) + footer (~52px) ≈ 208px
      const availableHeight = Math.max(340, vh - 210);
      const heightCell = Math.floor(availableHeight / 20);

      // Horizontal per-player: Hold panel (~100px) + Queue panel (~80px) + gaps (24px) = 204px
      // Both players: 2 × 204 = 408px, VS badge + gaps (~100px), page padding (~32px) = 540px total overhead
      const availableWidth = Math.max(360, vw - 540);
      const widthCell = Math.floor(availableWidth / 20);

      const size = Math.min(heightCell, widthCell);
      return Math.max(18, Math.min(38, size));
    } else {
      // Solo: 1 centered board flanked by Hold and Queue panels
      // Vertical space overhead: navbar (~56px) + main padding (~32px) + top header bar (~45px) + footer (~60px) ~ 190px
      const availableHeight = Math.max(460, vh - 190);
      const heightCell = Math.floor(availableHeight / 20);
      const availableWidth = Math.max(300, vw - 280);
      const widthCell = Math.floor(availableWidth / 10);

      const size = Math.min(heightCell, widthCell);
      return Math.max(26, Math.min(54, size));
    }
  };

  const [cellSize, setCellSize] = useState<number>(calculateSize);

  useEffect(() => {
    const handleResize = () => {
      setCellSize(calculateSize());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isVersus]);

  return cellSize;
}
