import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PROFILE_ICONS = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'profileIcons.json'), 'utf8')
);

export const PROFILE_ICON_VALUES = PROFILE_ICONS.map((icon) => icon.key);

const PROFILE_ICON_EMOJI_PATTERN = /^\p{Extended_Pictographic}/u;

export function isProfileIconValue(value) {
  return typeof value === 'string' && (
    PROFILE_ICON_VALUES.includes(value) ||
    (value.length <= 16 && PROFILE_ICON_EMOJI_PATTERN.test(value))
  );
}
