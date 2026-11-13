import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Loader2, Skull, Users, X } from 'lucide-react';
import { GameEngine } from '../game/engine/gameEngine';
import { KeyboardManager } from '../game/input/keyboardManager';
import { GamepadManager, DEFAULT_GAMEPAD_BINDINGS } from '../game/input/gamepadManager';
import { soundManager } from '../game/audio/soundManager';
import { BossHUD, type BossEffectBadge } from '../components/game/BossHUD';
import { BossDamageTrail, type BossDamageSpark } from '../components/game/BossDamageTrail';
import { GameOverModal } from '../components/game/GameOverModal';
import { VersusArena } from '../components/game/VersusArena';
import { UserName } from '../components/user/UserName';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useDynamicCellSize } from '../hooks/useDynamicCellSize';
import { useDevBossKill } from '../hooks/useDevBossKill';
import { useGamepadActive, useGamepadBack } from '../context/GamepadNavContext';
import { useI18n } from '../i18n/useI18n';
import { ApiClient } from '../services/api';
import {
  FirebaseRealtimeService,
  type CoopAttackState,
  type CoopBossState,
  type CoopVotes,
  type PlayerCosmetics,
  type RemotePlayerState
} from '../services/firebaseRealtime';
import { BOSS_LEVELS, clampBossLevel, getBossSpeedLevel } from '../game/bossLevels';
import { BOARD_BUFFER_HEIGHT, BOARD_VISIBLE_HEIGHT } from '../game/engine/constants';
import type { TetrominoType } from '../game/engine/constants';
import {
  BOSS_ATTACKS,
  BOSS_ATTACK_DURATION_MS,
  BOSS_ATTACK_META,
  getCoopBossMaxHp,
  isBossAttack,
  type BossAttack
} from '../game/bossAttacks';

export type CoopBossIntent = 'quick' | 'create' | 'join';

export interface CoopBossEntry {
  intent: CoopBossIntent;
  roomCode?: string;
}

interface CoopBossPageProps {
  initialEntry?: CoopBossEntry | null;
  onExit: () => void;
}

type CoopPhase = 'lobby' | 'waiting' | 'quick_searching' | 'selecting' | 'in_game' | 'finished';

interface BossBanner {
  id: number;
  label: string;
  color: string;
  background: string;
}

const generateRoomCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const COMPACT_ARENA_BREAKPOINT = 900;

function useCompactCoopArena(): boolean {
  const [isCompact, setIsCompact] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.innerWidth <= COMPACT_ARENA_BREAKPOINT
  );

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${COMPACT_ARENA_BREAKPOINT}px)`);
    const update = () => setIsCompact(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return isCompact;
}

export const CoopBossPage: React.FC<CoopBossPageProps> = ({ initialEntry, onExit }) => {
  const { user, isAuthenticated } = useAuth();
  const { settings } = useSettings();
  const { t } = useI18n();
  const arenaRef = useRef<HTMLDivElement>(null);
  const isCompactArena = useCompactCoopArena();
  // The co-op badge is wider than the duel "VS" badge; keep enough room for
  // both side rails so the arena never overflows at 1440p.
  const cellSize = useDynamicCellSize(true, arenaRef, 0, isCompactArena ? 120 : 620);

  const [phase, setPhase] = useState<CoopPhase>('lobby');
  const [matchId, setMatchId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string>('');
  const [lobbyCode, setLobbyCode] = useState<string>(initialEntry?.roomCode || '');
  const [isHost, setIsHost] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [quickSearchSeconds, setQuickSearchSeconds] = useState<number>(0);
  const [seed, setSeed] = useState<number | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [opponentName, setOpponentName] = useState<string>(() => t('Teammate'));
  const [opponentCosmetics, setOpponentCosmetics] = useState<PlayerCosmetics | null>(null);
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);

  const [bossLevel, setBossLevel] = useState<number>(1);
  const [bossHp, setBossHp] = useState<number>(1);
  const [bossMaxHp, setBossMaxHp] = useState<number>(1);
  const [coopAttack, setCoopAttack] = useState<CoopAttackState | null>(null);
  const [activeEffects, setActiveEffects] = useState<BossAttack[]>([]);
  const [bossBanner, setBossBanner] = useState<BossBanner | null>(null);
  const [bossImpactKey, setBossImpactKey] = useState<number>(0);
  const [bossDamageSparks, setBossDamageSparks] = useState<BossDamageSpark[]>([]);
  const [clock, setClock] = useState<number>(Date.now());

  const [playerEngine, setPlayerEngine] = useState<GameEngine>(() => new GameEngine());
  const [opponentEngine, setOpponentEngine] = useState<GameEngine>(() => new GameEngine());
  const [playerHold, setPlayerHold] = useState<ReturnType<GameEngine['randomizer']['next']> | null>(null);
  const [playerQueue, setPlayerQueue] = useState<ReturnType<GameEngine['randomizer']['peek']>>([]);
  const [opponentHold, setOpponentHold] = useState<ReturnType<GameEngine['randomizer']['next']> | null>(null);
  const [opponentQueue, setOpponentQueue] = useState<ReturnType<GameEngine['randomizer']['peek']>>([]);
  const [isCountingDown, setIsCountingDown] = useState<boolean>(false);

  const [localEliminated, setLocalEliminated] = useState<boolean>(false);
  const [opponentEliminated, setOpponentEliminated] = useState<boolean>(false);
  const [opponentLeft, setOpponentLeft] = useState<boolean>(false);
  const [result, setResult] = useState<'victory' | 'defeat' | null>(null);
  const [isResultOpen, setIsResultOpen] = useState<boolean>(false);
  const [votes, setVotes] = useState<CoopVotes>({});

  const keyboardRef = useRef<KeyboardManager | null>(null);
  const gamepadRef = useRef<GamepadManager | null>(null);
  const cancelQuickSearchRef = useRef<(() => Promise<void>) | null>(null);
  const unsubscribeMatchRef = useRef<(() => void) | null>(null);
  const unsubscribeOpponentRef = useRef<(() => void) | null>(null);
  const unsubscribeLevelsRef = useRef<(() => void) | null>(null);
  const unsubscribeBossRef = useRef<(() => void) | null>(null);
  const unsubscribeAttackRef = useRef<(() => void) | null>(null);
  const unsubscribeVotesRef = useRef<(() => void) | null>(null);
  const bossBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bossBannerIdRef = useRef<number>(0);
  const bossDamageSparkIdRef = useRef<number>(0);
  const bossDamageCleanupTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const bossHudRef = useRef<HTMLDivElement>(null);
  const playerBoardRef = useRef<HTMLDivElement>(null);
  const autoStartedRef = useRef<boolean>(false);
  const exitedRef = useRef<boolean>(false);
  const matchIdRef = useRef<string | null>(null);
  const roomCodeRef = useRef<string>('');
  const isHostRef = useRef<boolean>(false);
  const phaseRef = useRef<CoopPhase>('lobby');
  const seedRef = useRef<number | null>(null);
  const playerEngineRef = useRef<GameEngine>(playerEngine);
  const opponentEngineRef = useRef<GameEngine>(opponentEngine);
  const localEliminatedRef = useRef<boolean>(false);
  const opponentEliminatedRef = useRef<boolean>(false);
  const resultShownRef = useRef<boolean>(false);
  const roundStartingRef = useRef<boolean>(false);
  const roundRestartRef = useRef<boolean>(false);
  const bossLevelRef = useRef<number>(1);
  const bossMaxHpRef = useRef<number>(1);
  const bossHpWasPositiveRef = useRef<boolean>(false);
  const bossSpeedLevelRef = useRef<number>(1);
  const coopAttackRef = useRef<CoopAttackState | null>(null);
  const lastAppliedAttackRef = useRef<number>(0);
  const activeEffectsRef = useRef<Map<BossAttack, number>>(new Map());
  const lastSyncTimeRef = useRef<number>(0);

  matchIdRef.current = matchId;
  roomCodeRef.current = roomCode;
  isHostRef.current = isHost;
  phaseRef.current = phase;
  seedRef.current = seed;
  playerEngineRef.current = playerEngine;
  opponentEngineRef.current = opponentEngine;

  const isPlaying = phase === 'in_game'
    && !isResultOpen
    && !localEliminated
    && (playerEngine.state === 'playing' || isCountingDown);
  useGamepadActive(isPlaying);

  useDevBossKill(phase === 'in_game' && !isResultOpen, () => {
    const activeMatchId = matchIdRef.current;
    bossHpWasPositiveRef.current = true;
    setBossHp(0);
    setBossImpactKey((key) => key + 1);
    if (activeMatchId) {
      void FirebaseRealtimeService.defeatCoopBoss(activeMatchId);
    }
  });

  useGamepadBack(() => {
    if (isResultOpen || phase === 'waiting' || phase === 'quick_searching' || phase === 'selecting' || phase === 'in_game') {
      handleExit();
      return true;
    }
    return false;
  }, [isResultOpen, phase]);

  function cleanupSubscriptions() {
    if (cancelQuickSearchRef.current) {
      cancelQuickSearchRef.current = null;
    }
    unsubscribeMatchRef.current?.();
    unsubscribeMatchRef.current = null;
    unsubscribeOpponentRef.current?.();
    unsubscribeOpponentRef.current = null;
    unsubscribeLevelsRef.current?.();
    unsubscribeLevelsRef.current = null;
    unsubscribeBossRef.current?.();
    unsubscribeBossRef.current = null;
    unsubscribeAttackRef.current?.();
    unsubscribeAttackRef.current = null;
    unsubscribeVotesRef.current?.();
    unsubscribeVotesRef.current = null;
  }

  function handleExit() {
    if (exitedRef.current) return;
    exitedRef.current = true;
    const activeMatchId = matchIdRef.current;
    const activeRoomCode = roomCodeRef.current;

    if (cancelQuickSearchRef.current) {
      void cancelQuickSearchRef.current().catch(() => {});
      cancelQuickSearchRef.current = null;
    }
    if (activeMatchId && phaseRef.current === 'waiting') {
      void ApiClient.cancelOnlineMatch(activeMatchId).catch(() => {});
    }
    if (activeMatchId && activeRoomCode) {
      void FirebaseRealtimeService.leaveRoom(activeRoomCode, activeMatchId, isHostRef.current);
    }

    cleanupSubscriptions();
    keyboardRef.current?.detach();
    keyboardRef.current = null;
    gamepadRef.current = null;
    soundManager.stopBgm();
    onExit();
  }

  function showBossBanner(label: string, color: string, background: string) {
    if (bossBannerTimerRef.current) clearTimeout(bossBannerTimerRef.current);
    bossBannerIdRef.current += 1;
    setBossBanner({ id: bossBannerIdRef.current, label, color, background });
    bossBannerTimerRef.current = setTimeout(() => {
      setBossBanner(null);
      bossBannerTimerRef.current = null;
    }, 2200);
  }

  function clearBossDamageSparks() {
    bossDamageCleanupTimersRef.current.forEach((timer) => clearTimeout(timer));
    bossDamageCleanupTimersRef.current = [];
    setBossDamageSparks([]);
  }

  function triggerBossLineImpact(rows: number[], linesCleared: number) {
    const canvas = playerBoardRef.current?.querySelector<HTMLCanvasElement>('canvas');
    const hpBar = bossHudRef.current?.querySelector<HTMLElement>('[data-boss-hp-bar]');
    if (!canvas || !hpBar) return;

    const boardRect = canvas.getBoundingClientRect();
    const barRect = hpBar.getBoundingClientRect();
    if (boardRect.height <= 0 || barRect.width <= 0) return;

    const targetX = barRect.left + barRect.width / 2;
    const targetY = barRect.top + barRect.height / 2;
    const isTetris = linesCleared === 4;
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
          id: `coop-boss-spark-${createdAt}-${row}-${index}-${bossDamageSparkIdRef.current++}`,
          startX: boardRect.left + boardRect.width * (0.08 + lane * 0.84),
          startY,
          endX: targetX + (lane - 0.5) * Math.min(72, barRect.width * 0.2),
          endY: targetY,
          delay: rowIndex * 32 + index * 22,
          duration: 620 + (index % 3) * 70,
          size: 4 + (index % 3) * 2,
          color: '#ffffff'
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
  }

  function syncPlayerState(engine: GameEngine, force: boolean = false) {
    const activeMatchId = matchIdRef.current;
    if (!activeMatchId) return;
    const now = performance.now();
    if (!force && now - lastSyncTimeRef.current < 50) return;
    lastSyncTimeRef.current = now;
    void FirebaseRealtimeService.updateState(activeMatchId, {
      score: engine.score,
      lines: engine.lines,
      alive: engine.state !== 'gameover',
      board: JSON.stringify(engine.board),
      activePiece: engine.activePiece ? {
        type: engine.activePiece,
        x: engine.activeX,
        y: engine.activeY,
        rotation: engine.activeRotation
      } : null,
      holdPiece: engine.holdPiece,
      queue: [...engine.randomizer.peek(6)],
      clearingRows: [...engine.clearingRows],
      combo: engine.comboCount,
      b2b: engine.b2bActive,
      b2bChain: engine.b2bChain
    });
  }

  function finishRound(nextResult: 'victory' | 'defeat') {
    if (resultShownRef.current) return;
    resultShownRef.current = true;
    roundRestartRef.current = false;
    setResult(nextResult);
    setPhase('finished');
    setIsResultOpen(true);
    keyboardRef.current?.detach();
    keyboardRef.current = null;
    gamepadRef.current = null;
    soundManager.stopBgm();
    if (nextResult === 'victory') soundManager.playClear(4);
    else soundManager.playGameOver();
  }

  function handleLocalGameOver() {
    if (localEliminatedRef.current) return;
    localEliminatedRef.current = true;
    setLocalEliminated(true);
    keyboardRef.current?.detach();
    keyboardRef.current = null;
    gamepadRef.current = null;
    if (matchIdRef.current) {
      void FirebaseRealtimeService.updateState(matchIdRef.current, { alive: false });
    }
    if (opponentEliminatedRef.current) {
      finishRound('defeat');
    }
  }

  function applyBossAttack(attack: BossAttack, speedLevel: number) {
    const engine = playerEngineRef.current;
    if (!engine || localEliminatedRef.current) return;
    const now = Date.now();
    if (attack === 'rotation') engine.rotationLocked = true;
    if (attack === 'invert') engine.horizontalInverted = true;
    if (attack === 'garbage') engine.garbageManager.enqueueGarbage(4);
    if (attack === 'speed') engine.setGravityLevel(speedLevel + 2);
    if (BOSS_ATTACK_META[attack].timed) {
      activeEffectsRef.current.set(attack, now + BOSS_ATTACK_DURATION_MS);
      setActiveEffects(Array.from(activeEffectsRef.current.keys()));
    }
  }

  function applyCoopAttackState(nextAttack: CoopAttackState | null) {
    coopAttackRef.current = nextAttack;
    setCoopAttack(nextAttack);
    if (!nextAttack) return;

    if (phaseRef.current === 'in_game' && nextAttack.resolvedAt > lastAppliedAttackRef.current && isBossAttack(nextAttack.resolvedAttack)) {
      lastAppliedAttackRef.current = nextAttack.resolvedAt;
      const attack = nextAttack.resolvedAttack;
      const count = Math.max(0, Math.floor(nextAttack.count || 0));
      const nextSpeedLevel = getBossSpeedLevel(bossLevelRef.current, count);
      bossSpeedLevelRef.current = nextSpeedLevel;

      if (nextAttack.cancelled) {
        soundManager.playBossCounter();
        showBossBanner(
          t('Attack countered!'),
          'var(--accent-green)',
          'rgba(34, 197, 94, 0.2)'
        );
      } else {
        soundManager.playBossAttack(attack);
        applyBossAttack(attack, nextSpeedLevel);
        const meta = BOSS_ATTACK_META[attack];
        showBossBanner(t(meta.label), meta.color, meta.background);
      }
    }
  }

  async function startRound(nextLevel: number, roundSeed: number, activeMatchId: string) {
    const level = clampBossLevel(nextLevel);
    const maxHp = getCoopBossMaxHp(level);
    resultShownRef.current = false;
    localEliminatedRef.current = false;
    opponentEliminatedRef.current = false;
    setLocalEliminated(false);
    setOpponentEliminated(false);
    setOpponentLeft(false);
    setResult(null);
    setIsResultOpen(false);
    setVotes({});
    setActiveEffects([]);
    activeEffectsRef.current.clear();
    setBossBanner(null);
    setBossImpactKey(0);
    clearBossDamageSparks();
    setBossLevel(level);
    bossLevelRef.current = level;
    setBossMaxHp(maxHp);
    bossMaxHpRef.current = maxHp;
    setBossHp(maxHp);
    bossHpWasPositiveRef.current = false;
    bossSpeedLevelRef.current = level;
    lastAppliedAttackRef.current = 0;
    coopAttackRef.current = null;
    setCoopAttack(null);

    if (isHostRef.current) {
      await FirebaseRealtimeService.initializeCoopRound(activeMatchId, level, maxHp);
    }

    const pEngine = new GameEngine({
      seed: roundSeed,
      das: settings.das,
      arr: settings.arr,
      softDropFactor: settings.softDropFactor,
      lockDelay: settings.lockDelay,
      startingLevel: level,
      fixedGravity: true,
      lineLevelProgression: false
    }, {
      onPieceSpawn: () => {
        setPlayerQueue([...pEngine.randomizer.peek(6)]);
        setPlayerHold(pEngine.holdPiece);
      },
      onPieceMove: () => {
        soundManager.playMove();
        syncPlayerState(pEngine);
      },
      onPieceRotate: () => {
        soundManager.playRotate();
        syncPlayerState(pEngine);
      },
      onPieceLock: () => {
        soundManager.playLock();
        syncPlayerState(pEngine, true);
      },
      onLineClear: (res) => {
        soundManager.playClear(res.linesCleared);
        if (res.tSpin !== 'none') soundManager.playTSpin();
        if (res.comboCount > 0) soundManager.playCombo(res.comboCount);
        setBossImpactKey((key) => key + 1);
        soundManager.playBossDamage(res.linesCleared);
        syncPlayerState(pEngine, true);
      },
      onLineClearFinish: () => syncPlayerState(pEngine, true),
      onPieceLocked: (info) => {
        if (info.linesCleared > 0) {
          triggerBossLineImpact(info.clearedRows, info.linesCleared);
        }
        if (info.scoreGained > 0) {
          void FirebaseRealtimeService.damageCoopBoss(activeMatchId, info.scoreGained);
        }
        if (coopAttackRef.current?.pick) {
          void FirebaseRealtimeService.resolveCoopAttack(activeMatchId, info.tetris).catch(() => {});
        }
      },
      onGameOver: () => handleLocalGameOver()
    });

    const oEngine = new GameEngine({ lockDelay: 500 });
    oEngine.state = 'playing';
    playerEngineRef.current = pEngine;
    opponentEngineRef.current = oEngine;
    setPlayerEngine(pEngine);
    setOpponentEngine(oEngine);
    setPlayerHold(null);
    setOpponentHold(null);
    setPlayerQueue([...pEngine.randomizer.peek(6)]);
    setOpponentQueue([]);
    setIsCountingDown(true);
    setPhase('in_game');

    void FirebaseRealtimeService.updateState(activeMatchId, {
      score: 0,
      lines: 0,
      alive: true,
      connected: true,
      board: JSON.stringify(pEngine.board),
      activePiece: null,
      holdPiece: null,
      queue: [...pEngine.randomizer.peek(6)],
      clearingRows: [],
      combo: -1,
      b2b: false,
      b2bChain: 0
    });

    if (keyboardRef.current) keyboardRef.current.detach();
    const km = new KeyboardManager(pEngine, settings.keybindings);
    km.attach();
    keyboardRef.current = km;
    gamepadRef.current = new GamepadManager(
      pEngine,
      settings.gamepadBindings || DEFAULT_GAMEPAD_BINDINGS
    );
    pEngine.activePiece = null;
  }

  function attachMatch(nextMatchId: string, nextSeed: number, host: boolean, nextRoomCode: string) {
    cleanupSubscriptions();
    setMatchId(nextMatchId);
    matchIdRef.current = nextMatchId;
    setSeed(nextSeed);
    seedRef.current = nextSeed;
    setIsHost(host);
    isHostRef.current = host;
    setRoomCode(nextRoomCode);
    roomCodeRef.current = nextRoomCode;
    setPhase('selecting');
    phaseRef.current = 'selecting';
    setSelectedLevel(null);
    setLevels({});
    setResult(null);
    setIsResultOpen(false);
    setOpponentEliminated(false);
    setLocalEliminated(false);
    setOpponentLeft(false);
    localEliminatedRef.current = false;
    opponentEliminatedRef.current = false;
    resultShownRef.current = false;
    roundStartingRef.current = false;
    roundRestartRef.current = false;
    activeEffectsRef.current.clear();
    setActiveEffects([]);
    clearBossDamageSparks();
    setOpponentName(t('Teammate'));
    setOpponentCosmetics(null);

    void FirebaseRealtimeService.authenticate(user?.display_name || t('Player 1'));
    void FirebaseRealtimeService.updateState(nextMatchId, {
      connected: true,
      alive: true,
      score: 0,
      lines: 0
    });

    unsubscribeLevelsRef.current = FirebaseRealtimeService.listenToCoopLevels(nextMatchId, (nextLevels) => {
      setLevels(nextLevels || {});
    });

    unsubscribeBossRef.current = FirebaseRealtimeService.listenToCoopBoss(nextMatchId, (boss: CoopBossState | null) => {
      if (!boss) return;
      setBossLevel(boss.level);
      bossLevelRef.current = boss.level;
      setBossMaxHp(boss.maxHp);
      bossMaxHpRef.current = boss.maxHp;
      // Ignore a stale zero from the previous round until the new round's
      // full health bar has actually been observed.
      if (boss.hp > 0) bossHpWasPositiveRef.current = true;
      setBossHp(boss.hp);
    });

    unsubscribeAttackRef.current = FirebaseRealtimeService.listenToCoopAttack(nextMatchId, (attackState) => {
      applyCoopAttackState(attackState);
    });

    unsubscribeVotesRef.current = FirebaseRealtimeService.listenToCoopVotes(nextMatchId, (nextVotes) => {
      setVotes(nextVotes || {});
    });

    unsubscribeOpponentRef.current = FirebaseRealtimeService.listenToOpponent(nextMatchId, (opponentState: RemotePlayerState) => {
      if (opponentState.displayName) setOpponentName(opponentState.displayName);
      if (opponentState.cosmetics) setOpponentCosmetics(opponentState.cosmetics);

      if (opponentState.connected === false) {
        opponentEliminatedRef.current = true;
        setOpponentEliminated(true);
        setOpponentLeft(true);
        if (localEliminatedRef.current) finishRound('defeat');
        return;
      }

      if (opponentState.alive === false) {
        opponentEliminatedRef.current = true;
        setOpponentEliminated(true);
        if (localEliminatedRef.current) finishRound('defeat');
      } else if (opponentState.alive === true) {
        opponentEliminatedRef.current = false;
        setOpponentEliminated(false);
      }

      const remoteEngine = opponentEngineRef.current;
      if (opponentState.board) {
        try {
          const parsedBoard = JSON.parse(opponentState.board);
          if (Array.isArray(parsedBoard) && parsedBoard.length > 0) remoteEngine.board = parsedBoard;
        } catch {}
      }
      if (opponentState.activePiece !== undefined) {
        if (opponentState.activePiece) {
          remoteEngine.activePiece = opponentState.activePiece.type as any;
          remoteEngine.activeX = opponentState.activePiece.x;
          remoteEngine.activeY = opponentState.activePiece.y;
          remoteEngine.activeRotation = opponentState.activePiece.rotation as any;
          remoteEngine.state = 'playing';
        } else {
          remoteEngine.activePiece = null;
        }
      }
      if (opponentState.score !== undefined) remoteEngine.score = opponentState.score;
      if (opponentState.lines !== undefined) remoteEngine.lines = opponentState.lines;
      if (opponentState.holdPiece !== undefined) setOpponentHold((opponentState.holdPiece as TetrominoType | null) ?? null);
      if (opponentState.queue) setOpponentQueue(opponentState.queue as TetrominoType[]);
      if (opponentState.clearingRows !== undefined) {
        remoteEngine.clearingRows = opponentState.clearingRows || [];
        remoteEngine.lineClearTimer = opponentState.clearingRows?.length ? 240 : 0;
      }
      if (opponentState.combo !== undefined) remoteEngine.comboCount = opponentState.combo;
      if (opponentState.b2b !== undefined) remoteEngine.b2bActive = opponentState.b2b;
      if (opponentState.b2bChain !== undefined) remoteEngine.b2bChain = opponentState.b2bChain;
    });
  }

  async function handleQuickSearch() {
    setErrorMsg(null);
    setPhase('quick_searching');
    soundManager.playRotate();
    try {
      await FirebaseRealtimeService.authenticate(user?.display_name || t('Player 1'));
      const cancel = await FirebaseRealtimeService.startQuickMatch(
        user?.display_name || t('Player 1'),
        (role, nextSeed, nextMatchId, nextRoomCode) => {
          cancelQuickSearchRef.current = null;
          attachMatch(nextMatchId, nextSeed, role === 'host', nextRoomCode);
        },
        user?.rating ?? 1000,
        user?.id,
        false,
        user?.cosmetics,
        'coop_boss'
      );
      // The match can be found before startQuickMatch returns; never keep a
      // stale cancel callback that would forfeit a match already in progress.
      if (phaseRef.current === 'quick_searching') cancelQuickSearchRef.current = cancel;
    } catch (e: any) {
      console.warn('Co-op quick search failed:', e);
      setErrorMsg(e.message || t('Quick search failed to connect.'));
      setPhase('lobby');
    }
  }

  async function handleCreateRoom() {
    setErrorMsg(null);
    const code = generateRoomCode();
    setRoomCode(code);
    roomCodeRef.current = code;
    setIsHost(true);
    isHostRef.current = true;
    setPhase('waiting');
    phaseRef.current = 'waiting';

    try {
      await FirebaseRealtimeService.authenticate(user?.display_name || t('Player 1'));
      const { matchId: nextMatchId, seed: nextSeed } = await FirebaseRealtimeService.createRoom(
        code,
        user?.display_name || t('Player 1'),
        user?.rating ?? 1000,
        user?.id,
        false,
        user?.cosmetics,
        'coop_boss'
      );
      setMatchId(nextMatchId);
      matchIdRef.current = nextMatchId;
      setSeed(nextSeed);
      seedRef.current = nextSeed;

      unsubscribeMatchRef.current = FirebaseRealtimeService.listenToMatchStart(nextMatchId, (matchData) => {
        const myUid = FirebaseRealtimeService.getUid();
        if (matchData.players) {
          for (const [uid, player] of Object.entries<any>(matchData.players)) {
            if (uid !== myUid) {
              setOpponentName(player.displayName || t('Teammate'));
              setOpponentCosmetics(player.cosmetics || null);
              break;
            }
          }
        }
        unsubscribeMatchRef.current?.();
        unsubscribeMatchRef.current = null;
        attachMatch(nextMatchId, nextSeed, true, code);
      });
    } catch (e: any) {
      console.warn('Co-op room creation failed:', e);
      setErrorMsg(e.message || t('Failed to create room on Firebase'));
      setPhase('lobby');
    }
  }

  async function handleJoinRoom(codeOverride?: string) {
    const code = (codeOverride ?? lobbyCode).trim().toUpperCase();
    if (!code) return;
    setErrorMsg(null);
    setRoomCode(code);
    roomCodeRef.current = code;
    setIsHost(false);
    isHostRef.current = false;
    setPhase('waiting');
    phaseRef.current = 'waiting';
    try {
      await FirebaseRealtimeService.authenticate(user?.display_name || t('Player 2'));
      const { matchId: nextMatchId, seed: nextSeed } = await FirebaseRealtimeService.joinRoom(
        code,
        user?.display_name || t('Player 2'),
        user?.rating ?? 1000,
        user?.id,
        false,
        user?.cosmetics,
        'coop_boss'
      );
      attachMatch(nextMatchId, nextSeed, false, code);
    } catch (e: any) {
      console.warn('Co-op join failed:', e);
      setErrorMsg(e.message || t('Failed to join room. Verify the code.'));
      setPhase('lobby');
    }
  }

  async function handleCancelQuickSearch() {
    if (cancelQuickSearchRef.current) {
      await cancelQuickSearchRef.current().catch(() => {});
      cancelQuickSearchRef.current = null;
    }
    cleanupSubscriptions();
    setPhase('lobby');
  }

  function chooseLevel(level: number) {
    if (!matchIdRef.current) return;
    setSelectedLevel(level);
    soundManager.playMove();
    void FirebaseRealtimeService.setCoopLevel(matchIdRef.current, level);
  }

  function handleResultAction() {
    if (!matchIdRef.current || opponentLeft) return;
    const myUid = FirebaseRealtimeService.getUid();
    if (result === 'defeat') {
      setVotes((current) => ({ ...current, retry: { ...(current.retry || {}), [myUid]: true } }));
      void FirebaseRealtimeService.requestCoopVote(matchIdRef.current, 'retry');
    } else if (result === 'victory' && bossLevelRef.current < 10) {
      setVotes((current) => ({ ...current, next: { ...(current.next || {}), [myUid]: true } }));
      void FirebaseRealtimeService.requestCoopVote(matchIdRef.current, 'next');
    }
  }

  function handleCountdownComplete() {
    setIsCountingDown(false);
    const engine = playerEngineRef.current;
    engine.state = 'playing';
    engine.startTime = Date.now();
    engine.spawnPiece();
    setPlayerQueue([...engine.randomizer.peek(6)]);
    syncPlayerState(engine, true);
    soundManager.startBgm();
  }

  useEffect(() => {
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    if (!initialEntry) return;
    if (initialEntry.intent === 'quick') void handleQuickSearch();
    else if (initialEntry.intent === 'create') void handleCreateRoom();
    else if (initialEntry.intent === 'join' && initialEntry.roomCode) {
      setLobbyCode(initialEntry.roomCode);
      void handleJoinRoom(initialEntry.roomCode);
    }
  // Auto-launch only once for the entry chosen from the multiplayer menu.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (bossBannerTimerRef.current) clearTimeout(bossBannerTimerRef.current);
      bossDamageCleanupTimersRef.current.forEach((timer) => clearTimeout(timer));
      bossDamageCleanupTimersRef.current = [];
      if (!exitedRef.current) {
        const cancelSearch = cancelQuickSearchRef.current;
        if (cancelSearch && phaseRef.current === 'quick_searching') {
          void cancelSearch().catch(() => {});
          cancelQuickSearchRef.current = null;
        }
        if (matchIdRef.current && roomCodeRef.current) {
          void FirebaseRealtimeService.leaveRoom(
            roomCodeRef.current,
            matchIdRef.current,
            isHostRef.current
          );
        }
      }
      cleanupSubscriptions();
      keyboardRef.current?.detach();
      soundManager.stopBgm();
    };
  // Cleanup only when the page unmounts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== 'quick_searching') {
      setQuickSearchSeconds(0);
      return;
    }
    const timer = setInterval(() => setQuickSearchSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'selecting' || !matchId || !seed || roundStartingRef.current) return;
    const values = Object.values(levels).filter((value) => Number.isFinite(value));
    if (values.length < 2) return;
    roundStartingRef.current = true;
    const average = Math.floor((values[0] + values[1]) / 2);
    void startRound(average, seed, matchId);
  // The second level arriving is the trigger for both players to start.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, levels, matchId, seed]);

  useEffect(() => {
    if (phase !== 'finished' || !matchId || !seed || roundRestartRef.current) return;
    const myUid = FirebaseRealtimeService.getUid();
    const otherUids = (groups?: Record<string, boolean>) =>
      Object.keys(groups || {}).filter((uid) => uid !== myUid && groups?.[uid]);
    const bothRetry = Boolean(votes.retry?.[myUid]) && otherUids(votes.retry).length > 0;
    const bothNext = Boolean(votes.next?.[myUid]) && otherUids(votes.next).length > 0;
    if (!bothRetry && !bothNext) return;
    if (bothNext && bossLevelRef.current >= 10) return;
    roundRestartRef.current = true;
    const nextLevel = bothNext ? bossLevelRef.current + 1 : bossLevelRef.current;
    void startRound(nextLevel, seed, matchId);
  // Votes are the mutual agreement signal for retry/next level.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, votes, matchId, seed]);

  useEffect(() => {
    if (phase !== 'in_game') return;
    const timer = setInterval(() => {
      const now = Date.now();
      setClock(now);
      let changed = false;
      activeEffectsRef.current.forEach((endsAt, attack) => {
        if (now < endsAt) return;
        const engine = playerEngineRef.current;
        if (attack === 'rotation') engine.rotationLocked = false;
        if (attack === 'invert') engine.horizontalInverted = false;
        if (attack === 'speed') engine.setGravityLevel(bossSpeedLevelRef.current);
        activeEffectsRef.current.delete(attack);
        changed = true;
      });
      if (changed) setActiveEffects(Array.from(activeEffectsRef.current.keys()));
    }, 250);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'in_game') return;
    const timer = setInterval(() => {
      if (localEliminatedRef.current) return;
      if (playerEngineRef.current.state !== 'playing') return;
      const current = coopAttackRef.current;
      if (!current || current.pick || Date.now() < current.dueAt) return;
      const attack = BOSS_ATTACKS[Math.floor(Math.random() * BOSS_ATTACKS.length)];
      if (matchIdRef.current) {
        void FirebaseRealtimeService.createCoopPendingAttack(matchIdRef.current, attack);
      }
    }, 500);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase === 'in_game' && bossHp <= 0 && bossHpWasPositiveRef.current) {
      finishRound('victory');
    }
  // A shared boss reaching zero is a victory for both players.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bossHp, phase]);

  useEffect(() => {
    let animId = 0;
    let lastTime = performance.now();
    const loop = (time: number) => {
      const delta = time - lastTime;
      lastTime = time;
      if (phase === 'in_game' && !isCountingDown) {
        const engine = playerEngineRef.current;
        if (!localEliminatedRef.current && engine.state === 'playing') {
          engine.update(delta);
          keyboardRef.current?.update(delta);
          gamepadRef.current?.update(delta);
          setPlayerHold(engine.holdPiece);
          setPlayerQueue([...engine.randomizer.peek(6)]);
        }
        const remote = opponentEngineRef.current;
        if (remote.clearingRows.length > 0) {
          remote.lineClearTimer -= delta;
          if (remote.lineClearTimer <= 0) remote.finishLineClear();
        }
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [phase, isCountingDown]);

  if (!isAuthenticated) {
    return (
      <div style={{ width: '100%', maxWidth: '600px', textAlign: 'center', marginTop: '3rem' }}>
        <div className="panel-card" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem' }}>{t('Authentication Required')}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {t('Sign in to play online co-op boss battles.')}
          </p>
          <button className="btn-secondary" style={{ marginTop: '1rem' }} onClick={onExit}>
            {t('Back to Multiplayer')}
          </button>
        </div>
      </div>
    );
  }

  const myUid = FirebaseRealtimeService.getUid();
  const myLevel = levels[myUid] ?? selectedLevel;
  const opponentLevelEntry = Object.entries(levels).find(([uid]) => uid !== myUid);
  const opponentLevel = opponentLevelEntry?.[1] ?? null;
  const myRetry = Boolean(votes.retry?.[myUid]);
  const myNext = Boolean(votes.next?.[myUid]);
  const teammateRetry = Object.keys(votes.retry || {}).some((uid) => uid !== myUid && votes.retry?.[uid]);
  const teammateNext = Object.keys(votes.next || {}).some((uid) => uid !== myUid && votes.next?.[uid]);
  const maxLevelReached = bossLevel >= 10;
  const coopRestartDisabled = opponentLeft
    || (result === 'victory' && maxLevelReached)
    || (result === 'defeat' && myRetry)
    || (result === 'victory' && myNext);
  const coopRestartLabel = result === 'victory'
    ? maxLevelReached
      ? t('All Boss Levels Cleared')
      : myNext ? t('Waiting for teammate...') : t('Next Boss Level')
    : myRetry ? t('Waiting for teammate...') : t('Retry Boss');
  const coopStatus = opponentLeft
    ? t('Teammate left the room.')
    : myRetry || myNext
      ? t('Waiting for teammate to accept...')
      : teammateRetry || teammateNext
        ? t('Teammate is ready.')
        : null;
  const bossEffectBadges: BossEffectBadge[] = activeEffects.map((attack) => ({
    label: t(BOSS_ATTACK_META[attack].label),
    color: BOSS_ATTACK_META[attack].color,
    background: BOSS_ATTACK_META[attack].background
  }));
  const bossBoardEffect = activeEffects.find((attack) => BOSS_ATTACK_META[attack].timed);
  const bossBoardColor = bossBoardEffect ? BOSS_ATTACK_META[bossBoardEffect].color : null;
  const bossBlind = activeEffects.includes('blind');
  const bossGhostless = activeEffects.includes('ghostless');
  const pendingAttackName = isBossAttack(coopAttack?.pick)
    ? t(BOSS_ATTACK_META[coopAttack.pick].label)
    : null;
  const nextAttackMs = coopAttack?.dueAt
    ? Math.max(0, coopAttack.dueAt - clock)
    : 30_000;

  if (phase === 'lobby') {
    return (
      <div className="versus-page" style={{ maxWidth: '760px' }}>
        <div className="panel-card" style={{ padding: '2rem', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '0.5rem' }}>
            <Skull size={26} color="var(--accent-red)" />
            <h1 style={{ fontSize: '1.9rem', fontWeight: 800 }}>{t('Co-op Boss Battle')}</h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            {t('Team up with another player to defeat the boss.')}
          </p>
          {errorMsg && <div style={{ color: 'var(--accent-red)', marginBottom: '1rem' }}>{errorMsg}</div>}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={() => void handleQuickSearch()}>
              <Users size={18} /> {t('Team Quick Play')}
            </button>
            <button className="btn-secondary" onClick={() => void handleCreateRoom()}>
              {t('Host Co-op Room')}
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <input
              value={lobbyCode}
              onChange={(event) => setLobbyCode(event.target.value.toUpperCase())}
              placeholder={t('CODE')}
              maxLength={6}
              style={{ flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', textAlign: 'center', letterSpacing: '0.15em' }}
            />
            <button className="btn-secondary" onClick={() => void handleJoinRoom()}>
              {t('Join')}
            </button>
          </div>
          <button className="btn-secondary" style={{ marginTop: '1.25rem' }} onClick={handleExit}>
            {t('Back to Multiplayer')}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'quick_searching') {
    return (
      <div className="versus-page" style={{ maxWidth: '560px' }}>
        <div className="panel-card" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <Loader2 size={40} className="spin-icon" style={{ animation: 'spin 1.5s linear infinite', margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{t('Searching for Co-op Teammate...')}</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            {t('Looking for another player to fight the boss with.')}
          </p>
          <div style={{ fontFamily: 'monospace', marginTop: '1rem', color: 'var(--accent-cyan)' }}>
            {Math.floor(quickSearchSeconds / 60)}:{(quickSearchSeconds % 60 < 10 ? '0' : '') + (quickSearchSeconds % 60)}
          </div>
          <button className="btn-secondary" style={{ marginTop: '1.25rem' }} onClick={() => void handleCancelQuickSearch()}>
            <X size={18} /> {t('Cancel Search')}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'waiting') {
    return (
      <div className="versus-page" style={{ maxWidth: '560px' }}>
        <div className="panel-card" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <Users size={38} color="var(--accent-yellow)" style={{ margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{t('Waiting for teammate...')}</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            {t('Share this room code with your friend. The game will automatically start when they join!')}
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', marginTop: '1.25rem', padding: '0.75rem 1.25rem', border: '2px dashed var(--accent-cyan)', borderRadius: 'var(--radius-md)' }}>
            <strong style={{ fontSize: '1.8rem', letterSpacing: '0.2em', color: 'var(--accent-cyan)' }}>{roomCode}</strong>
            <button className="icon-btn" onClick={() => { navigator.clipboard.writeText(roomCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
              {copied ? <Check size={18} color="var(--accent-green)" /> : <Copy size={18} />}
            </button>
          </div>
          {errorMsg && <div style={{ color: 'var(--accent-red)', marginTop: '1rem' }}>{errorMsg}</div>}
          {opponentLeft && <div style={{ color: 'var(--accent-red)', marginTop: '1rem' }}>{t('Teammate left the room.')}</div>}
          <button className="btn-secondary" style={{ marginTop: '1.5rem' }} onClick={handleExit}>
            {t('Cancel & Back to Lobby')}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'selecting') {
    return (
      <div className="versus-page coop-game">
        <div className="panel-card coop-level-window">
          <div className="coop-level-head">
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: '1.35rem', fontWeight: 800 }}>{t('Choose your boss level')}</h1>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.2rem', fontSize: '0.78rem', lineHeight: 1.35 }}>
                {t('Both players choose a level between 1 and 10. The fight starts at the rounded-down average.')}
              </p>
            </div>
            <div className="coop-room-code">
              <span>{t('Room Code:')}</span>
              <strong>{roomCode}</strong>
            </div>
          </div>

          <div className="coop-level-summary">
            <div className="coop-level-choice">
              <span>{t('Your level')}</span>
              <strong style={{ color: 'var(--accent-cyan)' }}>{myLevel ?? '—'}</strong>
            </div>
            <div className="coop-level-choice">
              <span>{t('Teammate level')}</span>
              <strong style={{ color: 'var(--accent-orange)' }}>{opponentLevel ?? '—'}</strong>
            </div>
          </div>

          <div className="coop-level-grid" role="group" aria-label={t('Choose your boss level')}>
            {BOSS_LEVELS.map((definition) => {
              const selected = myLevel === definition.level;
              const hp = Math.ceil(definition.hp * 1.5);
              return (
                <button
                  key={definition.level}
                  type="button"
                  className={`coop-level-card${selected ? ' is-selected' : ''}`}
                  onClick={() => chooseLevel(definition.level)}
                  aria-pressed={selected}
                  aria-label={`${t('Level')} ${definition.level}: ${hp.toLocaleString()} HP, ${t('Speed')} ${definition.startingSpeedLevel}`}
                  title={`${t('Level')} ${definition.level} · ${hp.toLocaleString()} HP · ${t('Speed')} ${definition.startingSpeedLevel}`}
                  style={{
                    borderColor: selected ? definition.color : undefined,
                    boxShadow: selected ? `0 0 0 2px ${definition.color}` : undefined
                  }}
                >
                  <span className="coop-level-label">{t('Level')}</span>
                  <strong className="coop-level-number" style={{ color: definition.color }}>{definition.level}</strong>
                  <span className="coop-level-hp">{hp.toLocaleString()} HP</span>
                </button>
              );
            })}
          </div>

          <div className="coop-level-footer">
            <div>
              {myLevel && !opponentLevel && (
                <span style={{ color: 'var(--accent-yellow)', fontSize: '0.75rem' }}>{t('Waiting for teammate...')}</span>
              )}
              {opponentLeft && <span style={{ color: 'var(--accent-red)', fontSize: '0.75rem' }}>{t('Teammate left the room.')}</span>}
            </div>
            <button className="btn-secondary coop-level-back" onClick={handleExit}>
              {t('Back to Multiplayer')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="versus-page coop-game"
      style={{ '--coop-vs-offset': `${26 + cellSize * 10}px` } as React.CSSProperties}
    >
      <BossDamageTrail sparks={bossDamageSparks} />

      {errorMsg && (
        <div style={{ color: 'var(--accent-red)', marginBottom: '0.75rem' }}>{errorMsg}</div>
      )}

      <div className="versus-toolbar">
        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('Room Code:')} </span>
          <strong style={{ fontSize: '1.05rem', letterSpacing: '0.1em', color: 'var(--accent-cyan)' }}>{roomCode}</strong>
        </div>
        <div style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.18)', color: 'var(--accent-red)', fontWeight: 800, fontSize: '0.8rem' }}>
          {t('Co-op Boss Battle')}
        </div>
        <button className="btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }} onClick={handleExit}>
          {t('Leave Room')}
        </button>
      </div>

      <div ref={bossHudRef} style={{ width: '100%', maxWidth: '980px', marginBottom: '0.6rem' }}>
        <BossHUD
          hp={bossHp}
          maxHp={bossMaxHp}
          level={bossLevel}
          nextAttackMs={nextAttackMs}
          pendingAttackName={pendingAttackName}
          activeEffects={bossEffectBadges}
          impactKey={bossImpactKey}
        />
      </div>

      {localEliminated && phase === 'in_game' && (
        <div className="panel-card" style={{ width: '100%', maxWidth: '760px', padding: '0.65rem 1rem', marginBottom: '0.6rem', borderColor: 'rgba(239, 68, 68, 0.4)' }}>
          <strong style={{ color: 'var(--accent-red)' }}>{t('You are spectating')}</strong>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{t('Your teammate is still fighting.')}</span>
        </div>
      )}

      <VersusArena
        arenaRef={arenaRef}
        cellSize={cellSize}
        vsTone="green"
        vsLabel={t('CO-OP')}
        playerBoardRef={playerBoardRef}
        playerEffects={{
          color: bossBoardColor,
          blind: bossBlind,
          hideGhost: bossGhostless,
          banner: bossBanner
        }}
        opponentEffects={{
          color: bossBoardColor,
          blind: bossBlind,
          hideGhost: bossGhostless
        }}
        player={{
          label: (
            <>
              <UserName displayName={user?.display_name || t('Player 1')} cosmetics={user?.cosmetics} size={isCompactArena ? '0.78rem' : '0.95rem'} />
              {localEliminated && <span className="versus-elo-badge">{t('Spectating')}</span>}
            </>
          ),
          tone: 'cyan',
          hold: playerHold,
          canHold: playerEngine.canHold && !localEliminated,
          queue: playerQueue,
          score: playerEngine.score,
          lines: playerEngine.lines,
          combo: playerEngine.comboCount,
          b2b: playerEngine.b2bActive,
          b2bChain: playerEngine.b2bChain,
          engine: playerEngine,
          garbage: playerEngine.garbageManager.getPendingCount()
        }}
        opponent={{
          label: (
            <>
              <UserName displayName={opponentName} cosmetics={opponentCosmetics} size={isCompactArena ? '0.78rem' : '0.95rem'} />
              {opponentEliminated && <span className="versus-elo-badge">{t('Spectating')}</span>}
            </>
          ),
          tone: 'orange',
          hold: opponentHold,
          canHold: false,
          queue: opponentQueue,
          score: opponentEngine.score,
          lines: opponentEngine.lines,
          combo: opponentEngine.comboCount,
          b2b: opponentEngine.b2bActive,
          b2bChain: opponentEngine.b2bChain,
          engine: opponentEngine,
          garbage: 0
        }}
        isCountingDown={isCountingDown}
        onCountdownComplete={handleCountdownComplete}
      />

      <GameOverModal
        isOpen={isResultOpen}
        isVictory={result === 'victory'}
        customMessage={result === 'defeat'
          ? t('Both players are down.')
          : maxLevelReached ? t('All Boss Levels Cleared') : t('Boss defeated!')}
        mode="coop_boss"
        stats={playerEngine.getStats()}
        onRestart={handleResultAction}
        onExit={handleExit}
        restartLabel={coopRestartLabel}
        restartDisabled={coopRestartDisabled}
        statusMessage={coopStatus}
        hideSaveNote
      />
    </div>
  );
};