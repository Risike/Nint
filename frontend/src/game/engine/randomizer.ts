import { TetrominoType } from './constants';

export class Randomizer {
  private queue: TetrominoType[] = [];
  private rng: () => number;

  constructor(seed?: number) {
    if (seed !== undefined) {
      this.rng = Randomizer.createMulberry32(seed);
    } else {
      this.rng = Math.random;
    }
    // Prefill queue with at least 14 pieces (2 bags)
    this.refillQueue();
    this.refillQueue();
  }

  // Mulberry32 32-bit deterministic PRNG
  public static createMulberry32(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  private generateBag(): TetrominoType[] {
    const pieces: TetrominoType[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
    // Fisher-Yates shuffle using deterministic RNG
    for (let i = pieces.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }
    return pieces;
  }

  private refillQueue() {
    const newBag = this.generateBag();
    this.queue.push(...newBag);
  }

  public next(): TetrominoType {
    if (this.queue.length < 7) {
      this.refillQueue();
    }
    const piece = this.queue.shift()!;
    return piece;
  }

  public peek(count: number = 5): TetrominoType[] {
    while (this.queue.length < count) {
      this.refillQueue();
    }
    return this.queue.slice(0, count);
  }
}
