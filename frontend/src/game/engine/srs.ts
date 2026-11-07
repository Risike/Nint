import { Point, RotationState, SRS_KICKS_I, SRS_KICKS_JLSTZ, TetrominoType } from './constants';

export class SRS {
  public static getKickOffsets(
    type: TetrominoType,
    fromState: RotationState,
    toState: RotationState
  ): Point[] {
    if (type === 'O') {
      return [{ x: 0, y: 0 }];
    }

    const key = `${fromState}->${toState}`;
    if (type === 'I') {
      return SRS_KICKS_I[key] || [{ x: 0, y: 0 }];
    }

    return SRS_KICKS_JLSTZ[key] || [{ x: 0, y: 0 }];
  }
}
