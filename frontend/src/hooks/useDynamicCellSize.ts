import { useState, useLayoutEffect, RefObject } from 'react';

const VERSUS_ARENA_HEADER_HEIGHT = 30; // side title row + its gap
const VERSUS_FIXED_WIDTH = 600; // four side panels, the VS badge and all gaps
const MAIN_CONTENT_MAX_WIDTH = 1440;
const MAIN_CONTENT_HORIZONTAL_PADDING = 32;

/**
 * Computes the largest cell size that fits the space left for the playfield.
 * For versus pages the arena is measured directly, so the boards fill the
 * viewport between the navbar and footer instead of relying on estimates.
 */
export function useDynamicCellSize(
  isVersus: boolean = false,
  containerRef?: RefObject<HTMLElement>
): number {
  const calculateSize = (): number => {
    if (typeof window === 'undefined') return isVersus ? 24 : 28;

    const arena = containerRef?.current;
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    if (isVersus) {
      const availableHeight = arena && arena.clientHeight > 0
        ? Math.max(0, arena.clientHeight - VERSUS_ARENA_HEADER_HEIGHT)
        : Math.max(0, vh - 300);
      // The initial render happens before the arena ref exists. Use the same
      // capped content width as .main-content (1440px minus its 2×16px padding)
      // so a large viewport never starts with an oversized board that pushes
      // the side rails off-screen.
      const contentWidth = Math.min(vw, MAIN_CONTENT_MAX_WIDTH) - MAIN_CONTENT_HORIZONTAL_PADDING;
      const availableWidth = arena && arena.clientWidth > 0
        ? Math.max(0, arena.clientWidth - VERSUS_FIXED_WIDTH) / 2
        : Math.max(0, contentWidth - VERSUS_FIXED_WIDTH) / 2;

      const heightCell = Math.floor(availableHeight / 20);
      const widthCell = Math.floor(availableWidth / 10);
      const size = Math.min(heightCell, widthCell);

      return Math.max(8, Math.min(56, size));
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

  useLayoutEffect(() => {
    const handleResize = () => {
      setCellSize(calculateSize());
    };

    // Measure before paint, then once more after the browser has settled its
    // final layout. This avoids keeping a board sized from the initial render.
    handleResize();
    const raf = requestAnimationFrame(handleResize);
    const settleTimer = window.setTimeout(handleResize, 120);

    const arena = containerRef?.current;
    let observer: ResizeObserver | null = null;

    if (arena && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(handleResize);
      observer.observe(arena);
    }

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(settleTimer);
      observer?.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [isVersus, containerRef]);

  return cellSize;
}
