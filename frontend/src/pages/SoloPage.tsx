import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/engine/gameEngine';
import { KeyboardManager } from '../game/input/keyboardManager';
import { GamepadManager, DEFAULT_GAMEPAD_BINDINGS } from '../game/input/gamepadManager';
import { soundManager } from '../game/audio/soundManager';
import { PlayfieldCanvas } from '../components/game/PlayfieldCanvas';
import { HoldDisplay } from '../components/game/HoldDisplay';
import { QueueDisplay } from '../components/game/QueueDisplay';
import { HUD } from '../components/game/HUD';
import { GameOverModal } from '../components/game/GameOverModal';
import { CountdownOverlay } from '../components/game/CountdownOverlay';
import { BossHUD, type BossEffectBadge } from '../components/game/BossHUD';
import { BossDamageTrail, type BossDamageSpark } from '../components/game/BossDamageTrail';
import { BOARD_BUFFER_HEIGHT, BOARD_VISIBLE_HEIGHT } from '../game/engine/constants';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { ApiClient } from '../services/api';
import { LocalStorageManager } from '../services/storage';
import { getUnlockedCpuLevel } from '../game/cpuLevels';
import {
  BOSS_BASE_HP,
  MAX_BOSS_LEVEL,
  getBossLevelDefinition,
  getBossSpeedLevel,
  getUnlockedBossLevel,
  unlockBossLevelAfterWin
} from '../game/bossLevels';
import {
  BOSS_ATTACKS,
  BOSS_ATTACK_DURATION_MS,
  BOSS_ATTACK_INTERVAL_MS,
  BOSS_ATTACK_META,
  BOSS_FIRST_ATTACK_MS,
  type BossAttack
} from '../game/bossAttacks';
import { useDynamicCellSize } from '../hooks/useDynamicCellSize';
import { useDevBossKill } from '../hooks/useDevBossKill';
import { emptySoloRunStats, mergeSoloRunStats, type SoloRunStats } from '../game/soloRunStats';
import { useGamepadActive, useGamepadBack, scrollElementIntoViewSmart } from '../context/GamepadNavContext';
import { useI18n } from '../i18n/useI18n';
import { SoloModeMenu } from './SoloModeMenu';
import { Play, Pause, RotateCcw, ArrowLeft, Flame, Smile, Sliders } from 'lucide-react';

type SoloMode = 'marathon' | 'sprint' | 'ultra' | 'zen' | 'boss' | 'custom';

interface SoloInitOptions {
  bossCarryScore?: number;
  preserveBossRun?: boolean;
}

const BOSS_HUD_RESERVED_HEIGHT = 120;

interface SoloPageProps {
  initialMode?: string | null;
  onClearInitialMode?: () => void;
  onStartCpu?: (level: number) => void;
}

export const SoloPage: React.FC<SoloPageProps> = ({ initialMode, onClearInitialMode, onStartCpu }) => {
  const { user, isAuthenticated, refreshProfile } = useAuth();
  const { settings } = useSettings();
  const { t } = useI18n();

  const [unlockedCpuLevel, setUnlockedCpuLevel] = useState<number>(() => getUnlockedCpuLevel(user?.id));
  const [unlockedBossLevel, setUnlockedBossLevel] = useState<number>(() => getUnlockedBossLevel(user?.id));

  useEffect(() => {
    setUnlockedCpuLevel(getUnlockedCpuLevel(user?.id));
    setUnlockedBossLevel(getUnlockedBossLevel(user?.id));
  }, [user?.id]);

  const [mode, setMode] = useState<SoloMode>('marathon');
  const cellSize = useDynamicCellSize(false, undefined, mode === 'boss' ? BOSS_HUD_RESERVED_HEIGHT : 0);
  const [isSelectingMode, setIsSelectingMode] = useState<boolean>(true);
  const [isCountingDown, setIsCountingDown] = useState<boolean>(false);

  // Zen Custom Options
  const [isConfiguringZen, setIsConfiguringZen] = useState<boolean>(false);
  const [isConfiguringMarathon, setIsConfiguringMarathon] = useState<boolean>(false);
  const [zenLevel, setZenLevel] = useState<number>(1);
  const [zenFixedGravity, setZenFixedGravity] = useState<boolean>(true);
  const [zenImmortal, setZenImmortal] = useState<boolean>(true);
  const [zenGarbageLines, setZenGarbageLines] = useState<number>(0);
  const [zenLockDelay, setZenLockDelay] = useState<number>(settings.lockDelay || 500);
  // Zen gamepad section focus (0=level, 1=speed, 2=immortal, 3=garbage, 4=lockdelay, 5=back, 6=start)
  const [zenFocusSection, setZenFocusSection] = useState<number>(0);
  // Trigger flags for zen actions (avoids stale closures in RAF loop)
  const [zenActionPending, setZenActionPending] = useState<'start' | 'back' | null>(null);

  const sprintGoal = 40;
  const ultraDuration = 180000; // 3 mins
  const [marathonStartLevel, setMarathonStartLevel] = useState<number>(1);

  const [engine, setEngine] = useState<GameEngine>(() => new GameEngine());
  const [gameState, setGameState] = useState<string>('ready');
  const [score, setScore] = useState<number>(0);
  const [lines, setLines] = useState<number>(0);
  const [level, setLevel] = useState<number>(1);
  const [timeMs, setTimeMs] = useState<number>(0);
  const [holdPiece, setHoldPiece] = useState<any>(null);
  const [canHold, setCanHold] = useState<boolean>(true);
  const [nextQueue, setNextQueue] = useState<any[]>([]);
  const [combo, setCombo] = useState<number>(-1);
  const [b2b, setB2B] = useState<boolean>(false);
  const [isGameOverModalOpen, setIsGameOverModalOpen] = useState<boolean>(false);
  const [isVictory, setIsVictory] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  // Boss Attack state
  const [bossHp, setBossHp] = useState<number>(BOSS_BASE_HP);
  const [bossMaxHp, setBossMaxHp] = useState<number>(BOSS_BASE_HP);
  const [bossLevel, setBossLevel] = useState<number>(1);
  const [nextAttackAt, setNextAttackAt] = useState<number>(BOSS_FIRST_ATTACK_MS);
  const [pendingBossAttack, setPendingBossAttack] = useState<BossAttack | null>(null);
  const [activeBossEffects, setActiveBossEffects] = useState<BossAttack[]>([]);
  const [bossAttackBanner, setBossAttackBanner] = useState<{
    id: number;
    label: string;
    color: string;
    background: string;
  } | null>(null);
  const [bossDamageSparks, setBossDamageSparks] = useState<BossDamageSpark[]>([]);
  const [bossImpactKey, setBossImpactKey] = useState<number>(0);

  const isPlaying = !isSelectingMode && !isConfiguringZen && !isGameOverModalOpen && (gameState === 'playing' || isCountingDown);
  // Also suppress global gamepad nav during zen config (we handle it ourselves)
  useGamepadActive(isPlaying || isConfiguringZen);

  useGamepadBack(() => {
    if (isGameOverModalOpen) {
      exitToMenu();
      return true;
    }
    if (isConfiguringZen) {
      setIsConfiguringZen(false);
      setIsSelectingMode(true);
      return true;
    }
    if (isConfiguringMarathon) {
      setIsConfiguringMarathon(false);
      setIsSelectingMode(true);
      return true;
    }
    if (!isSelectingMode) {
      if (gameState === 'paused' || gameState === 'ready') {
        saveZenSessionTime();
        setIsSelectingMode(true);
        return true;
      }
      if (gameState === 'playing') {
        engine.pause();
        return true;
      }
    }
    return false;
  }, [isGameOverModalOpen, isConfiguringZen, isConfiguringMarathon, isSelectingMode, gameState, engine]);

  const keyboardManagerRef = useRef<KeyboardManager | null>(null);
  const gamepadManagerRef = useRef<GamepadManager | null>(null);
  const bossHpRef = useRef<number>(BOSS_BASE_HP);
  const bossLevelRef = useRef<number>(1);
  const bossRunStatsRef = useRef<SoloRunStats>(emptySoloRunStats());
  const bossRunSubmittedRef = useRef<boolean>(false);
  const bossRunSavingRef = useRef<boolean>(false);
  const bossStartingSpeedLevelRef = useRef<number>(1);
  const bossSpeedLevelRef = useRef<number>(1);
  const bossAttacksAppliedRef = useRef<number>(0);
  const nextAttackAtRef = useRef<number>(BOSS_FIRST_ATTACK_MS);
  const pendingBossAttackRef = useRef<BossAttack | null>(null);
  const activeBossEffectsRef = useRef<Map<BossAttack, number>>(new Map());
  const bossAttackBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bossAttackBannerIdRef = useRef<number>(0);
  const bossDamageSparkIdRef = useRef<number>(0);
  const bossDamageCleanupTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const playfieldRef = useRef<HTMLDivElement | null>(null);
  const bossHudRef = useRef<HTMLDivElement | null>(null);
  const zenTimeRecordedRef = useRef<number>(0);
  const zenLinesRecordedRef = useRef<number>(0);
  const zenPiecesRecordedRef = useRef<number>(0);

  // Refs for zen gamepad loop (always read fresh values, no stale closures)
  const zenLevelRef = useRef(zenLevel);
  zenLevelRef.current = zenLevel;
  const zenFixedGravityRef = useRef(zenFixedGravity);
  zenFixedGravityRef.current = zenFixedGravity;
  const zenImmortalRef = useRef(zenImmortal);
  zenImmortalRef.current = zenImmortal;
  const zenGarbageLinesRef = useRef(zenGarbageLines);
  zenGarbageLinesRef.current = zenGarbageLines;
  const zenLockDelayRef = useRef(zenLockDelay);
  zenLockDelayRef.current = zenLockDelay;
  const zenFocusSectionRef = useRef(zenFocusSection);
  zenFocusSectionRef.current = zenFocusSection;

  useDevBossKill(mode === 'boss' && !isSelectingMode && !isGameOverModalOpen, () => {
    bossHpRef.current = 0;
    pendingBossAttackRef.current = null;
    setPendingBossAttack(null);
    setBossImpactKey((key) => key + 1);
    setBossHp(0);
  });

  const resetBossState = (initialHp: number = BOSS_BASE_HP, startingSpeedLevel: number = 1) => {
    if (bossAttackBannerTimerRef.current) {
      clearTimeout(bossAttackBannerTimerRef.current);
      bossAttackBannerTimerRef.current = null;
    }
    bossDamageCleanupTimersRef.current.forEach((timer) => clearTimeout(timer));
    bossDamageCleanupTimersRef.current = [];
    bossHpRef.current = initialHp;
    bossStartingSpeedLevelRef.current = startingSpeedLevel;
    bossSpeedLevelRef.current = startingSpeedLevel;
    bossAttacksAppliedRef.current = 0;
    nextAttackAtRef.current = BOSS_FIRST_ATTACK_MS;
    pendingBossAttackRef.current = null;
    activeBossEffectsRef.current.clear();
    setBossHp(initialHp);
    setBossMaxHp(initialHp);
    setNextAttackAt(BOSS_FIRST_ATTACK_MS);
    setPendingBossAttack(null);
    setActiveBossEffects([]);
    setBossAttackBanner(null);
    setBossDamageSparks([]);
    setBossImpactKey(0);
  };

  const showBossBanner = (label: string, color: string, background: string) => {
    if (bossAttackBannerTimerRef.current) {
      clearTimeout(bossAttackBannerTimerRef.current);
    }
    bossAttackBannerIdRef.current += 1;
    setBossAttackBanner({ id: bossAttackBannerIdRef.current, label, color, background });
    bossAttackBannerTimerRef.current = setTimeout(() => {
      setBossAttackBanner(null);
      bossAttackBannerTimerRef.current = null;
    }, 2200);
  };

  const triggerBossLineImpact = (rows: number[], linesCleared: number) => {
    const canvas = playfieldRef.current?.querySelector<HTMLCanvasElement>('canvas');
    const hpBar = bossHudRef.current?.querySelector<HTMLElement>('[data-boss-hp-bar]');
    if (!canvas || !hpBar) return;

    const boardRect = canvas.getBoundingClientRect();
    const barRect = hpBar.getBoundingClientRect();
    if (boardRect.height <= 0 || barRect.width <= 0) return;

    const targetX = barRect.left + barRect.width / 2;
    const targetY = barRect.top + barRect.height / 2;
    const isTetris = linesCleared === 4;
    const color = '#ffffff';
    const sparksPerRow = isTetris ? 6 : 3 + linesCleared;
    const createdAt = Date.now();
    const sparks: BossDamageSpark[] = [];

    rows.forEach((row, rowIndex) => {
      const visibleRow = row - BOARD_BUFFER_HEIGHT;
      if (visibleRow < 0 || visibleRow >= BOARD_VISIBLE_HEIGHT) return;

      const startY = boardRect.top
        + (visibleRow + 0.5) * (boardRect.height / BOARD_VISIBLE_HEIGHT);

      for (let index = 0; index < sparksPerRow; index += 1) {
        const lane = (index + 0.5) / sparksPerRow;
        sparks.push({
          id: `boss-spark-${createdAt}-${row}-${index}-${bossDamageSparkIdRef.current++}`,
          startX: boardRect.left + boardRect.width * (0.08 + lane * 0.84),
          startY,
          endX: targetX + (lane - 0.5) * Math.min(72, barRect.width * 0.2),
          endY: targetY,
          delay: rowIndex * 32 + index * 22,
          duration: 620 + (index % 3) * 70,
          size: 4 + (index % 3) * 2,
          color
        });
      }
    });

    if (sparks.length === 0) return;

    setBossDamageSparks((current) => [...current, ...sparks]);
    const ids = new Set(sparks.map((spark) => spark.id));
    let cleanupTimer: ReturnType<typeof setTimeout>;
    cleanupTimer = setTimeout(() => {
      setBossDamageSparks((current) => current.filter((spark) => !ids.has(spark.id)));
      bossDamageCleanupTimersRef.current = bossDamageCleanupTimersRef.current
        .filter((timer) => timer !== cleanupTimer);
    }, 1200);
    bossDamageCleanupTimersRef.current.push(cleanupTimer);
  };

  const activateBossAttack = (attack: BossAttack, targetEngine: GameEngine) => {
    const meta = BOSS_ATTACK_META[attack];
    const now = targetEngine.totalPlayTimeMs;
    soundManager.playBossAttack(attack);

    switch (attack) {
      case 'rotation':
        targetEngine.rotationLocked = true;
        break;
      case 'invert':
        targetEngine.horizontalInverted = true;
        break;
      case 'garbage':
        targetEngine.garbageManager.enqueueGarbage(4);
        break;
      case 'blind':
      case 'ghostless':
        break;
      case 'speed':
        targetEngine.setGravityLevel(bossSpeedLevelRef.current + 2);
        break;
    }

    if (meta.timed) {
      activeBossEffectsRef.current.set(attack, now + BOSS_ATTACK_DURATION_MS);
      setActiveBossEffects(Array.from(activeBossEffectsRef.current.keys()));
    }

    // Only attacks that are actually applied count toward the speed increase;
    // countered Tetris attacks never reach this function.
    bossAttacksAppliedRef.current += 1;
    const nextSpeedLevel = getBossSpeedLevel(
      bossStartingSpeedLevelRef.current,
      bossAttacksAppliedRef.current
    );
    if (nextSpeedLevel !== bossSpeedLevelRef.current) {
      bossSpeedLevelRef.current = nextSpeedLevel;
      targetEngine.level = nextSpeedLevel;
      const speedOffset = activeBossEffectsRef.current.has('speed') ? 2 : 0;
      targetEngine.setGravityLevel(nextSpeedLevel + speedOffset);
      setLevel(nextSpeedLevel);
    }

    showBossBanner(t(meta.label), meta.color, meta.background);
  };

  useEffect(() => {
    if (isSelectingMode) {
      // The mode menu uses page scrolling; always open it at the top.
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [isSelectingMode]);

  useEffect(() => {
    return () => {
      if (bossAttackBannerTimerRef.current) {
        clearTimeout(bossAttackBannerTimerRef.current);
      }
      bossDamageCleanupTimersRef.current.forEach((timer) => clearTimeout(timer));
      bossDamageCleanupTimersRef.current = [];
    };
  }, []);

  const saveZenSessionTime = (sourceEngine: GameEngine = engine, sourceMode: string = mode) => {
    if (sourceMode === 'zen') {
      const currentMs = Math.round(sourceEngine.totalPlayTimeMs);
      const currentPieces = sourceEngine.getStats().piecesPlaced;
      const deltaMs = currentMs - zenTimeRecordedRef.current;
      const deltaLines = Math.max(0, sourceEngine.lines - zenLinesRecordedRef.current);
      const deltaPieces = Math.max(0, currentPieces - zenPiecesRecordedRef.current);
      if (deltaMs >= 1000 || deltaLines > 0) {
        zenTimeRecordedRef.current = currentMs;
        zenLinesRecordedRef.current = sourceEngine.lines;
        zenPiecesRecordedRef.current = currentPieces;
        const payload = {
          mode: 'zen',
          // The anti-cheat check needs a duration consistent with the pieces
          // sent; a line cleared just before leaving can otherwise be rejected.
          duration: Math.max(1000, deltaMs),
          lines: deltaLines,
          piecesPlaced: deltaPieces
        };
        if (isAuthenticated) {
          ApiClient.submitResult(payload).catch(console.warn);
        } else {
          const localResults = LocalStorageManager.getItem<any[]>('guest_results', []);
          localResults.unshift({ ...payload, date: Date.now() });
          LocalStorageManager.setItem('guest_results', localResults.slice(0, 50));
        }
      }
    }
  };

  // Save any accrued zen playtime on unmount or tab switch
  useEffect(() => {
    return () => {
      saveZenSessionTime(engine, mode);
      soundManager.stopBgm();
    };
  }, [mode, engine]);

  // Detach the global keyboard listener when leaving the page
  useEffect(() => {
    return () => {
      keyboardManagerRef.current?.detach();
    };
  }, []);

  // Handle zen action triggers (avoids stale closure in RAF loop)
  useEffect(() => {
    if (!zenActionPending) return;
    setZenActionPending(null);
    if (zenActionPending === 'back') {
      setIsConfiguringZen(false);
      setIsSelectingMode(true);
    } else if (zenActionPending === 'start') {
      startZenGame();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zenActionPending]);

  // Reset focus section when entering zen config
  useEffect(() => {
    if (isConfiguringZen) setZenFocusSection(0);
  }, [isConfiguringZen]);

  // Keep zen focused section in visible viewport (clearing sticky navbar and gamepad bar)
  useEffect(() => {
    if (!isConfiguringZen) return;
    const target = document.querySelector(`[data-zen-section="${zenFocusSection}"]`) as HTMLElement;
    if (target) {
      scrollElementIntoViewSmart(target);
    }
  }, [zenFocusSection, isConfiguringZen]);

  // Dedicated gamepad loop for zen config panel (bypasses spatial nav entirely)
  useEffect(() => {
    if (!isConfiguringZen) return;

    const ZEN_SECTIONS = 7;
    const levelPresets = [1, 5, 10, 15, 20];
    const garbageOptions = [0, 2, 4, 6, 8, 10, 14];
    const lockOptions = [500, 1000, 2000];

    let animId: number;
    let prevButtons: boolean[] = [];
    let dpadTimer = 0;
    let lastDir: string | null = null;
    let lastTime = performance.now();
    const DAS = 280;
    const ARR = 130;

    const handleZenInput = (dir: 'up' | 'down' | 'left' | 'right' | 'select' | 'back') => {
      const section = zenFocusSectionRef.current;

      if (dir === 'back') {
        setZenActionPending('back');
        soundManager.playMove();
        return;
      }

      if (dir === 'select') {
        switch (section) {
          case 1: // Speed Progression: toggle
            setZenFixedGravity(v => !v);
            soundManager.playRotate();
            break;
          case 2: // Anti-Game Over: toggle
            setZenImmortal(v => !v);
            soundManager.playRotate();
            break;
          case 5: // Back
            setZenActionPending('back');
            soundManager.playMove();
            break;
          case 6: // Start
            setZenActionPending('start');
            soundManager.playRotate();
            break;
          default:
            soundManager.playMove();
        }
        return;
      }

      if (dir === 'up') {
        setZenFocusSection(s => Math.max(0, s - 1));
        soundManager.playMove();
        return;
      }
      if (dir === 'down') {
        setZenFocusSection(s => Math.min(ZEN_SECTIONS - 1, s + 1));
        soundManager.playMove();
        return;
      }

      // Left / Right: change value within current section
      switch (section) {
        case 0: { // Starting Level
          const idx = levelPresets.indexOf(zenLevelRef.current);
          const cur = idx >= 0 ? idx : 0;
          const next = dir === 'left' ? Math.max(0, cur - 1) : Math.min(levelPresets.length - 1, cur + 1);
          if (next !== cur) { setZenLevel(levelPresets[next]); soundManager.playMove(); }
          break;
        }
        case 1: { // Speed Progression: Left=Fixed, Right=Dynamic
          const val = dir === 'left';
          if (zenFixedGravityRef.current !== val) { setZenFixedGravity(val); soundManager.playMove(); }
          break;
        }
        case 2: { // Anti-Game Over: Left=Auto-Recovery, Right=Standard
          const val = dir === 'left';
          if (zenImmortalRef.current !== val) { setZenImmortal(val); soundManager.playMove(); }
          break;
        }
        case 3: { // Downstack Lines
          const idx = garbageOptions.indexOf(zenGarbageLinesRef.current);
          const cur = idx >= 0 ? idx : 0;
          const next = dir === 'left' ? Math.max(0, cur - 1) : Math.min(garbageOptions.length - 1, cur + 1);
          if (next !== cur) { setZenGarbageLines(garbageOptions[next]); soundManager.playMove(); }
          break;
        }
        case 4: { // Lock Delay
          const idx = lockOptions.indexOf(zenLockDelayRef.current);
          const cur = idx >= 0 ? idx : 0;
          const next = dir === 'left' ? Math.max(0, cur - 1) : Math.min(lockOptions.length - 1, cur + 1);
          if (next !== cur) { setZenLockDelay(lockOptions[next]); soundManager.playMove(); }
          break;
        }
        case 5: // Back button row: Right → Start
          if (dir === 'right') { setZenFocusSection(6); soundManager.playMove(); }
          break;
        case 6: // Start button row: Left → Back
          if (dir === 'left') { setZenFocusSection(5); soundManager.playMove(); }
          break;
      }
    };

    const poll = (time: number) => {
      const delta = time - lastTime;
      lastTime = time;

      const gamepads = typeof navigator !== 'undefined' ? navigator.getGamepads?.() : null;
      const gp = gamepads ? Array.from(gamepads).find(g => g && g.connected) : null;

      if (gp) {
        const buttons = gp.buttons.map(b => (typeof b === 'object' ? b.pressed : b === 1.0));
        const axes = gp.axes;
        const justPressed = (i: number) => buttons[i] && !prevButtons[i];

        if (justPressed(0)) handleZenInput('select');
        if (justPressed(1) || justPressed(8)) handleZenInput('back');

        const stickX = axes[0] || 0;
        const stickY = axes[1] || 0;
        const upP    = buttons[12] || stickY < -0.55;
        const downP  = buttons[13] || stickY > 0.55;
        const leftP  = buttons[14] || stickX < -0.55;
        const rightP = buttons[15] || stickX > 0.55;

        let activeDir: 'up' | 'down' | 'left' | 'right' | null = null;
        if (upP)    activeDir = 'up';
        else if (downP)  activeDir = 'down';
        else if (leftP)  activeDir = 'left';
        else if (rightP) activeDir = 'right';

        if (activeDir) {
          if (lastDir !== activeDir) {
            lastDir = activeDir;
            dpadTimer = 0;
            handleZenInput(activeDir);
          } else {
            dpadTimer += delta;
            if (dpadTimer >= DAS) {
              const excess = dpadTimer - DAS;
              if (excess >= ARR) {
                dpadTimer = DAS;
                handleZenInput(activeDir);
              }
            }
          }
        } else {
          lastDir = null;
          dpadTimer = 0;
        }

        prevButtons = buttons;
      }

      animId = requestAnimationFrame(poll);
    };

    animId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(animId);
  }, [isConfiguringZen]); // Only restart when zen config opens/closes

  // Handle direct navigation to a mode from homepage
  const pendingInitialModeRef = useRef<string | null | undefined>(null);
  useEffect(() => {
    pendingInitialModeRef.current = initialMode;
  }, [initialMode]);

  useEffect(() => {
    const m = pendingInitialModeRef.current;
    if (!m) return;
    if (m === 'zen') {
      setMode('zen');
      setIsSelectingMode(false);
      setIsConfiguringZen(true);
      setIsConfiguringMarathon(false);
      onClearInitialMode?.();
    } else if (m === 'marathon') {
      setMode('marathon');
      setIsSelectingMode(false);
      setIsConfiguringZen(false);
      setIsConfiguringMarathon(true);
      onClearInitialMode?.();
    } else if (m === 'sprint' || m === 'ultra' || m === 'boss') {
      const validMode = m as 'sprint' | 'ultra' | 'boss';
      setMode(validMode);
      setIsSelectingMode(false);
      setIsConfiguringZen(false);
      setIsConfiguringMarathon(false);
      onClearInitialMode?.();
      // Use a microtask to ensure state is set before initGame reads it
      setTimeout(() => {
        initGame(validMode);
      }, 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMode]);

  const launchSelectedMode = (selectedMode: SoloMode) => {
    setMode(selectedMode);
    if (selectedMode === 'zen') {
      setIsSelectingMode(false);
      setIsConfiguringZen(true);
      setIsConfiguringMarathon(false);
    } else if (selectedMode === 'marathon') {
      setIsSelectingMode(false);
      setIsConfiguringZen(false);
      setIsConfiguringMarathon(true);
    } else {
      setIsSelectingMode(false);
      setIsConfiguringZen(false);
      setIsConfiguringMarathon(false);
      initGame(selectedMode);
    }
  };

  const startZenGame = () => {
    setIsConfiguringZen(false);
    initGame('zen');
  };

  const startMarathonGame = () => {
    setIsConfiguringMarathon(false);
    initGame('marathon');
  };

  const initGame = (targetMode?: SoloMode, targetBossLevel?: number, options: SoloInitOptions = {}) => {
    soundManager.stopBgm();
    // Solo uses page scrolling so the browser scrollbar stays at the right
    // edge; starting a game should bring the HUD and header back into view.
    window.scrollTo({ top: 0, behavior: 'instant' });
    const activeMode = (typeof targetMode === 'string') ? targetMode : mode;
    const bossCarryScore = activeMode === 'boss'
      ? Math.max(0, Number(options.bossCarryScore) || 0)
      : 0;
    if (activeMode === 'boss' && !options.preserveBossRun) {
      bossRunStatsRef.current = emptySoloRunStats();
      bossRunSubmittedRef.current = false;
    }
    const bossDefinition = activeMode === 'boss'
      ? getBossLevelDefinition(targetBossLevel ?? bossLevelRef.current)
      : null;
    const resolvedBossLevel = bossDefinition?.level ?? 1;
    bossLevelRef.current = resolvedBossLevel;
    setBossLevel(resolvedBossLevel);
    resetBossState(
      bossDefinition?.hp ?? BOSS_BASE_HP,
      bossDefinition?.startingSpeedLevel ?? 1
    );
    const isZen = activeMode === 'zen';
    const startingLevel = bossDefinition
      ? bossDefinition.startingSpeedLevel
      : isZen ? zenLevel : activeMode === 'marathon' ? marathonStartLevel : 1;
    const fixedGravity = isZen ? zenFixedGravity : Boolean(bossDefinition);
    const lineLevelProgression = !bossDefinition;
    const immortal = isZen ? zenImmortal : false;
    const startingGarbageLines = isZen ? zenGarbageLines : 0;
    const lockDelay = isZen ? zenLockDelay : settings.lockDelay;

    const newEngine = new GameEngine({
      das: settings.das,
      arr: settings.arr,
      softDropFactor: settings.softDropFactor,
      lockDelay,
      startingLevel,
      fixedGravity,
      lineLevelProgression,
      immortal,
      startingGarbageLines
    }, {
      onPieceSpawn: () => {
        setNextQueue([...newEngine.randomizer.peek(6)]);
        setHoldPiece(newEngine.holdPiece);
        setCanHold(newEngine.canHold);
      },
      onPieceMove: () => soundManager.playMove(),
      onPieceRotate: () => soundManager.playRotate(),
      onPieceLock: () => soundManager.playLock(),
      onLineClear: (res) => {
        soundManager.playClear(res.linesCleared);
        if (res.tSpin !== 'none') soundManager.playTSpin();
        if (res.comboCount > 0) soundManager.playCombo(res.comboCount);
        setB2B(res.isB2B);
        setCombo(res.comboCount);
      },
      onScoreUpdate: (s, l, lvl) => {
        setScore(bossCarryScore + s);
        setLines(l);
        setLevel(lvl);
      },
      onPieceLocked: (info) => {
        if (activeMode !== 'boss') return;

        // Every point scored removes one boss HP, including Tetris clears.
        if (info.scoreGained > 0) {
          const nextHp = Math.max(0, bossHpRef.current - info.scoreGained);
          bossHpRef.current = nextHp;
          setBossHp(nextHp);
        }

        if (info.linesCleared > 0) {
          triggerBossLineImpact(info.clearedRows, info.linesCleared);
          setBossImpactKey((key) => key + 1);
          soundManager.playBossDamage(info.linesCleared);
        }

        // The killing blow ends the fight immediately; the boss gets no last attack.
        if (bossHpRef.current <= 0) {
          pendingBossAttackRef.current = null;
          setPendingBossAttack(null);
          return;
        }

        const pending = pendingBossAttackRef.current;
        if (!pending) return;

        pendingBossAttackRef.current = null;
        setPendingBossAttack(null);
        nextAttackAtRef.current = newEngine.totalPlayTimeMs + BOSS_ATTACK_INTERVAL_MS;
        setNextAttackAt(nextAttackAtRef.current);

        // A Tetris cancels the queued attack and still scores its points.
        if (info.tetris) {
          soundManager.playBossCounter();
          showBossBanner(t('Attack countered!'), 'var(--accent-green)', 'rgba(34, 197, 94, 0.2)');
          return;
        }

        activateBossAttack(pending, newEngine);
      },
      onStateChange: (state) => {
        setGameState(state);
        if (state === 'paused') soundManager.pauseBgm();
        else if (state === 'playing') soundManager.resumeBgm();
        else if (state === 'gameover' || state === 'completed') soundManager.stopBgm();
      },
      onGameOver: () => handleGameOver(false, newEngine, activeMode)
    });

    setEngine(newEngine);
    setGameState('ready');
    setScore(bossCarryScore);
    setLines(0);
    setLevel(startingLevel);
    setTimeMs(0);
    setCombo(-1);
    setB2B(false);
    setIsGameOverModalOpen(false);
    setIsSaved(false);

    // Next queue before countdown: show exact upcoming pieces with the 1st falling piece on top
    newEngine.activePiece = null;
    setNextQueue([...newEngine.randomizer.peek(6)]);
    setHoldPiece(null);
    setCanHold(true);

    if (keyboardManagerRef.current) {
      keyboardManagerRef.current.detach();
    }

    const km = new KeyboardManager(newEngine, settings.keybindings, {
      onRestart: () => initGame(activeMode),
      onPause: () => {
        if (newEngine.state === 'playing') newEngine.pause();
        else if (newEngine.state === 'paused') newEngine.resume();
      }
    });
    km.attach();
    keyboardManagerRef.current = km;

    gamepadManagerRef.current = new GamepadManager(newEngine, settings.gamepadBindings || DEFAULT_GAMEPAD_BINDINGS, {
      onRestart: () => initGame(activeMode),
      onPause: () => {
        if (newEngine.state === 'playing') newEngine.pause();
        else if (newEngine.state === 'paused') newEngine.resume();
      }
    });

    // Start 3-second countdown before game begins
    setIsCountingDown(true);
  };

  const handleCountdownComplete = () => {
    setIsCountingDown(false);
    // A fresh session starts here; previous zen session has already been saved.
    zenTimeRecordedRef.current = 0;
    zenLinesRecordedRef.current = 0;
    zenPiecesRecordedRef.current = 0;
    engine.state = 'playing';
    engine.startTime = Date.now();
    engine.spawnPiece();
    setNextQueue([...engine.randomizer.peek(6)]);
    setGameState('playing');
    soundManager.startBgm();
  };

  // Main game loop ticker
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const tick = (currentTime: number) => {
      const delta = currentTime - lastTime;
      lastTime = currentTime;

      if (!isSelectingMode && !isCountingDown) {
        if (engine.state === 'playing') {
          engine.update(delta);
          keyboardManagerRef.current?.update(delta);
          gamepadManagerRef.current?.update(delta);
          setTimeMs(engine.totalPlayTimeMs);

          // Sprint mode victory condition (allow final line clear animation to complete)
          if (mode === 'sprint' && engine.lines >= sprintGoal && engine.clearingRows.length === 0) {
            engine.state = 'completed';
            handleGameOver(true, engine, mode);
          }

          // Ultra mode timer expiration
          if (mode === 'ultra' && engine.totalPlayTimeMs >= ultraDuration && engine.clearingRows.length === 0) {
            engine.state = 'completed';
            handleGameOver(true, engine, mode);
          }

          // Marathon standard 150 lines victory
          if (mode === 'marathon' && engine.lines >= 150 && engine.clearingRows.length === 0) {
            engine.state = 'completed';
            handleGameOver(true, engine, mode);
          }

          if (mode === 'boss') {
            let effectsChanged = false;
            activeBossEffectsRef.current.forEach((endsAt, attack) => {
              if (engine.totalPlayTimeMs >= endsAt) {
                if (attack === 'rotation') engine.rotationLocked = false;
                if (attack === 'invert') engine.horizontalInverted = false;
                if (attack === 'speed') engine.setGravityLevel(bossSpeedLevelRef.current);
                activeBossEffectsRef.current.delete(attack);
                effectsChanged = true;
              }
            });
            if (effectsChanged) {
              setActiveBossEffects(Array.from(activeBossEffectsRef.current.keys()));
            }

            if (!pendingBossAttackRef.current && engine.totalPlayTimeMs >= nextAttackAtRef.current) {
              const attack = BOSS_ATTACKS[Math.floor(Math.random() * BOSS_ATTACKS.length)];
              pendingBossAttackRef.current = attack;
              setPendingBossAttack(attack);
            }

            if (bossHpRef.current <= 0 && engine.clearingRows.length === 0) {
              engine.state = 'completed';
              handleGameOver(true, engine, mode);
            }
          }
        }
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [engine, mode, sprintGoal, ultraDuration, isSelectingMode, isCountingDown]);

  const persistSoloResult = async (sourceMode: string, stats: SoloRunStats): Promise<boolean> => {
    const resultPayload = {
      mode: sourceMode === 'sprint'
        ? `sprint_${sprintGoal}`
        : sourceMode === 'ultra'
          ? 'ultra_3m'
          : sourceMode === 'boss'
            ? 'boss_attack'
            : 'marathon_150',
      score: stats.score,
      lines: stats.lines,
      level: stats.level,
      duration: Math.round(stats.duration),
      piecesPlaced: stats.piecesPlaced,
      pps: stats.pps,
      apm: stats.apm,
      tetrises: stats.tetrises,
      tSpins: stats.tSpins,
      perfectClears: stats.perfectClears,
      maxCombo: stats.maxCombo,
      maxB2B: stats.maxB2B
    };

    if (isAuthenticated) {
      try {
        await ApiClient.submitResult(resultPayload);
        setIsSaved(true);
        // Credits can change even when the run ends in a loss.
        refreshProfile().catch(() => {});
        return true;
      } catch (err) {
        console.warn('Failed to save result:', err);
        setIsSaved(false);
        return false;
      }
    }

    const localResults = LocalStorageManager.getItem<any[]>('guest_results', []);
    localResults.unshift({ ...resultPayload, date: Date.now() });
    LocalStorageManager.setItem('guest_results', localResults.slice(0, 50));
    setIsSaved(false);
    return true;
  };

  const finalizeBossRun = async (sourceEngine: GameEngine = engine): Promise<boolean> => {
    if (bossRunSubmittedRef.current || bossRunSavingRef.current) {
      return bossRunSubmittedRef.current;
    }

    bossRunSavingRef.current = true;
    const stats = mergeSoloRunStats(bossRunStatsRef.current, sourceEngine.getStats());
    const saved = await persistSoloResult('boss', stats);
    bossRunSavingRef.current = false;
    if (saved) bossRunSubmittedRef.current = true;
    return saved;
  };

  const handleGameOver = async (victory: boolean, sourceEngine: GameEngine = engine, sourceMode: string = mode) => {
    soundManager.stopBgm();
    setIsVictory(victory);
    setIsGameOverModalOpen(true);
    if (!victory) {
      soundManager.playGameOver();
    } else {
      soundManager.playClear(4);
    }

    // Zen Mode: no leaderboard or competitive statistics, but cleared lines
    // still earn credits for the account.
    if (sourceMode === 'zen') {
      saveZenSessionTime(sourceEngine, sourceMode);
      setIsSaved(true);
      return;
    }

    if (sourceMode === 'boss') {
      if (victory) {
        setUnlockedBossLevel(unlockBossLevelAfterWin(bossLevelRef.current, user?.id));
      }

      // A victory below the last boss keeps the run alive. The accumulated
      // score is saved when the player continues, loses, or leaves the run.
      if (victory && bossLevelRef.current < MAX_BOSS_LEVEL) {
        setIsSaved(false);
        return;
      }

      await finalizeBossRun(sourceEngine);
      return;
    }

    await persistSoloResult(sourceMode, sourceEngine.getStats());
  };

  const startNextBoss = () => {
    if (bossLevelRef.current >= MAX_BOSS_LEVEL) return;

    const carriedStats = mergeSoloRunStats(bossRunStatsRef.current, engine.getStats());
    bossRunStatsRef.current = carriedStats;
    bossRunSubmittedRef.current = false;
    initGame('boss', bossLevelRef.current + 1, {
      bossCarryScore: carriedStats.score,
      preserveBossRun: true
    });
  };

  const exitToMenu = () => {
    if (mode === 'boss' && isGameOverModalOpen) {
      void finalizeBossRun();
    }
    setIsGameOverModalOpen(false);
    setIsSelectingMode(true);
  };

  const handleModalRestart = () => {
    if (mode === 'boss' && isVictory && bossLevel < MAX_BOSS_LEVEL) {
      startNextBoss();
      return;
    }
    initGame();
  };

  const currentStats = mode === 'boss'
    ? mergeSoloRunStats(bossRunStatsRef.current, engine.getStats())
    : engine.getStats();
  const isBossMode = mode === 'boss';
  const bossEffectBadges: BossEffectBadge[] = activeBossEffects.map((attack) => {
    const meta = BOSS_ATTACK_META[attack];
    return { label: t(meta.label), color: meta.color, background: meta.background };
  });
  const bossBoardEffect = activeBossEffects.find((attack) => BOSS_ATTACK_META[attack].timed);
  const bossBoardColor = bossBoardEffect ? BOSS_ATTACK_META[bossBoardEffect].color : null;
  const pendingBossAttackName = pendingBossAttack ? t(BOSS_ATTACK_META[pendingBossAttack].label) : null;

  // Mode Selection Screen (When clicking Solo)
  if (isSelectingMode) {
    return (
      <SoloModeMenu
        onSelectMode={launchSelectedMode}
        onStartCpu={(level) => {
          if (level <= unlockedCpuLevel) onStartCpu?.(level);
        }}
        unlockedCpuLevel={unlockedCpuLevel}
        onStartBoss={(level) => {
          if (level <= unlockedBossLevel) {
            setMode('boss');
            setIsSelectingMode(false);
            setIsConfiguringZen(false);
            setIsConfiguringMarathon(false);
            initGame('boss', level);
          }
        }}
        unlockedBossLevel={unlockedBossLevel}
      />
    );
  }

  // Marathon pre-game configuration panel
  if (isConfiguringMarathon) {
    return (
      <div style={{ width: '100%', maxWidth: '720px', marginTop: '1rem' }}>
        <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: '50%', background: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent-cyan)', marginBottom: '0.5rem' }}>
            <Flame size={32} />
          </div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.3rem' }}>{t('Marathon')}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {t('Choose your Marathon starting level before the game begins.')}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.3rem' }}>
            {t('🎮 ↑↓ Navigate · ←→ Change value · A Confirm · B Back')}
          </p>
        </div>

        <div className="panel-card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '0.65rem' }}>
              <label htmlFor="marathon-start-level" style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                {t('Marathon Starting Level')}
              </label>
              <span style={{ color: 'var(--accent-cyan)', fontWeight: 800, fontSize: '0.95rem' }}>
                {t('Level {level} ({ms}ms)', { level: marathonStartLevel, ms: GameEngine.defaultGravityCurve(marathonStartLevel) })}
              </span>
            </div>
            <input
              id="marathon-start-level"
              type="range"
              min="1"
              max="15"
              step="1"
              value={marathonStartLevel}
              onChange={(e) => setMarathonStartLevel(parseInt(e.target.value, 10))}
              style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
            />
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              {t('The Marathon starts at the selected speed and scoring level.')}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              onClick={() => {
                setIsConfiguringMarathon(false);
                setIsSelectingMode(true);
              }}
            >
              <ArrowLeft size={16} /> {t('Back')}
            </button>
            <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={startMarathonGame}>
              <Play size={16} /> {t('Start Marathon')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Zen Mode Pre-game Configuration Panel
  if (isConfiguringZen) {
    const zenSec = (n: number): React.CSSProperties => ({
      borderRadius: 'var(--radius-sm)',
      padding: '0.4rem',
      margin: '-0.4rem',
      boxShadow: zenFocusSection === n ? '0 0 0 2px var(--accent-cyan), 0 0 12px rgba(6,182,212,0.3)' : 'none',
      transition: 'box-shadow 0.1s ease',
    });
    const optBtn = (active: boolean, activeColor: string, activeBg: string): React.CSSProperties => ({
      flex: 1,
      padding: '1rem',
      borderRadius: 'var(--radius-sm)',
      border: `2px solid ${active ? activeColor : 'var(--border-color)'}`,
      background: active ? activeBg : 'var(--bg-tertiary)',
      cursor: 'pointer',
      textAlign: 'left' as const,
    });

    return (
      <div style={{ width: '100%', maxWidth: '720px', marginTop: '1rem' }}>
        <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: '50%', background: 'rgba(168, 85, 247, 0.15)', color: 'var(--accent-purple)', marginBottom: '0.5rem' }}>
            <Smile size={32} />
          </div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.3rem' }}>{t('Zen & Practice Settings')}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {t('Configure your custom session parameters before playing.')}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.3rem' }}>
            {t('🎮 ↑↓ Navigate · ←→ Change value · A Confirm · B Back')}
          </p>
        </div>

        <div className="panel-card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Section 0 — Starting Speed / Level */}
          <div data-zen-section="0" style={zenSec(0)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ fontWeight: 700, fontSize: '0.95rem' }}>{t('Starting Speed / Level')}</label>
              <span style={{ color: 'var(--accent-cyan)', fontWeight: 800, fontSize: '0.95rem' }}>
                {t('Level {level} ({ms}ms)', { level: zenLevel, ms: GameEngine.defaultGravityCurve(zenLevel) })}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              {[
                { label: t('Relaxed (Lv 1)'), lvl: 1 },
                { label: t('Chill (Lv 5)'), lvl: 5 },
                { label: t('Brisk (Lv 10)'), lvl: 10 },
                { label: t('Intense (Lv 15)'), lvl: 15 },
                { label: t('20G Instant (Lv 20)'), lvl: 20 }
              ].map(p => (
                <button
                  key={p.lvl}
                  type="button"
                  onClick={() => setZenLevel(p.lvl)}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    background: zenLevel === p.lvl ? 'var(--accent-purple)' : 'var(--bg-tertiary)',
                    color: zenLevel === p.lvl ? '#ffffff' : 'var(--text-primary)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.8rem'
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <input
              type="range"
              min={1}
              max={20}
              value={zenLevel}
              tabIndex={-1}
              onChange={(e) => setZenLevel(parseInt(e.target.value, 10))}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>

          {/* Section 1 — Speed Progression */}
          <div data-zen-section="1" style={zenSec(1)}>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.5rem' }}>
              {t('Speed Progression')}
            </label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" onClick={() => setZenFixedGravity(true)} style={optBtn(zenFixedGravity, 'var(--accent-purple)', 'rgba(168, 85, 247, 0.1)')}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.2rem', color: zenFixedGravity ? 'var(--accent-purple)' : 'var(--text-primary)' }}>
                  {t('🧘 Fixed Speed (Constant)')}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {t('Gravity never accelerates. Zero pressure endless meditation.')}
                </div>
              </button>
              <button type="button" onClick={() => setZenFixedGravity(false)} style={optBtn(!zenFixedGravity, 'var(--accent-purple)', 'rgba(168, 85, 247, 0.1)')}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.2rem', color: !zenFixedGravity ? 'var(--accent-purple)' : 'var(--text-primary)' }}>
                  {t('⚡ Dynamic (Accelerates)')}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {t('Gravity steadily speeds up every 10 lines as in Marathon.')}
                </div>
              </button>
            </div>
          </div>

          {/* Section 2 — Anti-Game Over */}
          <div data-zen-section="2" style={zenSec(2)}>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.5rem' }}>
              {t('Anti-Game Over (Zen Immortality)')}
            </label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" onClick={() => setZenImmortal(true)} style={optBtn(zenImmortal, 'var(--accent-green)', 'rgba(34, 197, 94, 0.1)')}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.2rem', color: zenImmortal ? 'var(--accent-green)' : 'var(--text-primary)' }}>
                  {t('🛡️ Auto-Recovery (No Game Over)')}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {t('Touching the ceiling clears the board and continues smoothly without ending the game.')}
                </div>
              </button>
              <button type="button" onClick={() => setZenImmortal(false)} style={optBtn(!zenImmortal, 'var(--accent-red)', 'rgba(239, 68, 68, 0.1)')}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.2rem', color: !zenImmortal ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                  {t('🛑 Standard Game Over')}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {t('Overfilling the board results in a normal game over screen.')}
                </div>
              </button>
            </div>
          </div>

          {/* Section 3 — Downstack Practice */}
          <div data-zen-section="3" style={zenSec(3)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label style={{ fontWeight: 700, fontSize: '0.95rem' }}>{t('Downstack Practice (Starting Lines)')}</label>
              <span style={{ color: 'var(--accent-yellow)', fontWeight: 800, fontSize: '0.9rem' }}>
                {zenGarbageLines === 0 ? t('Clean Board') : t('{count} Lines', { count: zenGarbageLines })}
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>
              {t('Pre-fill the board with garbage rows with single holes to practice digging and downstacking.')}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {[0, 2, 4, 6, 8, 10, 14].map(count => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setZenGarbageLines(count)}
                  style={{
                    padding: '0.4rem 0.8rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    background: zenGarbageLines === count ? 'var(--accent-yellow)' : 'var(--bg-tertiary)',
                    color: zenGarbageLines === count ? '#000000' : 'var(--text-primary)',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.8rem'
                  }}
                >
                  {count === 0 ? t('Empty (0)') : t('{count} Lines', { count })}
                </button>
              ))}
            </div>
          </div>

          {/* Section 4 — Lock Delay */}
          <div data-zen-section="4" style={zenSec(4)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label style={{ fontWeight: 700, fontSize: '0.95rem' }}>{t('Lock Delay')}</label>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{zenLockDelay}ms</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[
                { label: t('Standard (500ms)'), ms: 500 },
                { label: t('Relaxed (1000ms)'), ms: 1000 },
                { label: t('Uncapped (2000ms)'), ms: 2000 }
              ].map(d => (
                <button
                  key={d.ms}
                  type="button"
                  onClick={() => setZenLockDelay(d.ms)}
                  style={{
                    flex: 1,
                    padding: '0.4rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    background: zenLockDelay === d.ms ? 'var(--accent-cyan)' : 'var(--bg-tertiary)',
                    color: zenLockDelay === d.ms ? '#000000' : 'var(--text-primary)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.8rem'
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sections 5 & 6 — Action Buttons */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <button
              data-zen-section="5"
              className="btn-secondary"
              onClick={() => { setIsConfiguringZen(false); setIsSelectingMode(true); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '0.5rem', padding: '0.75rem 1.25rem',
                boxShadow: zenFocusSection === 5 ? '0 0 0 2px var(--accent-cyan), 0 0 12px rgba(6,182,212,0.3)' : 'none',
                transition: 'box-shadow 0.1s ease',
              }}
            >
              <ArrowLeft size={18} />
              <span>{t('Back to Modes')}</span>
            </button>
            <button
              data-zen-section="6"
              className="btn-primary"
              onClick={startZenGame}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '0.5rem', padding: '0.75rem', fontSize: '1.05rem',
                background: 'linear-gradient(135deg, #a855f7, #06b6d4)',
                boxShadow: zenFocusSection === 6 ? '0 0 0 2px var(--accent-cyan), 0 0 12px rgba(6,182,212,0.3)' : 'none',
                transition: 'box-shadow 0.1s ease',
              }}
            >
              <Play size={20} />
              <span>{t('Start Zen Session')}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }


  // Active Game Screen
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      {isBossMode && <BossDamageTrail sparks={bossDamageSparks} />}

      {/* Top Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          className="btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem' }}
          onClick={() => {
            saveZenSessionTime();
            soundManager.stopBgm();
            setIsSelectingMode(true);
          }}
        >
          <ArrowLeft size={16} /> {t('Mode Menu')}
        </button>

        {mode === 'zen' && (
          <button
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', borderColor: 'var(--accent-purple)' }}
            onClick={() => {
              saveZenSessionTime();
              engine.pause();
              setIsConfiguringZen(true);
            }}
          >
            <Sliders size={16} color="var(--accent-purple)" /> {t('Zen Settings')}
          </button>
        )}

        <div style={{
          background: 'var(--bg-tertiary)',
          padding: '0.4rem 0.8rem',
          borderRadius: 'var(--radius-sm)',
          fontWeight: 700,
          fontSize: '0.85rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          {t('Mode: {mode}', { mode: t(mode === 'marathon' ? 'Marathon' : mode === 'sprint' ? 'Sprint (40 Lines)' : mode === 'ultra' ? 'Ultra' : mode === 'boss' ? 'Boss Battle' : 'Practice') })}{mode === 'sprint' ? ` (${sprintGoal}L)` : mode === 'ultra' ? ' (3m)' : mode === 'zen' ? ` (${t('Level')} ${zenLevel}${zenFixedGravity ? ` • ${t('Fixed')}` : ''}${zenImmortal ? ` • ${t('Immortal')}` : ''})` : mode === 'boss' ? ` (${t('Level')} ${bossLevel} • ${t('Speed')} ${level})` : ''}
        </div>
      </div>

      {isBossMode && (
        <div ref={bossHudRef} style={{ width: '100%', maxWidth: '760px', marginBottom: '0.75rem' }}>
          <BossHUD
            hp={bossHp}
            maxHp={bossMaxHp}
            nextAttackMs={Math.max(0, nextAttackAt - timeMs)}
            pendingAttackName={pendingBossAttackName}
            activeEffects={bossEffectBadges}
            impactKey={bossImpactKey}
          />
        </div>
      )}

      {/* Main Game Arena */}
      <div className="game-layout">
        {/* Left Side: Hold & HUD */}
        <div className="side-panel">
          <HoldDisplay piece={holdPiece} canHold={canHold} />
          <HUD
            score={score}
            lines={lines}
            level={level}
            timeMs={timeMs}
            combo={combo}
            b2b={b2b}
            b2bChain={engine.b2bChain}
            pps={currentStats.pps}
            apm={currentStats.apm}
          />
        </div>

        {/* Center: Playfield */}
        <div
          ref={playfieldRef}
          style={{
            position: 'relative',
            borderRadius: 'var(--radius-md)',
            boxShadow: bossBoardColor ? `0 0 0 3px ${bossBoardColor}, 0 0 30px ${bossBoardColor}` : 'none',
            transition: 'box-shadow 200ms ease'
          }}
        >
          <PlayfieldCanvas
            engine={engine}
            cellSize={cellSize}
            hideGhost={isBossMode && activeBossEffects.includes('ghostless')}
          />

          {isBossMode && activeBossEffects.includes('blind') && (
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: '16% 0',
                pointerEvents: 'none',
                borderRadius: 'inherit',
                background: 'repeating-linear-gradient(0deg, rgba(2, 6, 23, 0.9) 0 13px, rgba(15, 23, 42, 0.35) 13px 22px), repeating-linear-gradient(90deg, transparent 0 22px, rgba(2, 6, 23, 0.72) 22px 38px)',
                backdropFilter: 'blur(1.5px)',
                opacity: 0.92
              }}
            />
          )}

          {isBossMode && bossAttackBanner && (
            <div
              key={bossAttackBanner.id}
              role="status"
              aria-live="polite"
              style={{
                position: 'absolute',
                left: '50%',
                top: '10%',
                transform: 'translateX(-50%)',
                zIndex: 2,
                pointerEvents: 'none',
                padding: '0.38rem 0.8rem',
                borderRadius: '999px',
                background: bossAttackBanner.background,
                color: bossAttackBanner.color,
                border: `1px solid ${bossAttackBanner.color}`,
                boxShadow: '0 5px 22px rgba(0, 0, 0, 0.45)',
                fontSize: '0.8rem',
                fontWeight: 800,
                whiteSpace: 'nowrap'
              }}
            >
              {bossAttackBanner.label}
            </div>
          )}

          {/* 3-Second Countdown Overlay */}
          <CountdownOverlay active={isCountingDown} onComplete={handleCountdownComplete} />

          {/* Pause overlay */}
          {gameState === 'paused' && (
            <div className="overlay-backdrop" style={{ position: 'absolute', borderRadius: 'var(--radius-md)' }}>
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '1rem' }}>{t('PAUSED')}</h2>
                <button className="btn-primary" onClick={() => engine.resume()}>
                  <Play size={18} /> {t('Resume')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Next Queue & Actions */}
        <div className="side-panel">
          <QueueDisplay
            queue={nextQueue}
            count={6}
            previewSize={isBossMode ? Math.max(26, Math.min(44, Math.round(cellSize * 1.5))) : 64}
          />
          <div className="panel-card" style={{ gap: '0.5rem' }}>
            <button
              className="btn-secondary"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.5rem' }}
              onClick={() => {
                if (gameState === 'playing') engine.pause();
                else if (gameState === 'paused') engine.resume();
              }}
            >
              {gameState === 'paused' ? <Play size={16} /> : <Pause size={16} />}
              <span>{gameState === 'paused' ? t('Resume') : t('Pause')}</span>
            </button>
            <button
              className="btn-secondary"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.5rem' }}
              onClick={() => initGame()}
            >
              <RotateCcw size={16} />
              <span>{t('Restart')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Results / Game Over Modal */}
      <GameOverModal
        isOpen={isGameOverModalOpen}
        isVictory={isVictory}
        mode={mode}
        stats={currentStats}
        isSaved={isSaved}
        hideSaveNote={mode === 'boss' && isVictory && bossLevel < MAX_BOSS_LEVEL}
        restartLabel={mode === 'boss' && isVictory && bossLevel < MAX_BOSS_LEVEL ? t('Next Boss') : undefined}
        onRestart={handleModalRestart}
        onExit={exitToMenu}
      />
    </div>
  );
};
