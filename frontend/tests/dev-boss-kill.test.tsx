// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDevKill } from '../src/hooks/useDevBossKill';

const Harness: React.FC<{ enabled: boolean; onKill: () => void }> = ({ enabled, onKill }) => {
  useDevKill(enabled, onKill);
  return <input data-testid="text-input" />;
};

describe('useDevKill', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    root = null;
    container?.remove();
    container = null;
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  const renderHarness = (enabled: boolean, onKill: () => void) => {
    act(() => {
      root!.render(<Harness enabled={enabled} onKill={onKill} />);
    });
  };

  it('runs the kill action when K is pressed', () => {
    const onKill = vi.fn();
    renderHarness(true, onKill);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true }));
    });

    expect(onKill).toHaveBeenCalledTimes(1);
  });

  it('ignores K while typing in an input', () => {
    const onKill = vi.fn();
    renderHarness(true, onKill);

    act(() => {
      container!.querySelector<HTMLInputElement>('[data-testid="text-input"]')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true }));
    });

    expect(onKill).not.toHaveBeenCalled();
  });

  it('does nothing when disabled or when another key is pressed', () => {
    const onKill = vi.fn();
    renderHarness(false, onKill);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }));
    });

    expect(onKill).not.toHaveBeenCalled();
  });
});
