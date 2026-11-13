import { getBossLevelDefinition } from './bossLevels';

export type BossAttack = 'rotation' | 'invert' | 'garbage' | 'blind' | 'speed' | 'ghostless';

export const BOSS_FIRST_ATTACK_MS = 30_000;
export const BOSS_ATTACK_INTERVAL_MS = 30_000;
export const BOSS_ATTACK_DURATION_MS = 15_000;
export const COOP_BOSS_HP_MULTIPLIER = 1.5;

export const BOSS_ATTACKS: BossAttack[] = [
  'rotation',
  'invert',
  'garbage',
  'blind',
  'speed',
  'ghostless'
];

export const BOSS_ATTACK_META: Record<BossAttack, {
  label: string;
  color: string;
  background: string;
  timed: boolean;
}> = {
  rotation: {
    label: 'Rotation Locked',
    color: 'var(--accent-purple)',
    background: 'rgba(168, 85, 247, 0.2)',
    timed: true
  },
  invert: {
    label: 'Controls Inverted',
    color: 'var(--accent-cyan)',
    background: 'rgba(6, 182, 212, 0.2)',
    timed: true
  },
  garbage: {
    label: 'Garbage Attack',
    color: 'var(--accent-red)',
    background: 'rgba(239, 68, 68, 0.2)',
    timed: false
  },
  blind: {
    label: 'Screen Blurred',
    color: 'var(--accent-slate, #94a3b8)',
    background: 'rgba(100, 116, 139, 0.25)',
    timed: true
  },
  speed: {
    label: 'Speed Up',
    color: 'var(--accent-orange)',
    background: 'rgba(249, 115, 22, 0.2)',
    timed: true
  },
  ghostless: {
    label: 'Ghost Piece Hidden',
    color: 'var(--accent-blue)',
    background: 'rgba(59, 130, 246, 0.2)',
    timed: true
  }
};

export const getCoopBossMaxHp = (level: number): number =>
  Math.ceil(getBossLevelDefinition(level).hp * COOP_BOSS_HP_MULTIPLIER);

export const isBossAttack = (value: unknown): value is BossAttack =>
  typeof value === 'string' && BOSS_ATTACKS.includes(value as BossAttack);