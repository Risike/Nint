const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const GRADIENT_COLOR_PATTERN = /^gradient:(?:[0-9]|[1-9][0-9]|[12][0-9]{2}|3[0-5][0-9]):#[0-9a-f]{6}(?:,#[0-9a-f]{6}){1,5}$/i;
const GRADIENT_PARTS_PATTERN = /^gradient:(\d{1,3}):((?:#[0-9a-f]{6})(?:,#[0-9a-f]{6}){1,5})$/i;

export interface ParsedNameColor {
  color: string;
  backgroundImage?: string;
}

export function normalizeNameColor(value: unknown): string {
  const candidate = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return HEX_COLOR_PATTERN.test(candidate) || GRADIENT_COLOR_PATTERN.test(candidate)
    ? candidate
    : '#f8fafc';
}

export function parseNameColor(value: unknown): ParsedNameColor {
  const normalized = normalizeNameColor(value);
  if (HEX_COLOR_PATTERN.test(normalized)) {
    return { color: normalized };
  }

  const match = GRADIENT_PARTS_PATTERN.exec(normalized);
  if (!match) {
    return { color: normalized };
  }

  const colors = match[2].split(',');
  return {
    color: colors[0],
    backgroundImage: `linear-gradient(${Number(match[1])}deg, ${colors.join(', ')})`
  };
}
