import { BOARD_BUFFER_HEIGHT, BOARD_VISIBLE_HEIGHT, BOARD_WIDTH, PIECES, TetrominoType } from '../engine/constants';
import { GameEngine } from '../engine/gameEngine';
import { ParticleSystem } from './particleSystem';

export interface RendererOptions {
  cellSize?: number;
  showGhost?: boolean;
  showGrid?: boolean;
  colorblindMode?: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  theme?: 'dark' | 'light';
}

export class CanvasRenderer {
  public cellSize: number;
  public showGhost: boolean;
  public showGrid: boolean;
  public colorblindMode: string;
  public particleSystem: ParticleSystem;

  constructor(options: RendererOptions = {}) {
    this.cellSize = options.cellSize ?? 30;
    this.showGhost = options.showGhost ?? true;
    this.showGrid = options.showGrid ?? true;
    this.colorblindMode = options.colorblindMode ?? 'none';
    this.particleSystem = new ParticleSystem();
  }

  public render(
    canvas: HTMLCanvasElement,
    engine: GameEngine,
    incomingGarbage: number = 0
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = BOARD_WIDTH * this.cellSize;
    const height = BOARD_VISIBLE_HEIGHT * this.cellSize;

    // Handle high DPI
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    if (this.showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= width; x += this.cellSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y += this.cellSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }

    // Draw locked blocks
    for (let r = 0; r < BOARD_VISIBLE_HEIGHT; r++) {
      const boardRow = r + BOARD_BUFFER_HEIGHT;
      for (let c = 0; c < BOARD_WIDTH; c++) {
        const cell = engine.board[boardRow][c];
        if (cell) {
          this.drawMino(ctx, c * this.cellSize, r * this.cellSize, cell);
        }
      }
    }

    // Draw ghost piece
    if (this.showGhost && engine.state === 'playing' && engine.activePiece) {
      const ghostY = engine.getGhostY();
      const ghostBlocks = engine.getActiveBlocks(engine.activePiece, engine.activeRotation, engine.activeX, ghostY);
      const ghostColor = PIECES[engine.activePiece].ghostColor;

      for (const pt of ghostBlocks) {
        if (pt.y >= BOARD_BUFFER_HEIGHT) {
          const rx = pt.x * this.cellSize;
          const ry = (pt.y - BOARD_BUFFER_HEIGHT) * this.cellSize;
          this.drawGhostMino(ctx, rx, ry, ghostColor);
        }
      }
    }

    // Draw active falling piece
    if (engine.state === 'playing' && engine.activePiece) {
      const activeBlocks = engine.getActiveBlocks();
      const color = PIECES[engine.activePiece].color;

      for (const pt of activeBlocks) {
        if (pt.y >= BOARD_BUFFER_HEIGHT) {
          const rx = pt.x * this.cellSize;
          const ry = (pt.y - BOARD_BUFFER_HEIGHT) * this.cellSize;
          this.drawMino(ctx, rx, ry, color);
        }
      }
    }

    // Draw incoming garbage meter on left edge (red warning vertical bar)
    if (incomingGarbage > 0) {
      const barWidth = 4;
      const barHeight = Math.min(height, (incomingGarbage / 20) * height);
      ctx.fillStyle = incomingGarbage >= 10 ? '#ef4444' : '#f97316';
      ctx.fillRect(0, height - barHeight, barWidth, barHeight);
    }

    // Render particles and floating text
    this.particleSystem.render(ctx);

    ctx.restore();
  }

  private drawMino(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
    const size = this.cellSize;
    const pad = 1;
    const r = 3;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x + pad, y + pad, size - pad * 2, size - pad * 2, r);
    ctx.fill();

    // Top highlight bevel
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(x + pad, y + pad, size - pad * 2, (size - pad * 2) * 0.25);

    // Subtle dark border
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private drawGhostMino(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
    const size = this.cellSize;
    const pad = 1;
    const r = 3;

    ctx.strokeStyle = color;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.roundRect(x + pad, y + pad, size - pad * 2, size - pad * 2, r);
    ctx.fill();
    ctx.stroke();
  }

  public static renderPreview(
    canvas: HTMLCanvasElement,
    pieceType: TetrominoType | null,
    cellSize: number = 20
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 4 * cellSize;
    const height = 4 * cellSize;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    if (!pieceType) {
      ctx.restore();
      return;
    }

    const def = PIECES[pieceType];
    const shape = def.shapes[0];
    const color = def.color;

    // Center piece inside 4x4 bounding box
    const minX = Math.min(...shape.map(p => p.x));
    const maxX = Math.max(...shape.map(p => p.x));
    const minY = Math.min(...shape.map(p => p.y));
    const maxY = Math.max(...shape.map(p => p.y));

    const pieceW = (maxX - minX + 1) * cellSize;
    const pieceH = (maxY - minY + 1) * cellSize;

    const offsetX = (width - pieceW) / 2 - minX * cellSize;
    const offsetY = (height - pieceH) / 2 - minY * cellSize;

    for (const pt of shape) {
      const rx = offsetX + pt.x * cellSize;
      const ry = offsetY + pt.y * cellSize;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(rx + 1, ry + 1, cellSize - 2, cellSize - 2, 2);
      ctx.fill();

      // Top highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fillRect(rx + 1, ry + 1, cellSize - 2, (cellSize - 2) * 0.25);
    }

    ctx.restore();
  }
}
