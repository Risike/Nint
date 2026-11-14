import React, { useEffect, useRef, useState } from 'react';
import { Bomb, Check, Copy, Loader2, LogIn, Plus, RotateCcw, Search, Users, X } from 'lucide-react';
import { GameEngine } from '../game/engine/gameEngine';
import { KeyboardManager } from '../game/input/keyboardManager';
import { GamepadManager, DEFAULT_GAMEPAD_BINDINGS } from '../game/input/gamepadManager';
import { soundManager } from '../game/audio/soundManager';
import { VersusArena } from '../components/game/VersusArena';
import { UserName } from '../components/user/UserName';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useDynamicCellSize } from '../hooks/useDynamicCellSize';
import { useGamepadActive, useGamepadBack } from '../context/GamepadNavContext';
import { useI18n } from '../i18n/useI18n';
import { ApiClient } from '../services/api';
import {
  FirebaseRealtimeService,
  type PlayerCosmetics,
  type RemotePlayerState
} from '../services/firebaseRealtime';
import { BOARD_TOTAL_HEIGHT, BOARD_WIDTH, type TetrominoType } from '../game/engine/constants';
import { useDevKill } from '../hooks/useDevBossKill';
import {
  blastDuelOutcome,
  createBlastDuelScore,
  createRoundPlan,
  roundStartDelayMs,
  shouldAdoptRoundPlan,
  opponentRoundEvent,
  withRoundLoss,
  withRoundWin,
  type BlastDuelScore,
  type BlastRoundPlan
} from '../game/blastDuel';

export type BlastBattleIntent = 'quick' | 'create' | 'join';

export interface BlastBattleEntry {
  intent: BlastBattleIntent;
  roomCode?: string;
}

interface BlastBattlePageProps {
  initialEntry?: BlastBattleEntry | null;
  onExit: () => void;
  onNavigate?: (tab: string) => void;
}

type BlastPhase = 'lobby' | 'waiting' | 'quick_searching' | 'in_game' | 'finished';

// Every ten destroyed blocks or bombs pushes one garbage row onto the other
// board. This is what turns a solo puzzle into a duel.
const BLOCKS_PER_GARBAGE = 10;
// The link mode lets both players pick a starting speed; a fixed moderate
// level keeps both boards identical without another lobby step.
const BLAST_VERSUS_LEVEL = 5;
const ROUND_RESTART_DELAY_MS = 2400;

interface RoundBanner {
  outcome: 'win' | 'loss';
  myWins: number;
  opponentWins: number;
}

const generateRoomCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const BlastBattlePage: React.FC<BlastBattlePageProps> = ({ initialEntry, onExit, onNavigate }) => {
  const { user, isAuthenticated } = useAuth();
  const { settings } = useSettings();
  const { t } = useI18n();
  const arenaRef = useRef<HTMLDivElement>(null);
  const cellSize = useDynamicCellSize(true, arenaRef);

  const [phase, setPhase] = useState<BlastPhase>('lobby');
  const [matchId, setMatchId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [lobbyCode, setLobbyCode] = useState(initialEntry?.roomCode || '');
  const [quickSearchSeconds, setQuickSearchSeconds] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [opponentName, setOpponentName] = useState(() => t('Opponent'));
  const [opponentCosmetics, setOpponentCosmetics] = useState<PlayerCosmetics | null>(null);

  const [playerEngine, setPlayerEngine] = useState<GameEngine>(() => new GameEngine());
  const [opponentEngine, setOpponentEngine] = useState<GameEngine>(() => new GameEngine());
  const [playerHold, setPlayerHold] = useState<TetrominoType | null>(null);
  const [playerQueue, setPlayerQueue] = useState<TetrominoType[]>([]);
  const [opponentHold, setOpponentHold] = useState<TetrominoType | null>(null);
  const [opponentQueue, setOpponentQueue] = useState<TetrominoType[]>([]);
  const [playerGarbage, setPlayerGarbage] = useState(0);
  const [opponentGarbage, setOpponentGarbage] = useState(0);
  const [isCountingDown, setIsCountingDown] = useState(false);

  const [roundNumber, setRoundNumber] = useState(1);
  const [myWins, setMyWins] = useState(0);
  const [opponentWins, setOpponentWins] = useState(0);
  const [roundBanner, setRoundBanner] = useState<RoundBanner | null>(null);
  const [matchResult, setMatchResult] = useState<'win' | 'loss' | null>(null);
  const [winReason, setWinReason] = useState<string | null>(null);
  const [rematchWaiting, setRematchWaiting] = useState(false);
  const [rematchDeclined, setRematchDeclined] = useState(false);

  const matchIdRef = useRef<string | null>(null);
  const roomCodeRef = useRef('');
  const isHostRef = useRef(false);
  const phaseRef = useRef<BlastPhase>('lobby');
  const seedRef = useRef<number>(1);
  const playerEngineRef = useRef<GameEngine>(playerEngine);
  const opponentEngineRef = useRef<GameEngine>(opponentEngine);
  const keyboardRef = useRef<KeyboardManager | null>(null);
  const gamepadRef = useRef<GamepadManager | null>(null);
  const cancelQuickSearchRef = useRef<(() => Promise<void>) | null>(null);
  const unsubscribeMatchRef = useRef<(() => void) | null>(null);
  const unsubscribeOpponentRef = useRef<(() => void) | null>(null);
  const unsubscribeAttacksRef = useRef<(() => void) | null>(null);
  const lastSyncTimeRef = useRef(0);
  const gameStartedRef = useRef(false);
  const roundOverRef = useRef(false);
  const scoreRef = useRef<BlastDuelScore>(createBlastDuelScore());
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundPlanRef = useRef<BlastRoundPlan | null>(null);
  const unsubscribeRematchRef = useRef<(() => void) | null>(null);
  const unsubscribeNextMatchRef = useRef<(() => void) | null>(null);
  const rematchCreatingRef = useRef(false);
  const destroyedBlocksRef = useRef(0);
  const garbageSentRef = useRef(0);
  const startRoundRef = useRef<(round: number) => void>(() => {});

  matchIdRef.current = matchId;
  roomCodeRef.current = roomCode;
  phaseRef.current = phase;
  playerEngineRef.current = playerEngine;
  opponentEngineRef.current = opponentEngine;

  const isPlaying = phase === 'in_game'
    && !roundBanner
    && (playerEngine.state === 'playing' || isCountingDown);
  useGamepadActive(isPlaying);

  useGamepadBack(() => {
    if (phase === 'lobby') return false;
    handleLeave();
    return true;
  }, [phase]);

  // Development-only shortcut: K empties the Blast board, which also takes the
  // round, so a duel can be stepped through without stacking pieces by hand.
  // Compiled out of production builds by the hook's import.meta.env.DEV guard.
  useDevKill(phase === 'in_game' && !roundBanner && !isCountingDown, () => {
    const engine = playerEngineRef.current;
    engine.board = Array.from({ length: BOARD_TOTAL_HEIGHT }, () =>
      new Array<string | null>(BOARD_WIDTH).fill(null)
    );
    syncPlayerState(engine, true);
    winRound();
  });

  useEffect(() => {
    if (phase !== 'quick_searching') {
      setQuickSearchSeconds(0);
      return;
    }
    const timer = setInterval(() => setQuickSearchSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    return () => {
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      keyboardRef.current?.detach();
      soundManager.stopBgm();
      cleanupSubscriptions();
      const activeMatchId = matchIdRef.current;
      const activeRoomCode = roomCodeRef.current;
      if (activeMatchId && activeRoomCode) {
        void FirebaseRealtimeService.leaveRoom(activeRoomCode, activeMatchId, isHostRef.current).catch(() => {});
      }
    };
  }, []);

  function cleanupSubscriptions() {
    unsubscribeMatchRef.current?.();
    unsubscribeMatchRef.current = null;
    unsubscribeOpponentRef.current?.();
    unsubscribeOpponentRef.current = null;
    unsubscribeAttacksRef.current?.();
    unsubscribeAttacksRef.current = null;
    unsubscribeRematchRef.current?.();
    unsubscribeRematchRef.current = null;
    unsubscribeNextMatchRef.current?.();
    unsubscribeNextMatchRef.current = null;
  }

  function applyScore(next: BlastDuelScore) {
    scoreRef.current = next;
    setMyWins(next.myWins);
    setOpponentWins(next.opponentWins);
    setRoundNumber(next.round);
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
      activeBombs: engine.activeBombLocal.map((point) => ({ x: point.x, y: point.y })),
      holdPiece: engine.holdPiece,
      queue: [...engine.randomizer.peek(6)],
      clearingRows: [...engine.clearingRows],
      combo: engine.comboCount,
      b2b: engine.b2bActive,
      b2bChain: engine.b2bChain,
      roundWins: scoreRef.current.myWins,
      round: scoreRef.current.round
    });
  }

  // Both boards must unfreeze at the same instant: the round winner publishes
  // one shared deadline and each client schedules its local timer from it.
  function armRoundStart(plan: BlastRoundPlan) {
    if (!shouldAdoptRoundPlan(plan, scoreRef.current.round, roundPlanRef.current)) return;
    roundPlanRef.current = plan;
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null;
      if (phaseRef.current !== 'in_game' || blastDuelOutcome(scoreRef.current)) return;
      startRoundRef.current(plan.round);
    }, roundStartDelayMs(plan, Date.now()));
  }

  function finishMatch(outcome: 'win' | 'loss', reason?: string) {
    if (phaseRef.current === 'finished') return;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    keyboardRef.current?.detach();
    keyboardRef.current = null;
    gamepadRef.current = null;
    soundManager.stopBgm();
    if (outcome === 'win') soundManager.playClear(4);
    else soundManager.playGameOver();
    setRoundBanner(null);
    setMatchResult(outcome);
    setWinReason(reason || null);
    setPhase('finished');
    phaseRef.current = 'finished';

    setRematchWaiting(false);
    setRematchDeclined(false);
    rematchCreatingRef.current = false;

    const finishedMatchId = matchIdRef.current;
    if (finishedMatchId) {
      unsubscribeRematchRef.current?.();
      unsubscribeNextMatchRef.current?.();

      // A rematch needs both players: each writes its own flag, and the host
      // creates the next Blast room once the two flags are present.
      unsubscribeRematchRef.current = FirebaseRealtimeService.listenToRematch(finishedMatchId, (decisions) => {
        const myUid = FirebaseRealtimeService.getUid();
        const mine = Boolean(decisions?.[myUid]);
        const theirs = Object.entries(decisions || {}).some(
          ([uid, ready]) => uid !== myUid && ready === true
        );
        setRematchWaiting(mine && !theirs);
        if (mine && theirs && !rematchCreatingRef.current && isHostRef.current) {
          rematchCreatingRef.current = true;
          void startRematch();
        }
      });

      unsubscribeNextMatchRef.current = FirebaseRealtimeService.listenToNextMatch(finishedMatchId, (data) => {
        attachMatch(data.nextMatchId, data.seed, isHostRef.current, data.roomCode || generateRoomCode());
      });
    }
  }

  function handleRematch() {
    const currentMatchId = matchIdRef.current;
    if (!currentMatchId || rematchWaiting || rematchDeclined) return;
    soundManager.playRotate();
    setRematchWaiting(true);
    void FirebaseRealtimeService.requestRematch(currentMatchId).catch(() => setRematchWaiting(false));
  }

  async function startRematch() {
    const currentMatchId = matchIdRef.current;
    if (!currentMatchId || !isHostRef.current) return;
    try {
      await FirebaseRealtimeService.createBlastRematch(
        currentMatchId,
        generateRoomCode(),
        user?.display_name || t('Player 1'),
        user?.rating ?? 1000,
        user?.id,
        user?.cosmetics
      );
    } catch (e: any) {
      rematchCreatingRef.current = false;
      setRematchWaiting(false);
      setErrorMsg(e?.message || t('Failed to create room on Firebase'));
    }
  }

  function winRound() {
    if (roundOverRef.current || phaseRef.current !== 'in_game') return;
    roundOverRef.current = true;
    playerEngineRef.current.pause();
    keyboardRef.current?.detach();
    keyboardRef.current = null;
    gamepadRef.current = null;

    const next = withRoundWin(scoreRef.current);
    const wonMatch = blastDuelOutcome(next) === 'win';
    applyScore(next);
    const plan = createRoundPlan(next.round + 1, Date.now(), ROUND_RESTART_DELAY_MS);
    void FirebaseRealtimeService.updateState(matchIdRef.current || '', {
      roundWins: next.myWins,
      round: next.round,
      roundOutcome: 'win',
      ...(wonMatch
        ? { matchWon: true }
        : { nextRound: plan.round, nextRoundAt: plan.startsAt })
    });
    soundManager.playClear(4);

    if (wonMatch) {
      finishMatch('win');
      return;
    }
    setRoundBanner({
      outcome: 'win',
      myWins: next.myWins,
      opponentWins: next.opponentWins
    });
    armRoundStart(plan);
  }

  function loseRound(outcome: 'cleared' | 'topout') {
    if (roundOverRef.current || phaseRef.current !== 'in_game') return;
    roundOverRef.current = true;
    playerEngineRef.current.pause();
    keyboardRef.current?.detach();
    keyboardRef.current = null;
    gamepadRef.current = null;
    soundManager.playGameOver();
    const next = withRoundLoss(scoreRef.current);
    applyScore(next);
    void FirebaseRealtimeService.updateState(matchIdRef.current || '', {
      roundWins: next.myWins,
      round: next.round,
      roundOutcome: 'loss',
      ...(outcome === 'topout' ? { alive: false } : {})
    });

    if (blastDuelOutcome(next) === 'loss') {
      finishMatch('loss');
      return;
    }

    setRoundBanner({
      outcome: 'loss',
      myWins: next.myWins,
      opponentWins: next.opponentWins
    });

    // Safety net: if the winner's shared start never arrives, arm a local plan
    // instead of leaving the loser stuck on the round banner.
    window.setTimeout(() => {
      if (!roundOverRef.current || phaseRef.current !== 'in_game' || roundPlanRef.current) return;
      armRoundStart(createRoundPlan(next.round + 1, Date.now(), ROUND_RESTART_DELAY_MS));
    }, ROUND_RESTART_DELAY_MS + 3600);
  }

  function startRound(round: number) {
    const activeMatchId = matchIdRef.current;
    if (!activeMatchId) return;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    roundOverRef.current = false;
    roundPlanRef.current = null;
    applyScore({ ...scoreRef.current, round });
    setRoundBanner(null);
    setPlayerGarbage(0);
    setOpponentGarbage(0);
    destroyedBlocksRef.current = 0;
    garbageSentRef.current = 0;

    const roundSeed = seedRef.current + round * 7919;
    const pEngine = new GameEngine({
      seed: roundSeed,
      das: settings.das,
      arr: settings.arr,
      softDropFactor: settings.softDropFactor,
      lockDelay: settings.lockDelay,
      startingLevel: BLAST_VERSUS_LEVEL,
      fixedGravity: true,
      lineLevelProgression: false,
      blast: true,
      blastMode: 'training',
      blastResetOnTopOut: false
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
        setPlayerGarbage(pEngine.garbageManager.getPendingCount());
        syncPlayerState(pEngine, true);
      },
      onBlast: (result) => {
        soundManager.playClear(Math.min(4, Math.max(1, result.chain)));
        if (result.chain > 1) soundManager.playCombo(result.chain);

        destroyedBlocksRef.current += result.destroyedBlocks;
        const dueGarbage = Math.floor(destroyedBlocksRef.current / BLOCKS_PER_GARBAGE);
        if (dueGarbage > garbageSentRef.current) {
          const amount = Math.min(20, dueGarbage - garbageSentRef.current);
          garbageSentRef.current += amount;
          soundManager.playGarbageSent();
          void FirebaseRealtimeService.sendAttack(activeMatchId, amount);
        }
        syncPlayerState(pEngine, true);

        // Emptying your board wins the round, exactly like clearing the field
        // in the Game Boy link mode.
        if (result.stageCleared) {
          winRound();
        }
      },
      onGameOver: () => {
        loseRound('topout');
      },
      onScoreUpdate: () => {
        syncPlayerState(pEngine);
      }
    });
    pEngine.activePiece = null;

    const oEngine = new GameEngine({
      seed: roundSeed,
      startingLevel: BLAST_VERSUS_LEVEL,
      fixedGravity: true,
      lineLevelProgression: false,
      blast: true,
      blastMode: 'training'
    });
    oEngine.state = 'playing';

    setPlayerEngine(pEngine);
    setOpponentEngine(oEngine);
    setPlayerHold(null);
    setPlayerQueue([...pEngine.randomizer.peek(6)]);
    setOpponentHold(null);
    setOpponentQueue([]);
    setOpponentGarbage(0);
    setIsCountingDown(true);

    void FirebaseRealtimeService.updateState(activeMatchId, {
      score: 0,
      lines: 0,
      alive: true,
      connected: true,
      board: JSON.stringify(pEngine.board),
      activePiece: null,
      activeBombs: [],
      holdPiece: null,
      queue: [...pEngine.randomizer.peek(6)],
      clearingRows: [],
      combo: -1,
      b2b: false,
      b2bChain: 0,
      roundWins: scoreRef.current.myWins,
      round,
      roundOutcome: null,
      nextRound: null,
      nextRoundAt: null
    });
  }
  startRoundRef.current = startRound;

  function handleCountdownComplete() {
    setIsCountingDown(false);
    const engine = playerEngineRef.current;
    // start() also builds the empty Blast board and fuses the first bombs.
    engine.start();
    engine.startTime = Date.now();
    setPlayerQueue([...engine.randomizer.peek(6)]);
    setPlayerHold(engine.holdPiece);
    syncPlayerState(engine, true);

    keyboardRef.current?.detach();
    const km = new KeyboardManager(engine, settings.keybindings);
    km.attach();
    keyboardRef.current = km;
    gamepadRef.current = new GamepadManager(
      engine,
      settings.gamepadBindings || DEFAULT_GAMEPAD_BINDINGS
    );
    soundManager.startBgm();
  }

  useEffect(() => {
    let animId = 0;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const delta = time - lastTime;
      lastTime = time;

      if (phase === 'in_game' && !isCountingDown) {
        const engine = playerEngineRef.current;
        if (engine.state === 'playing') {
          engine.update(delta);
          keyboardRef.current?.update(delta);
          gamepadRef.current?.update(delta);
          setPlayerHold(engine.holdPiece);
          setPlayerQueue([...engine.randomizer.peek(6)]);
          setPlayerGarbage(engine.garbageManager.getPendingCount());
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [phase, isCountingDown, playerEngine]);

  function attachMatch(nextMatchId: string, nextSeed: number, host: boolean, nextRoomCode: string) {
    cleanupSubscriptions();
    gameStartedRef.current = true;
    matchIdRef.current = nextMatchId;
    seedRef.current = nextSeed;
    roomCodeRef.current = nextRoomCode;
    isHostRef.current = host;
    setMatchId(nextMatchId);
    setRoomCode(nextRoomCode);
    setPhase('in_game');
    phaseRef.current = 'in_game';
    applyScore(createBlastDuelScore());
    setMatchResult(null);
    setWinReason(null);
    setOpponentName(t('Opponent'));
    setOpponentCosmetics(null);
    setRematchWaiting(false);
    setRematchDeclined(false);
    rematchCreatingRef.current = false;
    roundPlanRef.current = null;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    void FirebaseRealtimeService.authenticate(user?.display_name || t('Player 1'));
    FirebaseRealtimeService.registerDisconnect(nextMatchId);
    void FirebaseRealtimeService.updateState(nextMatchId, {
      displayName: user?.display_name || t('Player 1'),
      connected: true,
      alive: true,
      score: 0,
      lines: 0,
      roundWins: 0,
      round: 1
    });

    unsubscribeAttacksRef.current = FirebaseRealtimeService.listenToAttacks(nextMatchId, (amount) => {
      const engine = playerEngineRef.current;
      soundManager.playGarbageWarning();
      engine.garbageManager.enqueueGarbage(amount);
      setPlayerGarbage(engine.garbageManager.getPendingCount());
    });

    unsubscribeOpponentRef.current = FirebaseRealtimeService.listenToOpponent(
      nextMatchId,
      (opponentState: RemotePlayerState) => {
        if (opponentState.displayName) setOpponentName(opponentState.displayName);
        if (opponentState.cosmetics) setOpponentCosmetics(opponentState.cosmetics);

        if (opponentState.connected === false) {
          if (phaseRef.current === 'finished') {
            setRematchDeclined(true);
            setRematchWaiting(false);
            return;
          }
          finishMatch('win', t('Opponent disconnected'));
          return;
        }

        // Explicit end-of-duel signal, so the loser ends the match even when
        // their own round result was already resolved locally.
        if (opponentState.matchWon === true) {
          finishMatch('loss');
          return;
        }

        // Round results are scoped to the round they belong to, so a stale
        // snapshot can never award (or steal) a later round. The score is
        // counted locally, one round at a time: an opponent counter can never
        // jump straight to three wins and end the duel early.
        const roundEvent = opponentRoundEvent(
          opponentState,
          scoreRef.current.round,
          roundOverRef.current
        );
        if (roundEvent === 'lost') {
          loseRound('cleared');
          // Adopt the winner's shared start in the same snapshot when present.
          if (typeof opponentState.nextRound === 'number' && typeof opponentState.nextRoundAt === 'number') {
            armRoundStart({ round: opponentState.nextRound, startsAt: opponentState.nextRoundAt });
          }
          return;
        }
        if (roundEvent === 'won') {
          winRound();
          return;
        }

        // The next-round deadline may arrive on its own update, after the
        // round result, so keep listening for it.
        if (typeof opponentState.nextRound === 'number' && typeof opponentState.nextRoundAt === 'number') {
          armRoundStart({ round: opponentState.nextRound, startsAt: opponentState.nextRoundAt });
        }

        const remoteEngine = opponentEngineRef.current;
        if (opponentState.board) {
          try {
            const parsedBoard = JSON.parse(opponentState.board);
            if (Array.isArray(parsedBoard) && parsedBoard.length > 0) {
              remoteEngine.board = parsedBoard;
            }
          } catch {}
        }
        if (opponentState.activePiece !== undefined) {
          if (opponentState.activePiece) {
            remoteEngine.activePiece = opponentState.activePiece.type as TetrominoType;
            remoteEngine.activeX = opponentState.activePiece.x;
            remoteEngine.activeY = opponentState.activePiece.y;
            remoteEngine.activeRotation = opponentState.activePiece.rotation as 0 | 1 | 2 | 3;
            remoteEngine.state = 'playing';
          } else {
            remoteEngine.activePiece = null;
          }
        }
        if (opponentState.activeBombs) {
          remoteEngine.activeBombLocal = opponentState.activeBombs;
        }
        if (opponentState.score !== undefined) remoteEngine.score = opponentState.score;
        if (opponentState.lines !== undefined) remoteEngine.lines = opponentState.lines;
        if (opponentState.holdPiece !== undefined) {
          setOpponentHold((opponentState.holdPiece as TetrominoType | null) ?? null);
        }
        if (opponentState.queue) setOpponentQueue(opponentState.queue as TetrominoType[]);
        if (opponentState.clearingRows !== undefined) {
          remoteEngine.clearingRows = opponentState.clearingRows || [];
          remoteEngine.lineClearTimer = opponentState.clearingRows?.length ? 240 : 0;
        }
        if (opponentState.combo !== undefined) remoteEngine.comboCount = opponentState.combo;
        if (opponentState.b2b !== undefined) remoteEngine.b2bActive = opponentState.b2b;
        if (opponentState.b2bChain !== undefined) remoteEngine.b2bChain = opponentState.b2bChain;
      },
      user?.id
    );

    startRound(1);
  }

  async function handleQuickSearch() {
    setErrorMsg(null);
    gameStartedRef.current = false;
    setPhase('quick_searching');
    phaseRef.current = 'quick_searching';
    soundManager.playRotate();
    try {
      const displayName = user?.display_name || t('Player 1');
      const cancel = await FirebaseRealtimeService.startQuickMatch(
        displayName,
        (role, nextSeed, nextMatchId, nextRoomCode) => {
          if (gameStartedRef.current) return;
          cancelQuickSearchRef.current = null;
          attachMatch(nextMatchId, nextSeed, role === 'host', nextRoomCode);
        },
        user?.rating ?? 1000,
        user?.id,
        false,
        user?.cosmetics,
        'blast'
      );
      if (phaseRef.current === 'quick_searching') cancelQuickSearchRef.current = cancel;
    } catch (e: any) {
      setErrorMsg(e?.message || t('Quick search failed to connect.'));
      setPhase('lobby');
      phaseRef.current = 'lobby';
    }
  }

  async function handleCancelQuickSearch() {
    soundManager.playMove();
    if (cancelQuickSearchRef.current) {
      await cancelQuickSearchRef.current().catch(() => {});
      cancelQuickSearchRef.current = null;
    }
    cleanupSubscriptions();
    setPhase('lobby');
    phaseRef.current = 'lobby';
    setMatchId(null);
    matchIdRef.current = null;
    setRoomCode('');
    roomCodeRef.current = '';
  }

  async function handleCreateRoom() {
    setErrorMsg(null);
    gameStartedRef.current = false;
    const code = generateRoomCode();
    isHostRef.current = true;
    roomCodeRef.current = code;
    setRoomCode(code);
    setPhase('waiting');
    phaseRef.current = 'waiting';
    try {
      const displayName = user?.display_name || t('Player 1');
      await FirebaseRealtimeService.authenticate(displayName);
      const { matchId: nextMatchId, seed } = await FirebaseRealtimeService.createRoom(
        code,
        displayName,
        user?.rating ?? 1000,
        user?.id,
        false,
        user?.cosmetics,
        'blast'
      );
      matchIdRef.current = nextMatchId;
      setMatchId(nextMatchId);
      setOpponentCosmetics(null);

      unsubscribeMatchRef.current = FirebaseRealtimeService.listenToMatchStart(nextMatchId, (matchData) => {
        if (gameStartedRef.current) return;
        unsubscribeMatchRef.current?.();
        unsubscribeMatchRef.current = null;
        const myUid = FirebaseRealtimeService.getUid();
        if (matchData.players) {
          for (const [uid, player] of Object.entries<any>(matchData.players)) {
            if (uid !== myUid) {
              setOpponentName(player.displayName || t('Player 2'));
              setOpponentCosmetics(player.cosmetics || null);
              break;
            }
          }
        }
        attachMatch(nextMatchId, seed, true, code);
      });
    } catch (e: any) {
      setErrorMsg(e?.message || t('Failed to create room on Firebase'));
      setPhase('lobby');
      phaseRef.current = 'lobby';
    }
  }

  async function handleJoinRoom(codeArg?: string) {
    const code = (codeArg || lobbyCode).trim().toUpperCase();
    if (!code) return;
    setErrorMsg(null);
    gameStartedRef.current = false;
    isHostRef.current = false;
    try {
      const displayName = user?.display_name || t('Player 2');
      await FirebaseRealtimeService.authenticate(displayName);
      const { matchId: nextMatchId, seed } = await FirebaseRealtimeService.joinRoom(
        code,
        displayName,
        user?.rating ?? 1000,
        user?.id,
        false,
        user?.cosmetics,
        'blast'
      );
      setOpponentName(t('Opponent'));
      setOpponentCosmetics(null);
      attachMatch(nextMatchId, seed, false, code);
    } catch (e: any) {
      setErrorMsg(e?.message || t('Failed to join room. Verify the code.'));
      setPhase('lobby');
      phaseRef.current = 'lobby';
    }
  }

  function handleLeave() {
    soundManager.stopBgm();
    if (cancelQuickSearchRef.current) {
      void cancelQuickSearchRef.current().catch(() => {});
      cancelQuickSearchRef.current = null;
    }
    const activeMatchId = matchIdRef.current;
    const activeRoomCode = roomCodeRef.current;
    if (activeMatchId && activeRoomCode) {
      if (phaseRef.current === 'waiting') {
        void ApiClient.cancelOnlineMatch(activeMatchId).catch(() => {});
      }
      void FirebaseRealtimeService.leaveRoom(activeRoomCode, activeMatchId, isHostRef.current).catch(() => {});
    }
    cleanupSubscriptions();
    keyboardRef.current?.detach();
    keyboardRef.current = null;
    gamepadRef.current = null;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    matchIdRef.current = null;
    roomCodeRef.current = '';
    gameStartedRef.current = false;
    setMatchId(null);
    setRoomCode('');
    setOpponentCosmetics(null);
    setRematchWaiting(false);
    setRematchDeclined(false);
    rematchCreatingRef.current = false;
    roundPlanRef.current = null;
    setPlayerEngine(new GameEngine());
    setOpponentEngine(new GameEngine());
    setRoundBanner(null);
    setMatchResult(null);
    setWinReason(null);
    applyScore(createBlastDuelScore());
    setPhase('lobby');
    phaseRef.current = 'lobby';
  }

  useEffect(() => {
    if (!initialEntry) return;
    const intent = initialEntry.intent;
    if (intent === 'quick') void handleQuickSearch();
    else if (intent === 'create') void handleCreateRoom();
    else if (intent === 'join' && initialEntry.roomCode) void handleJoinRoom(initialEntry.roomCode);
    // The lobby entry is consumed once when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isAuthenticated) {
    return (
      <div style={{ width: '100%', maxWidth: '560px', textAlign: 'center', marginTop: '3rem' }}>
        <div className="panel-card" style={{ padding: '2.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
          <Bomb size={44} color="var(--accent-orange)" />
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>{t('Authentication Required')}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{t('Sign in to play Blast online.')}</p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn-primary" onClick={() => onNavigate?.('login')}>
              <LogIn size={18} /> {t('Log In')}
            </button>
            <button className="btn-secondary" onClick={onExit}>{t('Back to Multiplayer')}</button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'lobby') {
    return (
      <div className="versus-page" style={{ maxWidth: '760px' }}>
        <div className="panel-card" style={{ padding: '2rem', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '0.5rem' }}>
            <Bomb size={26} color="var(--accent-orange)" />
            <h1 style={{ fontSize: '1.9rem', fontWeight: 800 }}>{t('Blast Battle')}</h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            {t('Clear your board or make your opponent top out. Every 10 destroyed blocks sends a garbage row.')}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            {t('Duel another player in Blast to three round wins. Empty your board or make your opponent top out to win.')}
          </p>
          {errorMsg && <div style={{ color: 'var(--accent-red)', marginBottom: '1rem' }}>{errorMsg}</div>}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={() => void handleQuickSearch()}>
              <Search size={18} /> {t('Blast Quick Play')}
            </button>
            <button className="btn-secondary" onClick={() => void handleCreateRoom()}>
              <Plus size={18} /> {t('Host Blast Room')}
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <input
              value={lobbyCode}
              onChange={(event) => setLobbyCode(event.target.value.toUpperCase())}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handleJoinRoom();
              }}
              placeholder={t('CODE')}
              maxLength={6}
              style={{ flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', textAlign: 'center', letterSpacing: '0.15em' }}
            />
            <button className="btn-secondary" onClick={() => void handleJoinRoom()}>
              {t('Join Blast Room')}
            </button>
          </div>
          <button className="btn-secondary" style={{ marginTop: '1.25rem' }} onClick={onExit}>
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
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{t('Searching for Blast Opponent...')}</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            {t('The duel starts as soon as another player joins.')}
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
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{t('Waiting for opponent...')}</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            {t('Share this room code with your friend. The duel starts when they join.')}
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', marginTop: '1.25rem', padding: '0.75rem 1.25rem', border: '2px dashed var(--accent-cyan)', borderRadius: 'var(--radius-md)' }}>
            <strong style={{ fontSize: '1.8rem', letterSpacing: '0.2em', color: 'var(--accent-cyan)' }}>{roomCode}</strong>
            <button
              className="icon-btn"
              onClick={() => {
                void navigator.clipboard.writeText(roomCode);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check size={18} color="var(--accent-green)" /> : <Copy size={18} />}
            </button>
          </div>
          {errorMsg && <div style={{ color: 'var(--accent-red)', marginTop: '1rem' }}>{errorMsg}</div>}
          <button className="btn-secondary" style={{ marginTop: '1.5rem' }} onClick={handleLeave}>
            {t('Cancel & Back to Lobby')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="versus-page">
      <div className="versus-toolbar">
        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('Round')} </span>
          <strong style={{ fontSize: '1.1rem', color: 'var(--accent-cyan)' }}>{roundNumber}</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {[0, 1, 2].map((index) => (
            <span
              key={`me-${index}`}
              title={t('Your rounds')}
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: index < myWins ? 'var(--accent-green)' : 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)'
              }}
            />
          ))}
          <span style={{ fontWeight: 800, margin: '0 0.35rem' }}>{myWins} - {opponentWins}</span>
          {[0, 1, 2].map((index) => (
            <span
              key={`them-${index}`}
              title={t('Opponent rounds')}
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: index < opponentWins ? 'var(--accent-orange)' : 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)'
              }}
            />
          ))}
        </div>
        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('Room Code:')} </span>
          <strong style={{ fontSize: '0.95rem', letterSpacing: '0.1em', color: 'var(--accent-cyan)' }}>{roomCode}</strong>
        </div>
        <button className="btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }} onClick={handleLeave}>
          {t('Leave Room')}
        </button>
      </div>

      <VersusArena
        arenaRef={arenaRef}
        cellSize={cellSize}
        vsTone="green"
        vsLabel="BLAST"
        player={{
          label: <UserName displayName={user?.display_name || t('Player 1')} cosmetics={user?.cosmetics} size="0.95rem" />,
          tone: 'cyan',
          hold: playerHold,
          canHold: playerEngine.canHold,
          queue: playerQueue,
          score: playerEngine.score,
          lines: playerEngine.lines,
          combo: playerEngine.comboCount,
          b2b: playerEngine.b2bActive,
          b2bChain: playerEngine.b2bChain,
          engine: playerEngine,
          garbage: playerGarbage
        }}
        opponent={{
          label: <UserName displayName={opponentName} cosmetics={opponentCosmetics} size="0.95rem" />,
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
          garbage: opponentGarbage
        }}
        isCountingDown={isCountingDown}
        onCountdownComplete={handleCountdownComplete}
        overlay={
          <>
            {roundBanner && (
              <div className="versus-pause-overlay" role="status" aria-live="assertive">
                <div className="panel-card" style={{ padding: '1.75rem 2.25rem', textAlign: 'center', gap: '0.5rem' }}>
                  <div style={{ fontSize: '1.7rem', fontWeight: 900, color: roundBanner.outcome === 'win' ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    {roundBanner.outcome === 'win' ? t('You win the round!') : t('You lose the round!')}
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'monospace' }}>
                    {roundBanner.myWins} - {roundBanner.opponentWins}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {roundBanner.outcome === 'win'
                      ? t('Clear your board or make your opponent top out to take a round.')
                      : t('Your opponent took this round. The next one starts in a moment.')}
                  </div>
                </div>
              </div>
            )}

            {phase === 'finished' && (
              <div className="versus-pause-overlay" role="status" aria-live="polite">
                <div className="panel-card" style={{ padding: '2rem', textAlign: 'center', gap: '0.75rem', maxWidth: '420px' }}>
                  <Bomb size={36} color="var(--accent-orange)" style={{ margin: '0 auto' }} />
                  <h2 style={{ fontSize: '1.6rem', fontWeight: 900, color: matchResult === 'win' ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    {matchResult === 'win' ? t('You win the Blast duel!') : t('You lose the Blast duel.')}
                  </h2>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'monospace' }}>
                    {myWins} - {opponentWins}
                  </div>
                  {winReason && <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{winReason}</p>}
                  <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.5rem' }}>
                    <button
                      className="btn-primary"
                      onClick={handleRematch}
                      disabled={rematchWaiting || rematchDeclined}
                    >
                      <RotateCcw size={16} /> {rematchWaiting ? t('Waiting for opponent...') : t('Play Again')}
                    </button>
                    <button className="btn-secondary" onClick={handleLeave}>
                      {t('Back to Multiplayer')}
                    </button>
                  </div>
                  {rematchDeclined && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{t('Opponent disconnected')}</p>
                  )}
                </div>
              </div>
            )}
          </>
        }
      />
    </div>
  );
};
