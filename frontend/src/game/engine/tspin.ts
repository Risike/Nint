import { BOARD_TOTAL_HEIGHT, BOARD_WIDTH, RotationState } from './constants';

export type TSpinType = 'none' | 'mini' | 'regular';

export class TSpinDetector {
  public static checkTSpin(
    board: (string | null)[][],
    tPieceX: number,
    tPieceY: number,
    rotation: RotationState,
    lastActionWasRotation: boolean,
    lastKickIndex: number
  ): TSpinType {
    if (!lastActionWasRotation) {
      return 'none';
    }

    // T center is at (x + 1, y + 1)
    const corners = [
      { x: tPieceX, y: tPieceY },         // Top-Left (0)
      { x: tPieceX + 2, y: tPieceY },     // Top-Right (1)
      { x: tPieceX + 2, y: tPieceY + 2 }, // Bottom-Right (2)
      { x: tPieceX, y: tPieceY + 2 }      // Bottom-Left (3)
    ];

    let occupiedCorners = 0;
    const isOccupied = corners.map(pt => {
      // Out of bounds counts as occupied (wall/floor)
      if (pt.x < 0 || pt.x >= BOARD_WIDTH || pt.y >= BOARD_TOTAL_HEIGHT) {
        occupiedCorners++;
        return true;
      }
      // Buffer above ceiling (y < 0) does not count as wall
      if (pt.y < 0) {
        return false;
      }
      if (board[pt.y][pt.x] !== null) {
        occupiedCorners++;
        return true;
      }
      return false;
    });

    if (occupiedCorners < 3) {
      return 'none';
    }

    // Determine front corners based on rotation
    // 0 = pointing UP -> front corners: TL (0) and TR (1)
    // 1 = pointing RIGHT -> front corners: TR (1) and BR (2)
    // 2 = pointing DOWN -> front corners: BR (2) and BL (3)
    // 3 = pointing LEFT -> front corners: BL (3) and TL (0)
    let frontCornersOccupied = 0;
    switch (rotation) {
      case 0:
        if (isOccupied[0]) frontCornersOccupied++;
        if (isOccupied[1]) frontCornersOccupied++;
        break;
      case 1:
        if (isOccupied[1]) frontCornersOccupied++;
        if (isOccupied[2]) frontCornersOccupied++;
        break;
      case 2:
        if (isOccupied[2]) frontCornersOccupied++;
        if (isOccupied[3]) frontCornersOccupied++;
        break;
      case 3:
        if (isOccupied[3]) frontCornersOccupied++;
        if (isOccupied[0]) frontCornersOccupied++;
        break;
    }

    // 5th kick (kickIndex === 4 in 0-indexed array) in SRS is the wall-kick upgrade exception
    if (frontCornersOccupied === 2 || lastKickIndex === 4) {
      return 'regular';
    }

    return 'mini';
  }
}
