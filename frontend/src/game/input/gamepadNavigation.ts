interface VersusGamepadState {
  isSelectingDifficulty: boolean;
  isGameOverOpen: boolean;
  isPaused: boolean;
  playerState: string;
  isCountingDown: boolean;
}

/**
 * Gameplay input is exclusive only while the match is actually running.
 * Pausing releases the global gamepad navigation so LB/RB can switch modes.
 */
export function isVersusGamepadGameplayActive({
  isSelectingDifficulty,
  isGameOverOpen,
  isPaused,
  playerState,
  isCountingDown
}: VersusGamepadState): boolean {
  return (
    !isSelectingDifficulty &&
    !isGameOverOpen &&
    !isPaused &&
    (playerState === 'playing' || isCountingDown)
  );
}
