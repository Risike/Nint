import { useEffect, useRef } from 'react';

/**
 * Development-only shortcut: pressing K triggers the current kill action.
 * It is compiled out of production builds through import.meta.env.DEV.
 */
export function useDevKill(enabled: boolean, onKill: () => void): void {
  const onKillRef = useRef(onKill);
  onKillRef.current = onKill;

  useEffect(() => {
    if (!import.meta.env.DEV || !enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || event.repeat) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || target?.isContentEditable
      ) {
        return;
      }

      event.preventDefault();
      onKillRef.current();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);
}
