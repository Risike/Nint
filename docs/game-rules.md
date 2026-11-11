# Nint Game Rules & Mechanics

## 1. Playfield
- Standard 10 columns by 20 visible rows.
- 20 buffer rows above the visible field for rotation kicks and garbage headroom (40 rows total). Pieces spawn at the top of the visible field.
- Seven standard tetrominoes: I (Cyan), J (Blue), L (Orange), O (Yellow), S (Green), T (Purple), Z (Red).
- 7-Bag randomizer: Every cycle of 7 pieces contains exactly one of each tetromino shuffled via deterministic PRNG.

## 2. Handling & Timings
- **DAS (Delayed Auto Shift)**: Default 167ms before automatic lateral shift begins (configurable 0-500ms).
- **ARR (Auto Repeat Rate)**: Default 33ms repeat frequency (configurable 0-200ms).
- **Soft Drop**: Drops the piece at `gravity / soft-drop-factor` (default factor 20) with +1 point per cell dropped.
- **Hard Drop**: Instantly locks piece at ghost position with +2 points per cell dropped.
- **Lock Delay**: 500ms delay once resting on a surface. Resets up to 15 moves or rotations. If the piece reaches a new lowest row, the reset allowance resets.

## 3. Super Rotation System (SRS)
- 4 rotation states: 0 (Spawn), 1 (90° CW), 2 (180°), 3 (270° CCW / 90° CCW).
- Wall kicks: Tested across standard 5 kick tests. If a kick test is valid and unblocked, rotation succeeds immediately.

## 4. T-Spin Detection (3-Corner Rule)
- Piece must be type `T`.
- Last successful action must be a rotation.
- At least 3 of the 4 diagonal corners around the center `(x+1, y+1)` must be occupied (by locked minos or board walls/floor).
- If 2 front corners are occupied or the 5th kick was used: **Regular T-Spin**.
- If only 1 front corner is occupied: **Mini T-Spin**.

## 5. Scoring Table
| Action | Points |
| :--- | :--- |
| Single | 100 × level |
| Double | 300 × level |
| Triple | 500 × level |
| Tetris | 800 × level |
| Mini T-Spin (no lines) | 100 × level |
| T-Spin (no lines) | 400 × level |
| Mini T-Spin Single | 200 × level |
| T-Spin Single | 800 × level |
| T-Spin Double | 1200 × level |
| T-Spin Triple | 1600 × level |
| Back-to-Back (B2B) | Clear score × 1.5 |
| Combo Bonus | 50 × combo count × level |
| Soft Drop | 1 pt / cell |
| Hard Drop | 2 pts / cell |
| Perfect Clear | 800 (1L), 1200 (2L), 1800 (3L), 2000 (Tetris), 3200 (B2B Tetris) × level |

## 6. Garbage & Versus Combat
| Attack Clear | Garbage Sent |
| :--- | :--- |
| Single | 0 lines |
| Double | 1 line |
| Triple | 2 lines |
| Tetris | 4 lines |
| T-Spin Single | 2 lines |
| T-Spin Double | 4 lines |
| T-Spin Triple | 6 lines |
| Back-to-Back Bonus | +1 line |
| Perfect Clear Bonus | +10 lines |
| Combo Ladder | 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5... |

- **Garbage Cancellation**: An outbound attack immediately reduces pending incoming garbage line-for-line before any garbage can penetrate.
- **Hole Generation**: Incoming garbage enters from the bottom with 1 hole per line.
