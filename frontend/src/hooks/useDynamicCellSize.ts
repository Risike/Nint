import { useState, useLayoutEffect, RefObject } from 'react';

const VERSUS_ARENA_HEADER_FALLBACK = 44; // fixed title slot + its gap before layout
const VERSUS_ARENA_VERTICAL_SAFETY = 6; // board borders and rounding
const VERSUS_BOTTOM_GAP = 12; // keep the last row clear of the footer
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
  containerRef?: RefObject<HTMLElement>,
  reservedVerticalSpace: number = 0,
  reservedWidth: number = VERSUS_FIXED_WIDTH
): number {
  const calculateSize = (): number => {
    if (typeof window === 'undefined') return isVersus ? 24 : 28;

    const arena = containerRef?.current;
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    if (isVersus) {
      let headerHeight = VERSUS_ARENA_HEADER_FALLBACK;
      if (arena) {
        const title = arena.querySelector<HTMLElement>('.versus-side-title');
        const titleHeight = title?.getBoundingClientRect().height || 0;
        const side = title?.parentElement;
        const gapValue = side ? (window.getComputedStyle(side).rowGap || window.getComputedStyle(side).gap) : '';
        const parsedGap = Number.parseFloat(gapValue);
        const sideGap = Number.isFinite(parsedGap) ? parsedGap : VERSUS_ARENA_HEADER_FALLBACK / 5;
        if (titleHeight > 0) {
          headerHeight = titleHeight + sideGap;
        }
      }

      // The arena is a flex child, so its height can briefly grow with the
      // board it contains. Also bound it by the real space between its top
      // edge and the footer, otherwise the last rows are clipped below the
      // viewport during resize.
      const arenaTop = arena?.getBoundingClientRect().top ?? 0;
      const footerHeight = document
        .querySelector<HTMLElement>('.app-container--game footer')
        ?.getBoundingClientRect().height ?? 0;
      const viewportAvailable = arena && arenaTop > 0
        ? Math.max(0, vh - arenaTop - footerHeight - VERSUS_BOTTOM_GAP)
        : Math.max(0, vh - 300);
      const arenaAvailable = arena && arena.clientHeight > 0
        ? arena.clientHeight
        : viewportAvailable;
      const availableHeight = Math.max(
        0,
        Math.min(arenaAvailable, viewportAvailable) - headerHeight - VERSUS_ARENA_VERTICAL_SAFETY
      );
      // The initial render happens before the arena ref exists. Use the same
      // capped content width as .main-content (1440px minus its 2×16px padding)
      // so a large viewport never starts with an oversized board that pushes
      // the side rails off-screen.
      const contentWidth = Math.min(vw, MAIN_CONTENT_MAX_WIDTH) - MAIN_CONTENT_HORIZONTAL_PADDING;
      const availableWidth = arena && arena.clientWidth > 0
        ? Math.max(0, arena.clientWidth - reservedWidth) / 2
        : Math.max(0, contentWidth - reservedWidth) / 2;

      const heightCell = Math.floor(availableHeight / 20);
      const widthCell = Math.floor(availableWidth / 10);
      const size = Math.min(heightCell, widthCell);

      return Math.max(8, Math.min(56, size));
    } else {
      // Solo: 1 centered board flanked by Hold and Queue panels
      // Vertical space overhead: navbar (~56px) + main padding (~32px) + top header bar (~45px) + footer (~60px) ~ 190px
      // reservedVerticalSpace accounts for mode-specific UI such as the Boss HUD.
      const availableHeight = Math.max(460, vh - 190 - reservedVerticalSpace);
      const heightCell = Math.floor(availableHeight / 20);
      const availableWidth = Math.max(300, vw - 280);
      const widthCell = Math.floor(availableWidth / 10);

      const size = Math.min(heightCell, widthCell);
      // Boss mode reserves room for its HUD, so allow a slightly smaller board
      // instead of clipping the bottom of the playfield.
      const minimum = reservedVerticalSpace > 0 ? 18 : 26;
      return Math.max(minimum, Math.min(54, size));
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

    let observer: ResizeObserver | null = null;
    let observedArena: HTMLElement | null = null;

    // The arena can mount after this hook (the co-op picker is shown first and
    // the game arena only appears once the round starts), and it can unmount
    // again between rounds. Poll the ref so the observer follows it instead of
    // staying bound to a null ref from the first render.
    const syncArenaObserver = () => {
      const arena = containerRef?.current ?? null;
      if (arena === observedArena) return;

      observer?.disconnect();
      observer = null;
      observedArena = arena;
      if (!arena) return;

      handleResize();
      if (typeof ResizeObserver === 'undefined') return;
      observer = new ResizeObserver(handleResize);
      observer.observe(arena);
      const title = arena.querySelector<HTMLElement>('.versus-side-title');
      if (title) observer.observe(title);
    };

    syncArenaObserver();
    const arenaPoll = isVersus ? window.setInterval(syncArenaObserver, 200) : null;

    // A resize event can fire before the browser has committed the new
    // viewport height, especially when going from 720p to 1440p. Re-measure on
    // the next frame and after the layout settles as well.
    let resizeFrame = 0;
    let resizeTimer: number | null = null;
    const handleViewportResize = () => {
      handleResize();
      cancelAnimationFrame(resizeFrame);
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      resizeFrame = requestAnimationFrame(handleResize);
      resizeTimer = window.setTimeout(handleResize, 160);
    };

    window.addEventListener('resize', handleViewportResize);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(settleTimer);
      cancelAnimationFrame(resizeFrame);
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      if (arenaPoll !== null) window.clearInterval(arenaPoll);
      observer?.disconnect();
      window.removeEventListener('resize', handleViewportResize);
    };
  }, [isVersus, containerRef, reservedVerticalSpace, reservedWidth]);

  return cellSize;
}
