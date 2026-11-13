// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VersusArena, type VersusArenaSide } from '../src/components/game/VersusArena';
import type { GameEngine } from '../src/game/engine/gameEngine';

vi.mock('../src/i18n/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}));

vi.mock('../src/components/game/PlayfieldCanvas', () => ({
  PlayfieldCanvas: ({ hideGhost }: { hideGhost?: boolean }) => (
    <div data-testid="playfield" data-hide-ghost={hideGhost ? 'true' : 'false'} />
  )
}));

vi.mock('../src/components/game/HoldDisplay', () => ({
  HoldDisplay: () => <div data-testid="hold" />
}));

vi.mock('../src/components/game/QueueDisplay', () => ({
  QueueDisplay: () => <div data-testid="queue" />
}));

const side = (label: string): VersusArenaSide => ({
  label,
  tone: 'cyan',
  hold: null,
  canHold: true,
  queue: [],
  score: 0,
  lines: 0,
  combo: 0,
  b2b: false,
  b2bChain: 0,
  engine: {} as GameEngine,
  garbage: 0
});

describe('VersusArena boss board effects', () => {
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

  it('renders the shared board glow, blind overlay and attack banner', () => {
    const arenaRef = React.createRef<HTMLDivElement>();
    const playerBoardRef = React.createRef<HTMLDivElement>();

    act(() => {
      root!.render(
        <VersusArena
          arenaRef={arenaRef}
          playerBoardRef={playerBoardRef}
          player={side('Player 1')}
          opponent={side('Player 2')}
          cellSize={24}
          vsLabel="CO-OP"
          playerEffects={{
            color: 'var(--accent-purple)',
            blind: true,
            banner: {
              id: 1,
              label: 'Rotation Locked',
              color: 'var(--accent-purple)',
              background: 'rgba(168, 85, 247, 0.2)'
            }
          }}
          opponentEffects={{ color: 'var(--accent-purple)', blind: true }}
        />
      );
    });

    const boards = container!.querySelectorAll<HTMLElement>('.versus-board-wrap');
    expect(boards).toHaveLength(2);
    expect(playerBoardRef.current).toBe(boards[0]);
    expect(boards[0].style.boxShadow).toContain('var(--accent-purple)');
    expect(boards[1].style.boxShadow).toContain('var(--accent-purple)');

    const banner = boards[0].querySelector('[role="status"]');
    expect(banner?.textContent).toBe('Rotation Locked');
    expect(boards[0].querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(boards[1].querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('hides the ghost on both boards while the ghostless attack is active', () => {
    act(() => {
      root!.render(
        <VersusArena
          arenaRef={React.createRef<HTMLDivElement>()}
          player={side('Player 1')}
          opponent={side('Player 2')}
          cellSize={24}
          playerEffects={{ hideGhost: true }}
          opponentEffects={{ hideGhost: true }}
        />
      );
    });

    const boards = container!.querySelectorAll('[data-testid="playfield"]');
    expect(boards).toHaveLength(2);
    expect([...boards].every((board) => board.getAttribute('data-hide-ghost') === 'true')).toBe(true);
  });
});
