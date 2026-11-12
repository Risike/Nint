export type PieceSkin =
  | 'classic'
  | 'neon'
  | 'glass'
  | 'pixel'
  | 'candy'
  | 'retro'
  | 'metallic'
  | 'holographic'
  | 'mosaic'
  | 'circuit'
  | 'gradient'
  | 'checker'
  | 'striped'
  | 'glossy'
  | 'matte'
  | 'gem'
  | 'wood'
  | 'marble'
  | 'carbon'
  | 'ice'
  | 'round_classic'
  | 'round_neon'
  | 'round_glass'
  | 'round_candy'
  | 'round_metallic'
  | 'round_gem'
  | 'round_glow'
  | 'round_marble'
  | 'round_ice'
  | 'round_wood'
  | 'round_holographic'
  | 'round_striped'
  | 'round_checker'
  | 'round_mosaic'
  | 'round_carbon'
  | 'round_gradient'
  | 'round_glossy'
  | 'round_matte'
  | 'round_pearl'
  | 'round_planet';

export const PIECE_SKINS: PieceSkin[] = [
  'classic', 'neon', 'glass', 'pixel', 'candy',
  'retro', 'metallic', 'holographic', 'mosaic', 'circuit',
  'gradient', 'checker', 'striped', 'glossy', 'matte',
  'gem', 'wood', 'marble', 'carbon', 'ice',
  'round_classic', 'round_neon', 'round_glass', 'round_candy', 'round_metallic',
  'round_gem', 'round_glow', 'round_marble', 'round_ice', 'round_wood',
  'round_holographic', 'round_striped', 'round_checker', 'round_mosaic', 'round_carbon',
  'round_gradient', 'round_glossy', 'round_matte', 'round_pearl', 'round_planet'
];

export function normalizePieceSkin(value: unknown): PieceSkin {
  return typeof value === 'string' && PIECE_SKINS.includes(value as PieceSkin)
    ? value as PieceSkin
    : 'classic';
}

export function isRoundPieceSkin(value: unknown): boolean {
  return normalizePieceSkin(value).startsWith('round_');
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, Math.max(0, radius));
}

function fillTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string | CanvasGradient
) {
  roundedRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
}

function strokeTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  stroke: string,
  lineWidth: number
) {
  roundedRect(ctx, x, y, width, height, radius);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function clipTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  radius: number
) {
  roundedRect(ctx, x, y, size, size, radius);
  ctx.clip();
}

function fillDisc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  fill: string | CanvasGradient
) {
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function strokeDisc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  stroke: string,
  lineWidth: number
) {
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function clipDisc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number
) {
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
}

function parseHex(value: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(value);
  if (!match) return null;
  return [
    parseInt(match[1].slice(0, 2), 16),
    parseInt(match[1].slice(2, 4), 16),
    parseInt(match[1].slice(4, 6), 16)
  ];
}

function normalizeHex(value: string): string {
  const parsed = parseHex(value);
  return parsed
    ? `#${parsed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
    : '#94a3b8';
}

function shade(value: string, amount: number): string {
  const parsed = parseHex(value) || [148, 163, 184];
  const target = amount >= 0 ? 255 : 0;
  const ratio = Math.min(1, Math.abs(amount));
  const channels = parsed.map((channel) => Math.round(channel + (target - channel) * ratio));
  return `rgb(${channels[0]}, ${channels[1]}, ${channels[2]})`;
}

function alpha(value: string, opacity: number): string {
  let parsed = parseHex(value);
  if (!parsed) {
    const match = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(value);
    parsed = match
      ? [Number(match[1]), Number(match[2]), Number(match[3])]
      : [148, 163, 184];
  }
  return `rgba(${parsed[0]}, ${parsed[1]}, ${parsed[2]}, ${opacity})`;
}

/**
 * Draws one mino with the selected shop skin. The same helper is used by the
 * playfield and the small preview canvases so every surface matches.
 */
export function drawSkinnedMino(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  skin: PieceSkin
) {
  const pad = 1;
  const inner = Math.max(1, size - pad * 2);
  const base = normalizeHex(color);
  const radius = Math.max(2, size * 0.16);
  const line = Math.max(1, size * 0.06);
  const cx = x + size / 2;
  const cy = y + size / 2;
  const discRadius = Math.max(1, size / 2 - pad);

  ctx.save();
  switch (skin) {
    case 'neon': {
      ctx.shadowColor = base;
      ctx.shadowBlur = Math.max(6, size * 0.35);
      fillTile(ctx, x + pad, y + pad, inner, inner, radius, 'rgba(8, 15, 30, 0.94)');
      strokeTile(ctx, x + pad, y + pad, inner, inner, radius, base, Math.max(1.5, size * 0.09));

      ctx.shadowBlur = 0;
      fillTile(ctx, x + size * 0.27, y + size * 0.27, size * 0.46, size * 0.46, size * 0.12, base);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillRect(x + size * 0.35, y + size * 0.32, size * 0.16, size * 0.09);
      break;
    }
    case 'glass': {
      fillTile(ctx, x + pad, y + pad, inner, inner, radius, alpha(base, 0.28));
      strokeTile(ctx, x + pad, y + pad, inner, inner, radius, 'rgba(255, 255, 255, 0.78)', 1.5);
      fillTile(ctx, x + size * 0.2, y + size * 0.18, size * 0.42, size * 0.16, size * 0.08, 'rgba(255, 255, 255, 0.32)');
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.fillRect(x + size * 0.18, y + size * 0.62, size * 0.64, size * 0.12);
      break;
    }
    case 'pixel': {
      ctx.fillStyle = base;
      ctx.fillRect(x + pad, y + pad, inner, inner);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.fillRect(x + pad, y + size * 0.72, inner, size * 0.26);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + pad, y + pad, inner, inner);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
      ctx.fillRect(x + size * 0.2, y + size * 0.2, size * 0.2, size * 0.1);
      break;
    }
    case 'candy': {
      const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      gradient.addColorStop(0.32, base);
      gradient.addColorStop(1, base);
      fillTile(ctx, x + pad, y + pad, inner, inner, size * 0.3, gradient);
      strokeTile(ctx, x + pad, y + pad, inner, inner, size * 0.3, 'rgba(255, 255, 255, 0.45)', 1);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.beginPath();
      ctx.ellipse(x + size * 0.34, y + size * 0.3, size * 0.17, size * 0.08, -0.35, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'retro': {
      fillTile(ctx, x + pad, y + pad, inner, inner, 1, base);
      ctx.fillStyle = alpha(base, 0.45);
      ctx.fillRect(x + pad, y + pad, inner, inner * 0.24);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.fillRect(x + pad, y + size * 0.74, inner, size * 0.24);
      ctx.fillStyle = alpha('#ffffff', 0.4);
      ctx.fillRect(x + size * 0.16, y + size * 0.16, size * 0.16, size * 0.16);
      ctx.fillStyle = alpha('#000000', 0.28);
      ctx.fillRect(x + size * 0.68, y + size * 0.68, size * 0.16, size * 0.16);
      strokeTile(ctx, x + pad, y + pad, inner, inner, 1, shade(base, -0.65), Math.max(1, size * 0.08));
      break;
    }
    case 'metallic': {
      const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
      gradient.addColorStop(0, shade(base, 0.72));
      gradient.addColorStop(0.28, base);
      gradient.addColorStop(0.56, shade(base, -0.18));
      gradient.addColorStop(1, shade(base, -0.58));
      fillTile(ctx, x + pad, y + pad, inner, inner, radius, gradient);
      strokeTile(ctx, x + pad, y + pad, inner, inner, radius, 'rgba(255, 255, 255, 0.55)', 1);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.48)';
      ctx.fillRect(x + size * 0.2, y + size * 0.14, size * 0.48, size * 0.08);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
      ctx.fillRect(x + size * 0.2, y + size * 0.78, size * 0.6, size * 0.08);
      break;
    }
    case 'holographic': {
      fillTile(ctx, x + pad, y + pad, inner, inner, radius, base);
      ctx.save();
      clipTile(ctx, x + pad, y + pad, inner, radius);
      const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
      gradient.addColorStop(0, 'rgba(34, 211, 238, 0.62)');
      gradient.addColorStop(0.35, 'rgba(244, 114, 182, 0.5)');
      gradient.addColorStop(0.68, 'rgba(250, 204, 21, 0.42)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0.14)');
      ctx.fillStyle = gradient;
      ctx.fillRect(x + pad, y + pad, inner, inner);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.moveTo(x + size * 0.05, y + size * 0.8);
      ctx.lineTo(x + size * 0.65, y + size * 0.05);
      ctx.lineTo(x + size * 0.85, y + size * 0.05);
      ctx.lineTo(x + size * 0.2, y + size * 0.95);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      strokeTile(ctx, x + pad, y + pad, inner, inner, radius, 'rgba(255, 255, 255, 0.75)', 1);
      break;
    }
    case 'mosaic': {
      fillTile(ctx, x + pad, y + pad, inner, inner, radius, base);
      const gap = Math.max(1, size * 0.045);
      const tile = (inner - gap * 3) / 4;
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          const tileColor = (row + col) % 2 === 0 ? shade(base, 0.16) : shade(base, -0.2);
          ctx.fillStyle = tileColor;
          ctx.fillRect(
            x + pad + col * (tile + gap),
            y + pad + row * (tile + gap),
            tile,
            tile
          );
        }
      }
      strokeTile(ctx, x + pad, y + pad, inner, inner, radius, alpha('#000000', 0.38), 1);
      break;
    }
    case 'circuit': {
      fillTile(ctx, x + pad, y + pad, inner, inner, radius, shade(base, -0.78));
      ctx.save();
      clipTile(ctx, x + pad, y + pad, inner, radius);
      ctx.strokeStyle = base;
      ctx.lineWidth = Math.max(1, size * 0.06);
      ctx.beginPath();
      ctx.moveTo(x + size * 0.12, y + size * 0.3);
      ctx.lineTo(x + size * 0.42, y + size * 0.3);
      ctx.lineTo(x + size * 0.42, y + size * 0.12);
      ctx.moveTo(x + size * 0.58, y + size * 0.88);
      ctx.lineTo(x + size * 0.58, y + size * 0.58);
      ctx.lineTo(x + size * 0.88, y + size * 0.58);
      ctx.moveTo(x + size * 0.22, y + size * 0.72);
      ctx.lineTo(x + size * 0.22, y + size * 0.5);
      ctx.lineTo(x + size * 0.38, y + size * 0.5);
      ctx.stroke();
      ctx.fillStyle = base;
      for (const [cx, cy] of [[0.12, 0.3], [0.42, 0.12], [0.88, 0.58], [0.22, 0.72]]) {
        ctx.beginPath();
        ctx.arc(x + size * cx, y + size * cy, Math.max(1, size * 0.055), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      strokeTile(ctx, x + pad, y + pad, inner, inner, radius, alpha(base, 0.85), 1);
      break;
    }
    case 'gradient': {
      const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
      gradient.addColorStop(0, shade(base, 0.62));
      gradient.addColorStop(0.48, base);
      gradient.addColorStop(1, shade(base, -0.55));
      fillTile(ctx, x + pad, y + pad, inner, inner, radius, gradient);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.fillRect(x + size * 0.2, y + size * 0.16, size * 0.48, size * 0.08);
      strokeTile(ctx, x + pad, y + pad, inner, inner, radius, alpha('#ffffff', 0.3), 1);
      break;
    }
    case 'checker': {
      fillTile(ctx, x + pad, y + pad, inner, inner, radius, base);
      ctx.save();
      clipTile(ctx, x + pad, y + pad, inner, radius);
      const cell = inner / 4;
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          if ((row + col) % 2 !== 0) continue;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
          ctx.fillRect(x + pad + col * cell, y + pad + row * cell, cell, cell);
        }
      }
      ctx.restore();
      strokeTile(ctx, x + pad, y + pad, inner, inner, radius, alpha('#ffffff', 0.3), 1);
      break;
    }
    case 'striped': {
      fillTile(ctx, x + pad, y + pad, inner, inner, radius, base);
      ctx.save();
      clipTile(ctx, x + pad, y + pad, inner, radius);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
      for (let offset = -size; offset < size * 2; offset += size * 0.38) {
        ctx.beginPath();
        ctx.moveTo(x + offset, y + size);
        ctx.lineTo(x + offset + size * 0.18, y + size);
        ctx.lineTo(x + offset + size * 0.62, y);
        ctx.lineTo(x + offset + size * 0.44, y);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      strokeTile(ctx, x + pad, y + pad, inner, inner, radius, alpha('#000000', 0.28), 1);
      break;
    }
    case 'glossy': {
      const gradient = ctx.createLinearGradient(x, y, x, y + size);
      gradient.addColorStop(0, shade(base, 0.5));
      gradient.addColorStop(0.38, base);
      gradient.addColorStop(1, shade(base, -0.3));
      fillTile(ctx, x + pad, y + pad, inner, inner, radius, gradient);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.62)';
      ctx.beginPath();
      ctx.ellipse(x + size * 0.35, y + size * 0.24, size * 0.2, size * 0.09, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.fillRect(x + size * 0.2, y + size * 0.8, size * 0.6, size * 0.08);
      strokeTile(ctx, x + pad, y + pad, inner, inner, radius, 'rgba(255, 255, 255, 0.55)', 1);
      break;
    }
    case 'matte': {
      fillTile(ctx, x + pad, y + pad, inner, inner, radius, base);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(x + pad, y + pad, inner, inner);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.fillRect(x + size * 0.18, y + size * 0.18, size * 0.1, size * 0.1);
      ctx.fillRect(x + size * 0.68, y + size * 0.6, size * 0.1, size * 0.1);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.fillRect(x + size * 0.42, y + size * 0.38, size * 0.08, size * 0.08);
      strokeTile(ctx, x + pad, y + pad, inner, inner, radius, alpha('#000000', 0.3), 1);
      break;
    }
    case 'gem': {
      fillTile(ctx, x + pad, y + pad, inner, inner, radius, shade(base, -0.12));
      ctx.save();
      clipTile(ctx, x + pad, y + pad, inner, radius);
      ctx.fillStyle = shade(base, 0.38);
      ctx.beginPath();
      ctx.moveTo(x + pad, y + pad);
      ctx.lineTo(x + inner, y + pad);
      ctx.lineTo(x + size * 0.5, y + size * 0.34);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = shade(base, -0.32);
      ctx.beginPath();
      ctx.moveTo(x + inner, y + inner);
      ctx.lineTo(x + pad, y + inner);
      ctx.lineTo(x + size * 0.5, y + size * 0.66);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = alpha('#ffffff', 0.2);
      ctx.beginPath();
      ctx.moveTo(x + pad, y + pad);
      ctx.lineTo(x + size * 0.5, y + size * 0.34);
      ctx.lineTo(x + size * 0.5, y + size * 0.66);
      ctx.lineTo(x + pad, y + inner);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + size * 0.5, y + size * 0.12);
      ctx.lineTo(x + size * 0.5, y + size * 0.88);
      ctx.moveTo(x + size * 0.12, y + size * 0.5);
      ctx.lineTo(x + size * 0.88, y + size * 0.5);
      ctx.stroke();
      ctx.restore();
      strokeTile(ctx, x + pad, y + pad, inner, inner, radius, 'rgba(255, 255, 255, 0.55)', 1);
      break;
    }
    case 'wood': {
      fillTile(ctx, x + pad, y + pad, inner, inner, radius, shade(base, -0.2));
      ctx.save();
      clipTile(ctx, x + pad, y + pad, inner, radius);
      for (let index = 0; index < 4; index++) {
        const grainY = y + size * (0.2 + index * 0.2);
        ctx.strokeStyle = alpha('#000000', index % 2 === 0 ? 0.2 : 0.12);
        ctx.lineWidth = Math.max(1, size * 0.035);
        ctx.beginPath();
        ctx.moveTo(x + pad, grainY);
        ctx.bezierCurveTo(
          x + size * 0.35, grainY - size * 0.04,
          x + size * 0.65, grainY + size * 0.04,
          x + inner, grainY
        );
        ctx.stroke();
      }
      ctx.strokeStyle = alpha('#000000', 0.34);
      ctx.lineWidth = Math.max(1, size * 0.05);
      ctx.beginPath();
      ctx.ellipse(x + size * 0.68, y + size * 0.36, size * 0.11, size * 0.055, 0.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      strokeTile(ctx, x + pad, y + pad, inner, inner, radius, shade(base, -0.52), 1);
      break;
    }
    case 'marble': {
      const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
      gradient.addColorStop(0, shade(base, 0.82));
      gradient.addColorStop(0.42, shade(base, 0.38));
      gradient.addColorStop(1, shade(base, -0.08));
      fillTile(ctx, x + pad, y + pad, inner, inner, radius, gradient);
      ctx.save();
      clipTile(ctx, x + pad, y + pad, inner, radius);

      ctx.fillStyle = alpha('#ffffff', 0.25);
      ctx.beginPath();
      ctx.ellipse(x + size * 0.29, y + size * 0.25, size * 0.26, size * 0.14, -0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = alpha(shade(base, -0.22), 0.22);
      ctx.beginPath();
      ctx.ellipse(x + size * 0.74, y + size * 0.76, size * 0.24, size * 0.12, -0.45, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = alpha(shade(base, -0.58), 0.72);
      ctx.lineWidth = Math.max(1, size * 0.045);
      ctx.beginPath();
      ctx.moveTo(x + size * 0.04, y + size * 0.2);
      ctx.bezierCurveTo(x + size * 0.28, y + size * 0.04, x + size * 0.38, y + size * 0.48, x + size * 0.58, y + size * 0.34);
      ctx.bezierCurveTo(x + size * 0.74, y + size * 0.24, x + size * 0.8, y + size * 0.46, x + size * 0.96, y + size * 0.4);
      ctx.stroke();

      ctx.strokeStyle = alpha(shade(base, -0.38), 0.48);
      ctx.lineWidth = Math.max(1, size * 0.028);
      ctx.beginPath();
      ctx.moveTo(x + size * 0.12, y + size * 0.92);
      ctx.bezierCurveTo(x + size * 0.3, y + size * 0.72, x + size * 0.48, y + size * 0.84, x + size * 0.86, y + size * 0.64);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.68)';
      ctx.lineWidth = Math.max(1, size * 0.022);
      ctx.beginPath();
      ctx.moveTo(x + size * 0.18, y + size * 0.66);
      ctx.bezierCurveTo(x + size * 0.34, y + size * 0.52, x + size * 0.44, y + size * 0.68, x + size * 0.6, y + size * 0.5);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.fillRect(x + size * 0.16, y + size * 0.12, size * 0.42, size * 0.07);
      ctx.restore();
      strokeTile(ctx, x + pad, y + pad, inner, inner, radius, alpha('#000000', 0.36), 1);
      break;
    }
    case 'carbon': {
      fillTile(ctx, x + pad, y + pad, inner, inner, radius, '#111827');
      ctx.save();
      clipTile(ctx, x + pad, y + pad, inner, radius);
      const weave = inner / 3;
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          ctx.fillStyle = (row + col) % 2 === 0 ? 'rgba(71, 85, 105, 0.42)' : 'rgba(15, 23, 42, 0.4)';
          ctx.fillRect(x + pad + col * weave, y + pad + row * weave, weave, weave);
        }
      }
      ctx.fillStyle = alpha(base, 0.85);
      ctx.fillRect(x + pad, y + pad, inner, Math.max(1, size * 0.08));
      ctx.restore();
      strokeTile(ctx, x + pad, y + pad, inner, inner, radius, alpha(base, 0.9), 1);
      break;
    }
    case 'ice': {
      const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
      gradient.addColorStop(0, shade(base, 0.78));
      gradient.addColorStop(0.42, shade(base, 0.32));
      gradient.addColorStop(1, shade(base, -0.08));
      fillTile(ctx, x + pad, y + pad, inner, inner, radius, gradient);
      ctx.save();
      clipTile(ctx, x + pad, y + pad, inner, radius);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.moveTo(x + pad, y + pad);
      ctx.lineTo(x + size * 0.7, y + pad);
      ctx.lineTo(x + pad, y + size * 0.62);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = alpha('#ffffff', 0.18);
      ctx.beginPath();
      ctx.moveTo(x + size * 0.5, y + size * 0.08);
      ctx.lineTo(x + size * 0.94, y + size * 0.38);
      ctx.lineTo(x + size * 0.58, y + size * 0.92);
      ctx.lineTo(x + size * 0.16, y + size * 0.48);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = alpha(base, 0.22);
      ctx.beginPath();
      ctx.moveTo(x + size * 0.16, y + size * 0.48);
      ctx.lineTo(x + size * 0.58, y + size * 0.92);
      ctx.lineTo(x + size * 0.08, y + size * 0.94);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.82)';
      ctx.lineWidth = Math.max(1, size * 0.035);
      ctx.beginPath();
      ctx.moveTo(x + size * 0.12, y + size * 0.14);
      ctx.lineTo(x + size * 0.34, y + size * 0.4);
      ctx.lineTo(x + size * 0.24, y + size * 0.58);
      ctx.moveTo(x + size * 0.84, y + size * 0.18);
      ctx.lineTo(x + size * 0.62, y + size * 0.48);
      ctx.lineTo(x + size * 0.72, y + size * 0.84);
      ctx.moveTo(x + size * 0.34, y + size * 0.4);
      ctx.lineTo(x + size * 0.52, y + size * 0.48);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(x + size * 0.28, y + size * 0.22, Math.max(1, size * 0.045), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillRect(x + size * 0.17, y + size * 0.12, size * 0.34, size * 0.06);
      ctx.restore();
      strokeTile(ctx, x + pad, y + pad, inner, inner, radius, 'rgba(255, 255, 255, 0.9)', 1.5);
      break;
    }
    case 'round_classic': {
      fillDisc(ctx, cx, cy, discRadius, base);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.ellipse(cx - size * 0.12, cy - size * 0.18, size * 0.18, size * 0.09, -0.45, 0, Math.PI * 2);
      ctx.fill();
      strokeDisc(ctx, cx, cy, discRadius, 'rgba(0, 0, 0, 0.45)', 1);
      break;
    }
    case 'round_neon': {
      ctx.shadowColor = base;
      ctx.shadowBlur = Math.max(6, size * 0.35);
      fillDisc(ctx, cx, cy, discRadius, 'rgba(8, 15, 30, 0.95)');
      strokeDisc(ctx, cx, cy, discRadius, base, Math.max(1.5, size * 0.09));
      ctx.shadowBlur = 0;
      fillDisc(ctx, cx, cy, size * 0.18, base);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.ellipse(cx - size * 0.08, cy - size * 0.1, size * 0.07, size * 0.035, -0.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'round_glass': {
      fillDisc(ctx, cx, cy, discRadius, alpha(base, 0.28));
      strokeDisc(ctx, cx, cy, discRadius, 'rgba(255, 255, 255, 0.82)', 1.5);
      fillDisc(ctx, cx - size * 0.14, cy - size * 0.17, size * 0.16, 'rgba(255, 255, 255, 0.35)');
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.beginPath();
      ctx.ellipse(cx + size * 0.12, cy + size * 0.18, size * 0.2, size * 0.07, -0.35, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'round_candy': {
      const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
      gradient.addColorStop(0.34, base);
      gradient.addColorStop(1, base);
      fillDisc(ctx, cx, cy, discRadius, gradient);
      strokeDisc(ctx, cx, cy, discRadius, 'rgba(255, 255, 255, 0.48)', 1);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.62)';
      ctx.beginPath();
      ctx.ellipse(cx - size * 0.14, cy - size * 0.17, size * 0.18, size * 0.08, -0.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'round_metallic': {
      const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
      gradient.addColorStop(0, shade(base, 0.75));
      gradient.addColorStop(0.28, base);
      gradient.addColorStop(0.58, shade(base, -0.2));
      gradient.addColorStop(1, shade(base, -0.62));
      fillDisc(ctx, cx, cy, discRadius, gradient);
      strokeDisc(ctx, cx, cy, discRadius, 'rgba(255, 255, 255, 0.6)', 1);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.beginPath();
      ctx.ellipse(cx - size * 0.12, cy - size * 0.18, size * 0.2, size * 0.07, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
      ctx.beginPath();
      ctx.ellipse(cx + size * 0.12, cy + size * 0.2, size * 0.18, size * 0.06, -0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'round_gem': {
      fillDisc(ctx, cx, cy, discRadius, shade(base, -0.12));
      ctx.save();
      clipDisc(ctx, cx, cy, discRadius);
      ctx.fillStyle = shade(base, 0.36);
      ctx.beginPath();
      ctx.moveTo(cx - discRadius, cy - discRadius);
      ctx.lineTo(cx + discRadius, cy - discRadius);
      ctx.lineTo(cx, cy);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = shade(base, -0.34);
      ctx.beginPath();
      ctx.moveTo(cx + discRadius, cy + discRadius);
      ctx.lineTo(cx - discRadius, cy + discRadius);
      ctx.lineTo(cx, cy);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy - discRadius);
      ctx.lineTo(cx, cy + discRadius);
      ctx.moveTo(cx - discRadius, cy);
      ctx.lineTo(cx + discRadius, cy);
      ctx.stroke();
      ctx.restore();
      strokeDisc(ctx, cx, cy, discRadius, 'rgba(255, 255, 255, 0.55)', 1);
      break;
    }
    case 'round_glow': {
      ctx.shadowColor = base;
      ctx.shadowBlur = Math.max(8, size * 0.42);
      fillDisc(ctx, cx, cy, discRadius, alpha(base, 0.32));
      strokeDisc(ctx, cx, cy, discRadius, base, Math.max(1.5, size * 0.08));
      ctx.shadowBlur = 0;
      fillDisc(ctx, cx, cy, size * 0.18, 'rgba(255, 255, 255, 0.82)');
      break;
    }
    case 'round_marble': {
      const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
      gradient.addColorStop(0, shade(base, 0.82));
      gradient.addColorStop(0.45, shade(base, 0.38));
      gradient.addColorStop(1, shade(base, -0.08));
      fillDisc(ctx, cx, cy, discRadius, gradient);
      ctx.save();
      clipDisc(ctx, cx, cy, discRadius);
      ctx.fillStyle = alpha('#ffffff', 0.26);
      ctx.beginPath();
      ctx.ellipse(cx - size * 0.17, cy - size * 0.2, size * 0.24, size * 0.1, -0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = alpha(shade(base, -0.58), 0.72);
      ctx.lineWidth = Math.max(1, size * 0.045);
      ctx.beginPath();
      ctx.moveTo(cx - discRadius, cy - size * 0.12);
      ctx.bezierCurveTo(cx - size * 0.18, cy - size * 0.28, cx - size * 0.08, cy + size * 0.12, cx + size * 0.12, cy - size * 0.02);
      ctx.bezierCurveTo(cx + size * 0.28, cy - size * 0.14, cx + size * 0.3, cy + size * 0.1, cx + discRadius, cy + size * 0.04);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.62)';
      ctx.lineWidth = Math.max(1, size * 0.022);
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.22, cy + size * 0.17);
      ctx.bezierCurveTo(cx - size * 0.05, cy + size * 0.02, cx + size * 0.08, cy + size * 0.2, cx + size * 0.24, cy + size * 0.04);
      ctx.stroke();
      ctx.restore();
      strokeDisc(ctx, cx, cy, discRadius, alpha('#000000', 0.36), 1);
      break;
    }
    case 'round_ice': {
      const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
      gradient.addColorStop(0, shade(base, 0.8));
      gradient.addColorStop(0.44, shade(base, 0.34));
      gradient.addColorStop(1, shade(base, -0.08));
      fillDisc(ctx, cx, cy, discRadius, gradient);
      ctx.save();
      clipDisc(ctx, cx, cy, discRadius);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.moveTo(cx - discRadius, cy - discRadius);
      ctx.lineTo(cx + size * 0.2, cy - discRadius);
      ctx.lineTo(cx - discRadius, cy + size * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.82)';
      ctx.lineWidth = Math.max(1, size * 0.032);
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.26, cy - size * 0.28);
      ctx.lineTo(cx - size * 0.08, cy - size * 0.02);
      ctx.lineTo(cx - size * 0.16, cy + size * 0.14);
      ctx.moveTo(cx + size * 0.3, cy - size * 0.24);
      ctx.lineTo(cx + size * 0.08, cy + size * 0.02);
      ctx.lineTo(cx + size * 0.18, cy + size * 0.3);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(cx - size * 0.16, cy - size * 0.18, Math.max(1, size * 0.04), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      strokeDisc(ctx, cx, cy, discRadius, 'rgba(255, 255, 255, 0.9)', 1.5);
      break;
    }
    case 'round_wood': {
      fillDisc(ctx, cx, cy, discRadius, shade(base, -0.2));
      ctx.save();
      clipDisc(ctx, cx, cy, discRadius);
      for (let index = 0; index < 4; index++) {
        const grainY = cy + size * (-0.24 + index * 0.16);
        ctx.strokeStyle = alpha('#000000', index % 2 === 0 ? 0.2 : 0.12);
        ctx.lineWidth = Math.max(1, size * 0.032);
        ctx.beginPath();
        ctx.moveTo(cx - discRadius, grainY);
        ctx.bezierCurveTo(cx - size * 0.14, grainY - size * 0.03, cx + size * 0.14, grainY + size * 0.03, cx + discRadius, grainY);
        ctx.stroke();
      }
      ctx.strokeStyle = alpha('#000000', 0.34);
      ctx.lineWidth = Math.max(1, size * 0.045);
      ctx.beginPath();
      ctx.ellipse(cx + size * 0.14, cy - size * 0.12, size * 0.1, size * 0.05, 0.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      strokeDisc(ctx, cx, cy, discRadius, shade(base, -0.52), 1);
      break;
    }
    case 'round_holographic': {
      fillDisc(ctx, cx, cy, discRadius, base);
      ctx.save();
      clipDisc(ctx, cx, cy, discRadius);
      const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
      gradient.addColorStop(0, 'rgba(34, 211, 238, 0.62)');
      gradient.addColorStop(0.35, 'rgba(244, 114, 182, 0.5)');
      gradient.addColorStop(0.68, 'rgba(250, 204, 21, 0.42)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0.14)');
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
      ctx.beginPath();
      ctx.moveTo(cx - discRadius, cy + size * 0.28);
      ctx.lineTo(cx + size * 0.14, cy - discRadius);
      ctx.lineTo(cx + size * 0.34, cy - discRadius);
      ctx.lineTo(cx - size * 0.3, cy + discRadius);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      strokeDisc(ctx, cx, cy, discRadius, 'rgba(255, 255, 255, 0.78)', 1);
      break;
    }
    case 'round_striped': {
      fillDisc(ctx, cx, cy, discRadius, base);
      ctx.save();
      clipDisc(ctx, cx, cy, discRadius);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.26)';
      for (let offset = -size; offset < size * 2; offset += size * 0.34) {
        ctx.beginPath();
        ctx.moveTo(x + offset, y + size);
        ctx.lineTo(x + offset + size * 0.15, y + size);
        ctx.lineTo(x + offset + size * 0.58, y);
        ctx.lineTo(x + offset + size * 0.43, y);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      strokeDisc(ctx, cx, cy, discRadius, alpha('#000000', 0.28), 1);
      break;
    }
    case 'round_checker': {
      fillDisc(ctx, cx, cy, discRadius, base);
      ctx.save();
      clipDisc(ctx, cx, cy, discRadius);
      const cell = size / 4;
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          if ((row + col) % 2 !== 0) continue;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
          ctx.fillRect(x + col * cell, y + row * cell, cell, cell);
        }
      }
      ctx.restore();
      strokeDisc(ctx, cx, cy, discRadius, alpha('#ffffff', 0.3), 1);
      break;
    }
    case 'round_mosaic': {
      fillDisc(ctx, cx, cy, discRadius, base);
      ctx.save();
      clipDisc(ctx, cx, cy, discRadius);
      const gap = Math.max(1, size * 0.045);
      const tile = (size - gap * 4) / 3;
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          ctx.fillStyle = (row + col) % 2 === 0 ? shade(base, 0.18) : shade(base, -0.22);
          ctx.fillRect(x + gap + col * (tile + gap), y + gap + row * (tile + gap), tile, tile);
        }
      }
      ctx.restore();
      strokeDisc(ctx, cx, cy, discRadius, alpha('#000000', 0.38), 1);
      break;
    }
    case 'round_carbon': {
      fillDisc(ctx, cx, cy, discRadius, '#111827');
      ctx.save();
      clipDisc(ctx, cx, cy, discRadius);
      const weave = size / 3;
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          ctx.fillStyle = (row + col) % 2 === 0 ? 'rgba(71, 85, 105, 0.42)' : 'rgba(15, 23, 42, 0.4)';
          ctx.fillRect(x + col * weave, y + row * weave, weave, weave);
        }
      }
      ctx.fillStyle = alpha(base, 0.85);
      ctx.fillRect(x, y, size, Math.max(1, size * 0.08));
      ctx.restore();
      strokeDisc(ctx, cx, cy, discRadius, alpha(base, 0.9), 1);
      break;
    }
    case 'round_gradient': {
      const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
      gradient.addColorStop(0, shade(base, 0.64));
      gradient.addColorStop(0.5, base);
      gradient.addColorStop(1, shade(base, -0.56));
      fillDisc(ctx, cx, cy, discRadius, gradient);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
      ctx.beginPath();
      ctx.ellipse(cx - size * 0.14, cy - size * 0.18, size * 0.2, size * 0.08, -0.35, 0, Math.PI * 2);
      ctx.fill();
      strokeDisc(ctx, cx, cy, discRadius, alpha('#ffffff', 0.32), 1);
      break;
    }
    case 'round_glossy': {
      const gradient = ctx.createLinearGradient(x, y, x, y + size);
      gradient.addColorStop(0, shade(base, 0.5));
      gradient.addColorStop(0.4, base);
      gradient.addColorStop(1, shade(base, -0.32));
      fillDisc(ctx, cx, cy, discRadius, gradient);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.66)';
      ctx.beginPath();
      ctx.ellipse(cx - size * 0.12, cy - size * 0.2, size * 0.2, size * 0.08, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.beginPath();
      ctx.ellipse(cx + size * 0.12, cy + size * 0.22, size * 0.18, size * 0.06, -0.3, 0, Math.PI * 2);
      ctx.fill();
      strokeDisc(ctx, cx, cy, discRadius, 'rgba(255, 255, 255, 0.55)', 1);
      break;
    }
    case 'round_matte': {
      fillDisc(ctx, cx, cy, discRadius, base);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.beginPath();
      ctx.arc(cx, cy, discRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
      for (const [dx, dy] of [[-0.16, -0.16], [0.16, -0.12], [-0.08, 0.18], [0.2, 0.16]]) {
        ctx.beginPath();
        ctx.arc(cx + size * dx, cy + size * dy, Math.max(1, size * 0.035), 0, Math.PI * 2);
        ctx.fill();
      }
      strokeDisc(ctx, cx, cy, discRadius, alpha('#000000', 0.3), 1);
      break;
    }
    case 'round_pearl': {
      const gradient = ctx.createRadialGradient(
        cx - size * 0.16, cy - size * 0.2, size * 0.04,
        cx, cy, discRadius
      );
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      gradient.addColorStop(0.32, shade(base, 0.58));
      gradient.addColorStop(0.78, base);
      gradient.addColorStop(1, shade(base, -0.36));
      fillDisc(ctx, cx, cy, discRadius, gradient);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
      ctx.beginPath();
      ctx.ellipse(cx - size * 0.14, cy - size * 0.2, size * 0.16, size * 0.07, -0.4, 0, Math.PI * 2);
      ctx.fill();
      strokeDisc(ctx, cx, cy, discRadius, 'rgba(255, 255, 255, 0.45)', 1);
      break;
    }
    case 'round_planet': {
      const gradient = ctx.createRadialGradient(
        cx - size * 0.18, cy - size * 0.2, size * 0.03,
        cx, cy, discRadius
      );
      gradient.addColorStop(0, shade(base, 0.62));
      gradient.addColorStop(0.48, base);
      gradient.addColorStop(1, shade(base, -0.62));
      fillDisc(ctx, cx, cy, discRadius, gradient);
      ctx.strokeStyle = alpha(shade(base, 0.45), 0.85);
      ctx.lineWidth = Math.max(1, size * 0.07);
      ctx.beginPath();
      ctx.ellipse(cx, cy + size * 0.06, discRadius * 1.05, discRadius * 0.32, -0.28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
      ctx.beginPath();
      ctx.ellipse(cx + size * 0.18, cy + size * 0.18, size * 0.16, size * 0.06, -0.3, 0, Math.PI * 2);
      ctx.fill();
      strokeDisc(ctx, cx, cy, discRadius, alpha('#000000', 0.38), 1);
      break;
    }
    case 'classic':
    default: {
      fillTile(ctx, x + pad, y + pad, inner, inner, 3, base);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fillRect(x + pad, y + pad, inner, inner * 0.25);
      strokeTile(ctx, x + pad, y + pad, inner, inner, 3, 'rgba(0, 0, 0, 0.4)', 1);
      break;
    }
  }
  ctx.restore();
}
