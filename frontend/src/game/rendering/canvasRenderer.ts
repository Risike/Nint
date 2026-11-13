import { BOARD_BUFFER_HEIGHT, BOARD_VISIBLE_HEIGHT, BOARD_WIDTH, PIECES, Point, TetrominoType } from '../engine/constants';
import { BLAST_EFFECT_DURATION_MS, BLAST_TELEGRAPH_DURATION_MS, bombColor, isBombCell, isMegaBombCell } from '../engine/blast';
import { GameEngine } from '../engine/gameEngine';
import { ParticleSystem } from './particleSystem';
import { drawSkinnedMino, isRoundPieceSkin, normalizePieceSkin, PieceSkin } from './pieceSkins';

export interface RendererOptions {
  cellSize?: number;
  showGhost?: boolean;
  showGrid?: boolean;
  colorblindMode?: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  theme?: string;
  pieceSkin?: string;
}

function drawGhostBombGlyph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  mega: boolean = false
) {
  const cx = x + size / 2;
  const cy = y + size * 0.56;
  const radius = size * (mega ? 0.3 : 0.24);

  ctx.save();
  ctx.strokeStyle = mega ? 'rgba(103, 232, 249, 0.9)' : 'rgba(251, 191, 36, 0.8)';
  ctx.lineWidth = Math.max(1, size * (mega ? 0.02 : 0.045));
  ctx.setLineDash([Math.max(1, size * 0.1), Math.max(1, size * 0.07)]);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx + radius * 0.35, cy - radius * 0.8);
  ctx.quadraticCurveTo(cx + radius * 0.95, cy - radius * 1.35, cx + radius * 1.15, cy - radius * 1.7);
  ctx.stroke();
  ctx.restore();
}

function drawBombGlyph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  mega: boolean = false
) {
  const cx = x + size / 2;
  const cy = y + size * 0.56;
  const radius = size * (mega ? 0.28 : 0.24);

  ctx.save();
  ctx.shadowColor = mega ? '#fbbf24' : '#f97316';
  ctx.shadowBlur = Math.max(4, size * 0.24);
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = mega ? '#fbbf24' : '#f8fafc';
  ctx.lineWidth = Math.max(1.2, size * 0.055);
  ctx.stroke();

  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = Math.max(1, size * 0.045);
  ctx.beginPath();
  ctx.moveTo(cx + radius * 0.35, cy - radius * 0.8);
  ctx.quadraticCurveTo(cx + radius * 0.95, cy - radius * 1.35, cx + radius * 1.15, cy - radius * 1.7);
  ctx.stroke();

  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.arc(cx + radius * 1.18, cy - radius * 1.72, Math.max(1, size * 0.06), 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.beginPath();
  ctx.arc(cx - radius * 0.32, cy - radius * 0.34, Math.max(1, size * 0.055), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGroupedBombGlyph(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  cellSize: number,
  offsetX: number,
  offsetY: number,
  ghost: boolean = false
) {
  if (points.length === 0) return;
  const minX = Math.min(...points.map(point => point.x));
  const maxX = Math.max(...points.map(point => point.x));
  const minY = Math.min(...points.map(point => point.y));
  const maxY = Math.max(...points.map(point => point.y));
  const size = Math.max(maxX - minX + 1, maxY - minY + 1) * cellSize;
  const x = offsetX + minX * cellSize;
  const y = offsetY + minY * cellSize;
  if (ghost) {
    drawGhostBombGlyph(ctx, x, y, size, true);
  } else {
    drawBombGlyph(ctx, x, y, size, true);
  }
}

export class CanvasRenderer {
  public cellSize: number;
  public showGhost: boolean;
  public showGrid: boolean;
  public colorblindMode: string;
  public pieceSkin: PieceSkin;
  public particleSystem: ParticleSystem;

  constructor(options: RendererOptions = {}) {
    this.cellSize = options.cellSize ?? 30;
    this.showGhost = options.showGhost ?? true;
    this.showGrid = options.showGrid ?? true;
    this.colorblindMode = options.colorblindMode ?? 'none';
    this.pieceSkin = normalizePieceSkin(options.pieceSkin);
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

    // Locked mega bombs occupy four cells. Group them so a single large bomb
    // is drawn over the whole 2x2 square instead of four small bombs.
    const megaTopLefts: Array<{ x: number; y: number }> = [];
    const megaCovered = new Set<string>();
    for (let r = 0; r < BOARD_VISIBLE_HEIGHT - 1; r++) {
      const boardRow = r + BOARD_BUFFER_HEIGHT;
      for (let c = 0; c < BOARD_WIDTH - 1; c++) {
        if (megaCovered.has(`${c},${r}`)) continue;
        const square = [
          engine.board[boardRow][c],
          engine.board[boardRow][c + 1],
          engine.board[boardRow + 1][c],
          engine.board[boardRow + 1][c + 1]
        ];
        if (!square.every(cell => isMegaBombCell(cell))) continue;
        megaTopLefts.push({ x: c, y: r });
        megaCovered.add(`${c},${r}`);
        megaCovered.add(`${c + 1},${r}`);
        megaCovered.add(`${c},${r + 1}`);
        megaCovered.add(`${c + 1},${r + 1}`);
      }
    }

    // Draw locked blocks
    for (let r = 0; r < BOARD_VISIBLE_HEIGHT; r++) {
      const boardRow = r + BOARD_BUFFER_HEIGHT;
      const isClearing = engine.clearingRows.includes(boardRow);
      for (let c = 0; c < BOARD_WIDTH; c++) {
        const cell = engine.board[boardRow][c];
        if (cell) {
          const bomb = isBombCell(cell);
          const color = bomb ? bombColor(cell) : cell;
          if (isClearing) {
            this.drawClearingMino(ctx, c * this.cellSize, r * this.cellSize, color, engine.lineClearTimer);
          } else {
            this.drawMino(ctx, c * this.cellSize, r * this.cellSize, color);
            if (bomb && !megaCovered.has(`${c},${r}`)) {
              drawBombGlyph(ctx, c * this.cellSize, r * this.cellSize, this.cellSize, isMegaBombCell(cell));
            }
          }
        }
      }
    }

    for (const square of megaTopLefts) {
      drawBombGlyph(
        ctx,
        square.x * this.cellSize,
        square.y * this.cellSize,
        this.cellSize * 2,
        true
      );
    }

    // Draw horizontal flash beam across clearing rows
    if (engine.clearingRows.length > 0) {
      const isFlash = Math.floor(engine.lineClearTimer / 50) % 2 === 0;
      for (let r = 0; r < BOARD_VISIBLE_HEIGHT; r++) {
        const boardRow = r + BOARD_BUFFER_HEIGHT;
        if (engine.clearingRows.includes(boardRow)) {
          ctx.fillStyle = isFlash ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.12)';
          ctx.fillRect(0, r * this.cellSize, width, this.cellSize);
        }
      }
    }

    // Blast warning: pulse every block that the pending explosion will remove.
    if (engine.blastTelegraphTimer > 0) {
      const telegraphProgress = 1 - engine.blastTelegraphTimer / BLAST_TELEGRAPH_DURATION_MS;
      const pulse = 0.55 + 0.35 * Math.sin(telegraphProgress * Math.PI * 8);
      const warned = new Set<string>();
      for (const cell of engine.blastTelegraphCells) {
        const key = `${cell.x},${cell.y}`;
        if (warned.has(key)) continue;
        warned.add(key);
        const visibleRow = cell.y - BOARD_BUFFER_HEIGHT;
        if (visibleRow < 0 || visibleRow >= BOARD_VISIBLE_HEIGHT) continue;
        const x = cell.x * this.cellSize;
        const y = visibleRow * this.cellSize;

        ctx.fillStyle = `rgba(255, 96, 32, ${0.42 + 0.22 * pulse})`;
        ctx.fillRect(x, y, this.cellSize, this.cellSize);
        ctx.strokeStyle = `rgba(255, 250, 235, ${0.65 + 0.3 * pulse})`;
        ctx.lineWidth = Math.max(1.5, this.cellSize * 0.08);
        ctx.strokeRect(
          x + this.cellSize * 0.08,
          y + this.cellSize * 0.08,
          this.cellSize * 0.84,
          this.cellSize * 0.84
        );
      }

      for (const effect of engine.blastTelegraphEffects) {
        const left = (effect.x - Math.floor(effect.width / 2)) * this.cellSize;
        const top = (effect.y - Math.floor(effect.height / 2) - BOARD_BUFFER_HEIGHT) * this.cellSize;
        ctx.strokeStyle = `rgba(251, 146, 60, ${0.9 * pulse})`;
        ctx.lineWidth = Math.max(2, this.cellSize * 0.1);
        ctx.setLineDash([this.cellSize * 0.28, this.cellSize * 0.16]);
        ctx.strokeRect(left, top, effect.width * this.cellSize, effect.height * this.cellSize);
        ctx.setLineDash([]);
      }
    }

    // Draw ghost piece, including an outline for its bombs.
    if (this.showGhost && engine.state === 'playing' && engine.activePiece) {
      const ghostY = engine.getGhostY();
      const ghostBlocks = engine.getActiveBlocks(engine.activePiece, engine.activeRotation, engine.activeX, ghostY);
      const ghostColor = PIECES[engine.activePiece].ghostColor;
      const ghostBombs = engine.getActiveBombs().map(point => ({
        x: point.x,
        y: point.y - engine.activeY + ghostY
      }));
      const ghostBombKeys = new Set(ghostBombs.map(point => `${point.x},${point.y}`));
      const ghostMega = engine.activeMegaBomb && ghostBombs.length === 4;

      for (const pt of ghostBlocks) {
        if (pt.y >= BOARD_BUFFER_HEIGHT) {
          const rx = pt.x * this.cellSize;
          const ry = (pt.y - BOARD_BUFFER_HEIGHT) * this.cellSize;
          this.drawGhostMino(ctx, rx, ry, ghostColor);
          if (!ghostMega && ghostBombKeys.has(`${pt.x},${pt.y}`)) {
            drawGhostBombGlyph(ctx, rx, ry, this.cellSize);
          }
        }
      }

      if (ghostMega) {
        drawGroupedBombGlyph(
          ctx,
          ghostBombs,
          this.cellSize,
          0,
          -BOARD_BUFFER_HEIGHT * this.cellSize,
          true
        );
      }
    }

    // Draw active falling piece
    if (engine.state === 'playing' && engine.activePiece) {
      const activeBlocks = engine.getActiveBlocks();
      const color = PIECES[engine.activePiece].color;
      const activeBombs = engine.getActiveBombs();
      const bombKeys = new Set(activeBombs.map(point => `${point.x},${point.y}`));
      const activeMega = engine.activeMegaBomb && activeBombs.length === 4;

      for (const pt of activeBlocks) {
        if (pt.y >= BOARD_BUFFER_HEIGHT) {
          const rx = pt.x * this.cellSize;
          const ry = (pt.y - BOARD_BUFFER_HEIGHT) * this.cellSize;
          this.drawMino(ctx, rx, ry, color);
          if (!activeMega && bombKeys.has(`${pt.x},${pt.y}`)) {
            drawBombGlyph(ctx, rx, ry, this.cellSize);
          }
        }
      }

      if (activeMega) {
        drawGroupedBombGlyph(
          ctx,
          activeBombs,
          this.cellSize,
          0,
          -BOARD_BUFFER_HEIGHT * this.cellSize
        );
      }
    }

    // Blast explosion flash: rectangles expand over the destroyed area, then
    // every removed block flashes white so the destruction is readable.
    if (engine.blastEffects.length > 0 && engine.blastExplosionTimer > 0) {
      const progress = 1 - engine.blastExplosionTimer / BLAST_EFFECT_DURATION_MS;
      for (const effect of engine.blastEffects) {
        const left = (effect.x - Math.floor(effect.width / 2)) * this.cellSize;
        const top = (effect.y - Math.floor(effect.height / 2) - BOARD_BUFFER_HEIGHT) * this.cellSize;
        const effectWidth = effect.width * this.cellSize;
        const effectHeight = effect.height * this.cellSize;
        if (top > height || top + effectHeight < 0) continue;

        ctx.save();
        const centerX = left + effectWidth / 2;
        const centerY = top + effectHeight / 2;
        const radius = Math.max(effectWidth, effectHeight) * 0.7;
        const gradient = ctx.createRadialGradient(
          centerX,
          centerY,
          this.cellSize * 0.2,
          centerX,
          centerY,
          radius
        );
        if (effect.mega) {
          // Super bomb: cold white/cyan shockwave instead of the orange
          // small-bomb flash, with a visible expanding ring.
          gradient.addColorStop(0, `rgba(255, 255, 255, ${0.95 * (1 - progress)})`);
          gradient.addColorStop(0.4, `rgba(34, 211, 238, ${0.65 * (1 - progress)})`);
          gradient.addColorStop(0.75, `rgba(168, 85, 247, ${0.4 * (1 - progress)})`);
          gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
        } else {
          gradient.addColorStop(0, `rgba(255, 255, 255, ${0.75 * (1 - progress)})`);
          gradient.addColorStop(0.35, `rgba(251, 191, 36, ${0.55 * (1 - progress)})`);
          gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
        }
        ctx.fillStyle = gradient;
        ctx.fillRect(left, top, effectWidth, effectHeight);
        ctx.strokeStyle = effect.mega
          ? `rgba(165, 243, 252, ${0.95 * (1 - progress)})`
          : `rgba(255, 237, 213, ${0.95 * (1 - progress)})`;
        ctx.lineWidth = Math.max(1.5, this.cellSize * (effect.mega ? 0.16 : 0.1));
        ctx.strokeRect(
          left - progress * this.cellSize * 0.2,
          top - progress * this.cellSize * 0.2,
          effectWidth + progress * this.cellSize * 0.4,
          effectHeight + progress * this.cellSize * 0.4
        );

        if (effect.mega) {
          ctx.strokeStyle = `rgba(103, 232, 249, ${0.9 * (1 - progress)})`;
          ctx.lineWidth = Math.max(2, this.cellSize * 0.14);
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius * (0.15 + progress * 0.95), 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = `rgba(255, 255, 255, ${0.8 * (1 - progress)})`;
          ctx.lineWidth = Math.max(1.5, this.cellSize * 0.08);
          for (let ray = 0; ray < 8; ray += 1) {
            const angle = (Math.PI / 4) * ray + progress * 0.6;
            const inner = radius * (0.25 + progress * 0.55);
            const outer = radius * (0.45 + progress * 0.75);
            ctx.beginPath();
            ctx.moveTo(centerX + Math.cos(angle) * inner, centerY + Math.sin(angle) * inner);
            ctx.lineTo(centerX + Math.cos(angle) * outer, centerY + Math.sin(angle) * outer);
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      const flashedCells = new Set<string>();
      const cellProgress = Math.min(1, progress * 1.45);
      const inset = this.cellSize * 0.42 * cellProgress;
      for (const effect of engine.blastEffects) {
        for (const cell of effect.cells) {
          const key = `${cell.x},${cell.y}`;
          if (flashedCells.has(key)) continue;
          flashedCells.add(key);
          const visibleRow = cell.y - BOARD_BUFFER_HEIGHT;
          if (visibleRow < 0 || visibleRow >= BOARD_VISIBLE_HEIGHT) continue;

          const x = cell.x * this.cellSize;
          const y = visibleRow * this.cellSize;
          const alpha = Math.max(0, 1 - cellProgress);
          ctx.fillStyle = `rgba(255, 255, 255, ${0.88 * alpha})`;
          ctx.fillRect(
            x + inset,
            y + inset,
            this.cellSize - inset * 2,
            this.cellSize - inset * 2
          );
          ctx.strokeStyle = `rgba(251, 191, 36, ${0.95 * alpha})`;
          ctx.lineWidth = Math.max(1, this.cellSize * 0.07);
          ctx.strokeRect(
            x + inset,
            y + inset,
            this.cellSize - inset * 2,
            this.cellSize - inset * 2
          );
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

  private drawClearingMino(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    timerMs: number
  ) {
    const size = this.cellSize;
    const pad = 1;
    const r = 3;

    // Flash/blink every 50ms (blink on/off)
    const isFlash = Math.floor(timerMs / 50) % 2 === 0;

    if (isFlash) {
      // Pure brilliant white flash block
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(x + pad, y + pad, size - pad * 2, size - pad * 2, r);
      ctx.fill();

      // Top bevel highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.fillRect(x + pad, y + pad, size - pad * 2, (size - pad * 2) * 0.35);

      // Bright white border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      // Original color with bright pulse
      this.drawMino(ctx, x, y, color);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      ctx.roundRect(x + pad, y + pad, size - pad * 2, size - pad * 2, r);
      ctx.fill();
    }
  }

  private drawMino(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
    drawSkinnedMino(ctx, x, y, this.cellSize, color, this.pieceSkin);
  }

  private drawGhostMino(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
    const size = this.cellSize;
    const pad = 1;
    const r = 3;

    ctx.strokeStyle = color;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    if (isRoundPieceSkin(this.pieceSkin)) {
      ctx.arc(x + size / 2, y + size / 2, Math.max(1, size / 2 - pad), 0, Math.PI * 2);
    } else {
      ctx.roundRect(x + pad, y + pad, size - pad * 2, size - pad * 2, r);
    }
    ctx.fill();
    ctx.stroke();
  }

  public static renderPreview(
    canvas: HTMLCanvasElement,
    pieceType: TetrominoType | null,
    cellSize: number = 20,
    skin: string = 'classic',
    showBomb: boolean = false,
    bombs: Point[] = []
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
    const normalizedSkin = normalizePieceSkin(skin);

    // Center piece inside 4x4 bounding box
    const minX = Math.min(...shape.map(p => p.x));
    const maxX = Math.max(...shape.map(p => p.x));
    const minY = Math.min(...shape.map(p => p.y));
    const maxY = Math.max(...shape.map(p => p.y));

    const pieceW = (maxX - minX + 1) * cellSize;
    const pieceH = (maxY - minY + 1) * cellSize;

    const offsetX = (width - pieceW) / 2 - minX * cellSize;
    const offsetY = (height - pieceH) / 2 - minY * cellSize;

    // Only draw the bombs we actually know about. Guessing an index here is
    // what made Next and Hold disagree with the piece on the board.
    const bombKeys = new Set(bombs.map(point => `${point.x},${point.y}`));
    const mega = bombs.length === 4 && shape.length === 4;

    for (let index = 0; index < shape.length; index += 1) {
      const pt = shape[index];
      const rx = offsetX + pt.x * cellSize;
      const ry = offsetY + pt.y * cellSize;
      drawSkinnedMino(ctx, rx, ry, cellSize, color, normalizedSkin);
      if (showBomb && !mega && bombKeys.has(`${pt.x},${pt.y}`)) {
        drawBombGlyph(ctx, rx, ry, cellSize, false);
      }
    }

    if (showBomb && mega) {
      drawGroupedBombGlyph(ctx, bombs, cellSize, offsetX, offsetY);
    }

    ctx.restore();
  }
}
