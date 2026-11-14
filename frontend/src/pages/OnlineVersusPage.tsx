import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/engine/gameEngine';
import { KeyboardManager } from '../game/input/keyboardManager';
import { GamepadManager, DEFAULT_GAMEPAD_BINDINGS } from '../game/input/gamepadManager';
import { soundManager } from '../game/audio/soundManager';
import { GameOverModal } from '../components/game/GameOverModal';
import { VersusArena } from '../components/game/VersusArena';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { FirebaseRealtimeService, PlayerCosmetics, RemotePlayerState } from '../services/firebaseRealtime';
import { UserName } from '../components/user/UserName';
import { ApiClient } from '../services/api';
import { useDynamicCellSize } from '../hooks/useDynamicCellSize';
import { useGamepadActive, useGamepadBack } from '../context/GamepadNavContext';
import { Users, Plus, LogIn, Copy, Check, Search, Zap, X, Loader2, Lock, Trophy, Skull, Bomb } from 'lucide-react';
import { useI18n } from '../i18n/useI18n';

interface OnlineVersusPageProps {
  onNavigate?: (tab: string) => void;
  onStartCoop?: (intent: 'quick' | 'create' | 'join', roomCode?: string) => void;
  onStartBlast?: (intent: 'quick' | 'create' | 'join', roomCode?: string) => void;
}

const categorySectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.9rem',
  padding: '1.25rem',
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-lg)',
  textAlign: 'left'
};

const categoryTitleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.55rem',
  fontSize: '1.15rem',
  fontWeight: 800
};

const modeCardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.65rem',
  padding: '1.15rem'
};

const modeButtonStyle: React.CSSProperties = {
  marginTop: 'auto',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  padding: '0.65rem',
  fontSize: '0.9rem',
  fontWeight: 700
};

export const OnlineVersusPage: React.FC<OnlineVersusPageProps> = ({ onNavigate, onStartCoop, onStartBlast }) => {
  const { user, isAuthenticated, refreshProfile } = useAuth();
  const { settings } = useSettings();
  const { t } = useI18n();
  const arenaRef = useRef<HTMLDivElement>(null);
  const cellSize = useDynamicCellSize(true, arenaRef);

  const [matchId, setMatchId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string>('');
  const [inputCode, setInputCode] = useState<string>('');
  const [coopInputCode, setCoopInputCode] = useState<string>('');
  const [blastInputCode, setBlastInputCode] = useState<string>('');
  const [matchStatus, setMatchStatus] = useState<'lobby' | 'waiting' | 'quick_searching' | 'in_game' | 'finished'>('lobby');
  const [quickSearchSeconds, setQuickSearchSeconds] = useState<number>(0);
  const [isCountingDown, setIsCountingDown] = useState<boolean>(false);
  const [opponentName, setOpponentName] = useState<string>(() => t('Opponent'));
  const [opponentCosmetics, setOpponentCosmetics] = useState<PlayerCosmetics | null>(null);
  const [playerRating, setPlayerRating] = useState<number>(() => user?.rating ?? 1000);
  const [opponentRating, setOpponentRating] = useState<number>(1000);
  const [isRankedMatch, setIsRankedMatch] = useState<boolean>(false);

  const [eloResult, setEloResult] = useState<{ oldRating: number; newRating: number; delta: number; opponentRating: number | null } | null>(null);

  const [playerEngine, setPlayerEngine] = useState<GameEngine>(() => new GameEngine());
  const [opponentEngine, setOpponentEngine] = useState<GameEngine>(() => new GameEngine());

  const [playerHold, setPlayerHold] = useState<any>(null);
  const [playerQueue, setPlayerQueue] = useState<any[]>([]);
  const [opponentHold, setOpponentHold] = useState<any>(null);
  const [opponentQueue, setOpponentQueue] = useState<any[]>([]);

  const [playerGarbage, setPlayerGarbage] = useState<number>(0);
  const [opponentGarbage, setOpponentGarbage] = useState<number>(0);

  const [matchResult, setMatchResult] = useState<'win' | 'loss' | null>(null);
  const [isGameOverOpen, setIsGameOverOpen] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Online Rematch state
  const [isHost, setIsHost] = useState<boolean>(false);
  const [rematchPlayerReady, setRematchPlayerReady] = useState<boolean>(false);
  const [rematchOpponentReady, setRematchOpponentReady] = useState<boolean>(false);
  const [rematchOpponentLeft, setRematchOpponentLeft] = useState<boolean>(false);

  const isPlaying = matchStatus === 'in_game' && !isGameOverOpen && (playerEngine.state === 'playing' || isCountingDown);
  useGamepadActive(isPlaying);

  useGamepadBack(() => {
    if (isGameOverOpen) {
      setIsGameOverOpen(false);
      handleLeaveRoom();
      return true;
    }
    if (matchStatus === 'quick_searching') {
      handleCancelQuickSearch();
      return true;
    }
    if (matchStatus === 'waiting' || matchStatus === 'in_game') {
      handleLeaveRoom();
      return true;
    }
    return false;
  }, [isGameOverOpen, matchStatus]);

  const keyboardRef = useRef<KeyboardManager | null>(null);
  const gamepadRef = useRef<GamepadManager | null>(null);
  const cancelQuickSearchRef = useRef<(() => Promise<void>) | null>(null);
  const unsubscribeAttacksRef = useRef<(() => void) | null>(null);
  const unsubscribeOpponentRef = useRef<(() => void) | null>(null);
  const unsubscribeMatchRef = useRef<(() => void) | null>(null);
  const unsubscribeRematchRef = useRef<(() => void) | null>(null);
  const unsubscribeNextMatchRef = useRef<(() => void) | null>(null);
  const nextMatchTriggeredRef = useRef<boolean>(false);
  const isHostRef = useRef<boolean>(false);
  isHostRef.current = isHost;
  const gameStartedRef = useRef<boolean>(false);
  const lastSyncTimeRef = useRef<number>(0);
  const matchEndedRef = useRef<boolean>(false);

  const playerEngineRef = useRef<GameEngine>(playerEngine);
  playerEngineRef.current = playerEngine;
  const matchStatusRef = useRef(matchStatus);
  matchStatusRef.current = matchStatus;
  const roomCodeRef = useRef(roomCode);
  roomCodeRef.current = roomCode;
  const matchIdRef = useRef(matchId);
  matchIdRef.current = matchId;
  const isAuthenticatedRef = useRef(isAuthenticated);
  isAuthenticatedRef.current = isAuthenticated;

  const cleanupSubscriptions = () => {
    if (unsubscribeAttacksRef.current) {
      unsubscribeAttacksRef.current();
      unsubscribeAttacksRef.current = null;
    }
    if (unsubscribeOpponentRef.current) {
      unsubscribeOpponentRef.current();
      unsubscribeOpponentRef.current = null;
    }
    if (unsubscribeMatchRef.current) {
      unsubscribeMatchRef.current();
      unsubscribeMatchRef.current = null;
    }
    if (unsubscribeRematchRef.current) {
      unsubscribeRematchRef.current();
      unsubscribeRematchRef.current = null;
    }
    if (unsubscribeNextMatchRef.current) {
      unsubscribeNextMatchRef.current();
      unsubscribeNextMatchRef.current = null;
    }
  };

  const setRankedMode = (ranked: boolean) => {
    setIsRankedMatch(ranked);
  };

  // Shared forfeit logic: mark player as disconnected, record loss, cleanup
  const forfeitAndLeave = () => {
    if (matchEndedRef.current) return;
    const status = matchStatusRef.current;
    const code = roomCodeRef.current;
    const mId = matchIdRef.current;
    if (status !== 'in_game' && status !== 'waiting') return;

    matchEndedRef.current = true;

    // Mark as disconnected in Firebase so opponent gets the win
    if (code && mId) {
      FirebaseRealtimeService.leaveRoom(code, mId, isHostRef.current);
    }

    if (!mId || !isAuthenticatedRef.current) return;

    if (status === 'waiting') {
      // Cancel the server-owned waiting match so abandoned rooms do not linger.
      ApiClient.sendBeaconForfeit({ matchId: mId, result: 'cancel' });
      return;
    }

    if (status === 'in_game') {
      const stats = playerEngineRef.current.getStats();
      // The opponent identity and ranked status come from the server match.
      ApiClient.sendBeaconForfeit({
        matchId: mId,
        result: 'loss',
        playerScore: playerEngineRef.current.score,
        playerLines: playerEngineRef.current.lines,
        duration: Math.round(playerEngineRef.current.totalPlayTimeMs || 0),
        piecesPlaced: stats.piecesPlaced || 0,
        tetrises: stats.tetrises || 0,
        tSpins: stats.tSpins || 0,
        perfectClears: stats.perfectClears || 0,
        maxCombo: stats.maxCombo || 0,
        maxB2B: stats.maxB2B || 0
      });
    }
  };

  // Refresh the displayed rating when returning to the online menu, since an
  // abandoned match may have changed it while this page was unmounted.
  useEffect(() => {
    refreshProfile().catch(() => {});
    // Signing in here also lets the stale-match janitor run for players who
    // open the lobby without starting a game.
    void FirebaseRealtimeService.authenticate(user?.display_name || 'Player').catch(() => {});
  }, [user?.display_name]);

  useEffect(() => {
    if (user?.rating !== undefined) {
      setPlayerRating(user.rating);
    }
  }, [user?.rating]);

  // Handle window unload / closing tab / browser close while match is in progress
  useEffect(() => {
    const handleBeforeUnload = () => {
      forfeitAndLeave();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, []);

  // Handle component unmount (user navigates to another page/tab in the app)
  useEffect(() => {
    return () => {
      keyboardRef.current?.detach();
      soundManager.stopBgm();
      forfeitAndLeave();
      cleanupSubscriptions();
    };
  }, []);

  // Quick Search Timer
  useEffect(() => {
    if (matchStatus !== 'quick_searching') {
      setQuickSearchSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      setQuickSearchSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [matchStatus]);

  // Quick Search Matchmaking Action
  const handleQuickSearch = async (ranked: boolean) => {
    setErrorMsg(null);
    cleanupSubscriptions();
    gameStartedRef.current = false;
    setOpponentCosmetics(null);
    setRankedMode(ranked);
    setMatchStatus('quick_searching');
    soundManager.playRotate();

    try {
      const displayName = user?.display_name || t('Player 1');
      const myRating = user?.rating || 1000;
      setEloResult(null);
      const cancelFn = await FirebaseRealtimeService.startQuickMatch(
        displayName,
        (role, seed, mId, rCode) => {
          if (gameStartedRef.current) return;
          gameStartedRef.current = true;
          cancelQuickSearchRef.current = null;

          const amIHost = role === 'host';
          setIsHost(amIHost);
          isHostRef.current = amIHost;
          setMatchId(mId);
          setRoomCode(rCode);
          setOpponentName(t('Online Opponent'));

          startLiveGame(seed, mId);
        },
        myRating,
        user?.id,
        ranked,
        user?.cosmetics
      );

      cancelQuickSearchRef.current = cancelFn;
    } catch (e: any) {
      console.warn('Quick search failed:', e);
      setErrorMsg(e.message || t('Quick search failed to connect.'));
      setRankedMode(false);
      setMatchStatus('lobby');
    }
  };

  const handleCancelQuickSearch = async () => {
    soundManager.playMove();
    if (cancelQuickSearchRef.current) {
      await cancelQuickSearchRef.current();
      cancelQuickSearchRef.current = null;
    }
    cleanupSubscriptions();
    setRankedMode(false);
    setMatchStatus('lobby');
    setMatchId(null);
    setRoomCode('');
  };

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // Host creates room and WAITS for opponent
  const handleCreateRoom = async () => {
    setErrorMsg(null);
    cleanupSubscriptions();
    gameStartedRef.current = false;
    setIsHost(true);
    isHostRef.current = true;

    const code = generateRoomCode();
    setRoomCode(code);
    setMatchStatus('waiting');

    try {
      const displayName = user?.display_name || t('Player 1');
      const myRating = user?.rating || 1000;
      setEloResult(null);
      setRankedMode(false);
      await FirebaseRealtimeService.authenticate(displayName);
      const { matchId: mId, seed } = await FirebaseRealtimeService.createRoom(code, displayName, myRating, user?.id, false, user?.cosmetics);
      setMatchId(mId);
      setOpponentCosmetics(null);

      // Listen strictly once for when status becomes 'active'
      unsubscribeMatchRef.current = FirebaseRealtimeService.listenToMatchStart(mId, (matchData) => {
        if (gameStartedRef.current) return;
        gameStartedRef.current = true;
        setRankedMode(matchData.ranked === true);

        // Unsubscribe from match start listener to prevent any repeated calls
        if (unsubscribeMatchRef.current) {
          unsubscribeMatchRef.current();
          unsubscribeMatchRef.current = null;
        }

        // Find opponent name and cosmetics. Ratings are loaded from the
        // server-owned match below, not from client-written Firebase data.
        const myUid = FirebaseRealtimeService.getUid();
        if (matchData.players) {
          for (const [uid, p] of Object.entries<any>(matchData.players)) {
            if (uid !== myUid) {
              setOpponentName(p.displayName || t('Player 2'));
              setOpponentCosmetics(p.cosmetics || null);
              break;
            }
          }
        }

        startLiveGame(seed, mId);
      });
    } catch (e: any) {
      console.warn('Failed to create room:', e);
      setErrorMsg(e.message || t('Failed to create room on Firebase'));
      setMatchStatus('lobby');
    }
  };

  // Guest enters room code to join
  const handleJoinRoom = async () => {
    if (!inputCode.trim()) return;
    setErrorMsg(null);
    cleanupSubscriptions();
    gameStartedRef.current = false;
    setIsHost(false);
    isHostRef.current = false;
    setRankedMode(false);

    const code = inputCode.trim().toUpperCase();
    setRoomCode(code);

    try {
      const displayName = user?.display_name || t('Player 2');
      const myRating = user?.rating || 1000;
      setEloResult(null);
      await FirebaseRealtimeService.authenticate(displayName);
      const { matchId: mId, seed } = await FirebaseRealtimeService.joinRoom(code, displayName, myRating, user?.id, false, user?.cosmetics);
      setMatchId(mId);
      setOpponentName(t('Host'));
      setOpponentCosmetics(null);

      gameStartedRef.current = true;
      startLiveGame(seed, mId);
    } catch (e: any) {
      console.warn('Failed to join room:', e);
      setErrorMsg(e.message || t('Failed to join room. Verify the code.'));
    }
  };

  // Ratings above the boards must come from the server. Firebase player
  // entries are client-written and can be stale or tampered with.
  const refreshMatchRatings = async (currentMatchId: string) => {
    try {
      const info = await ApiClient.getOnlineMatch(currentMatchId);
      if (matchIdRef.current !== currentMatchId) return;
      const myId = user?.id;
      const me = info.players.host.userId === myId
        ? info.players.host
        : info.players.guest?.userId === myId
          ? info.players.guest
          : null;
      const opponent = info.players.host.userId === myId
        ? info.players.guest
        : info.players.host;
      if (me) setPlayerRating(me.rating);
      if (opponent) setOpponentRating(opponent.rating);
    } catch (e) {
      console.warn('Failed to load match ratings:', e);
    }
  };

  const startLiveGame = (seed: number, currentMatchId: string) => {
    setMatchStatus('in_game');
    matchEndedRef.current = false;
    setEloResult(null);
    refreshMatchRatings(currentMatchId);

    const pEngine = new GameEngine({
      seed,
      das: settings.das,
      arr: settings.arr,
      softDropFactor: settings.softDropFactor,
      lockDelay: settings.lockDelay
    });

    const oEngine = new GameEngine({
      seed,
      lockDelay: 500
    });
    // Set opponent engine to playing so active piece & minos can be rendered
    oEngine.state = 'playing';

    // Send garbage attack event
    pEngine.events.onGarbageSent = (amount) => {
      soundManager.playGarbageSent();
      FirebaseRealtimeService.sendAttack(currentMatchId, amount);
      oEngine.garbageManager.enqueueGarbage(amount);
      setOpponentGarbage(oEngine.garbageManager.getPendingCount());
    };

    pEngine.events.onPieceMove = () => {
      soundManager.playMove();
      syncPlayerState(pEngine, currentMatchId);
    };

    pEngine.events.onPieceRotate = () => {
      soundManager.playRotate();
      syncPlayerState(pEngine, currentMatchId);
    };

    pEngine.events.onPieceLock = () => {
      soundManager.playLock();
      setPlayerGarbage(pEngine.garbageManager.getPendingCount());
      syncPlayerState(pEngine, currentMatchId, true);
    };

    pEngine.events.onLineClear = (res) => {
      soundManager.playClear(res.linesCleared);
      if (res.comboCount > 0) soundManager.playCombo(res.comboCount);
      setPlayerGarbage(pEngine.garbageManager.getPendingCount());
      syncPlayerState(pEngine, currentMatchId, true);
    };

    pEngine.events.onLineClearFinish = () => {
      syncPlayerState(pEngine, currentMatchId, true);
    };

    // Game over detection
    pEngine.events.onGameOver = () => {
      FirebaseRealtimeService.updateState(currentMatchId, { alive: false });
      handleEndMatch('loss', pEngine);
    };

    setPlayerEngine(pEngine);
    setOpponentEngine(oEngine);
    setPlayerGarbage(0);
    setOpponentGarbage(0);
    setIsGameOverOpen(false);

    // Listen to opponent attacks
    if (unsubscribeAttacksRef.current) unsubscribeAttacksRef.current();
    unsubscribeAttacksRef.current = FirebaseRealtimeService.listenToAttacks(currentMatchId, (amount) => {
      soundManager.playGarbageWarning();
      pEngine.garbageManager.enqueueGarbage(amount);
      setPlayerGarbage(pEngine.garbageManager.getPendingCount());
    });

    // Listen to opponent state updates (board, active piece, queue, score, death, disconnect)
    if (unsubscribeOpponentRef.current) unsubscribeOpponentRef.current();
    unsubscribeOpponentRef.current = FirebaseRealtimeService.listenToOpponent(currentMatchId, (opponentState: RemotePlayerState) => {
      if (opponentState.displayName) {
        setOpponentName(opponentState.displayName);
      }
      if (opponentState.cosmetics) {
        setOpponentCosmetics(opponentState.cosmetics);
      }
      if (opponentState.connected === false) {
        if (matchStatusRef.current === 'finished') {
          setRematchOpponentLeft(true);
        } else {
          // Opponent left or disconnected -> player wins by forfeit!
          handleEndMatch('win', pEngine, t('Opponent disconnected'));
        }
        return;
      }
      if (opponentState.alive === false) {
        // Opponent topped out -> we win!
        handleEndMatch('win', pEngine);
        return;
      }
      if (opponentState.board) {
        try {
          const parsedBoard = JSON.parse(opponentState.board);
          if (Array.isArray(parsedBoard) && parsedBoard.length > 0) {
            oEngine.board = parsedBoard;
          }
        } catch {}
      }
      if (opponentState.activePiece !== undefined) {
        if (opponentState.activePiece) {
          oEngine.activePiece = opponentState.activePiece.type as any;
          oEngine.activeX = opponentState.activePiece.x;
          oEngine.activeY = opponentState.activePiece.y;
          oEngine.activeRotation = opponentState.activePiece.rotation as any;
          oEngine.state = 'playing';
        } else {
          oEngine.activePiece = null;
        }
      }
      if (opponentState.lines !== undefined) {
        oEngine.lines = opponentState.lines;
      }
      if (opponentState.score !== undefined) {
        oEngine.score = opponentState.score;
      }
      if (opponentState.holdPiece !== undefined) {
        setOpponentHold(opponentState.holdPiece);
      }
      if (opponentState.queue) {
        setOpponentQueue(opponentState.queue);
      }
      if (opponentState.clearingRows !== undefined) {
        oEngine.clearingRows = opponentState.clearingRows || [];
        oEngine.lineClearTimer = opponentState.clearingRows && opponentState.clearingRows.length > 0 ? 240 : 0;
      }
      if (opponentState.combo !== undefined) {
        oEngine.comboCount = opponentState.combo;
      }
      if (opponentState.b2b !== undefined) {
        oEngine.b2bActive = opponentState.b2b;
      }
      if (opponentState.b2bChain !== undefined) {
        oEngine.b2bChain = opponentState.b2bChain;
      }
    });

    if (keyboardRef.current) keyboardRef.current.detach();
    const km = new KeyboardManager(pEngine, settings.keybindings);
    km.attach();
    keyboardRef.current = km;

    gamepadRef.current = new GamepadManager(pEngine, settings.gamepadBindings || DEFAULT_GAMEPAD_BINDINGS);

    // Before countdown: show exact upcoming pieces with the 1st falling piece on top
    pEngine.activePiece = null;
    setPlayerQueue([...pEngine.randomizer.peek(6)]);

    // Start 3-second countdown before gameplay
    setIsCountingDown(true);
  };

  const syncPlayerState = (engine: GameEngine, currentMatchId: string, force: boolean = false) => {
    const now = performance.now();
    // Throttle move/rotate sync to at most every 50ms, lock/clear is forced
    if (!force && now - lastSyncTimeRef.current < 50) return;
    lastSyncTimeRef.current = now;

    FirebaseRealtimeService.updateState(currentMatchId, {
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
  };

  const handleCountdownComplete = () => {
    setIsCountingDown(false);
    playerEngine.state = 'playing';
    playerEngine.startTime = Date.now();
    playerEngine.spawnPiece();
    setPlayerQueue([...playerEngine.randomizer.peek(6)]);
    if (matchId) {
      syncPlayerState(playerEngine, matchId, true);
    }
    soundManager.startBgm();
  };

  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const delta = time - lastTime;
      lastTime = time;

      if (!isCountingDown && matchStatus === 'in_game') {
        if (playerEngine.state === 'playing') {
          playerEngine.update(delta);
          keyboardRef.current?.update(delta);
          gamepadRef.current?.update(delta);
          setPlayerHold(playerEngine.holdPiece);
          setPlayerQueue([...playerEngine.randomizer.peek(6)]);
          setPlayerGarbage(playerEngine.garbageManager.getPendingCount());
        }

        if (opponentEngine.clearingRows.length > 0) {
          opponentEngine.lineClearTimer -= delta;
          if (opponentEngine.lineClearTimer <= 0) {
            // Let the engine handle line clear completion to properly remove rows and spawn next piece
            opponentEngine.finishLineClear();
          }
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [playerEngine, matchStatus, isCountingDown]);

  const [winReason, setWinReason] = useState<string | null>(null);

  const handleEndMatch = async (result: 'win' | 'loss', engine: GameEngine, reason?: string) => {
    soundManager.stopBgm();
    if (matchStatus === 'finished' || matchEndedRef.current) return;
    matchEndedRef.current = true;
    setMatchResult(result);
    setWinReason(reason || null);
    setMatchStatus('finished');
    setIsGameOverOpen(true);

    // Reset rematch states for the newly finished match
    setRematchPlayerReady(false);
    setRematchOpponentReady(false);
    setRematchOpponentLeft(false);
    nextMatchTriggeredRef.current = false;

    // Listen to rematch decisions on this match
    const currentMatchId = matchIdRef.current;
    if (currentMatchId) {
      if (unsubscribeRematchRef.current) unsubscribeRematchRef.current();
      unsubscribeRematchRef.current = FirebaseRealtimeService.listenToRematch(currentMatchId, (rematchData) => {
        const myUid = FirebaseRealtimeService.getUid();
        const iAmReady = Boolean(rematchData[myUid]);
        let oppIsReady = false;
        for (const [uid, ready] of Object.entries(rematchData)) {
          if (uid !== myUid && ready) {
            oppIsReady = true;
            break;
          }
        }
        setRematchPlayerReady(iAmReady);
        setRematchOpponentReady(oppIsReady);

        // If both players want to play again, host triggers creation of the next match
        if (iAmReady && oppIsReady && !nextMatchTriggeredRef.current) {
          if (isHostRef.current) {
            nextMatchTriggeredRef.current = true;
            FirebaseRealtimeService.createNextMatch(currentMatchId, roomCodeRef.current).catch(console.warn);
          }
        }
      });

      // Listen to next match being created by host
      if (unsubscribeNextMatchRef.current) unsubscribeNextMatchRef.current();
      unsubscribeNextMatchRef.current = FirebaseRealtimeService.listenToNextMatch(currentMatchId, ({ nextMatchId, seed }) => {
        handleStartRematch(nextMatchId, seed);
      });
    }

    if (result === 'win') {
      soundManager.playClear(4);
    } else {
      soundManager.playGameOver();
    }

    const matchIdForRecord = matchIdRef.current;

    if (isAuthenticated && matchIdForRecord) {
      try {
        const stats = engine.getStats();
        const payload = {
          opponentType: 'human',
          matchId: matchIdForRecord,
          result,
          playerScore: engine.score,
          playerLines: engine.lines,
          duration: Math.round(engine.totalPlayTimeMs || 0),
          piecesPlaced: stats.piecesPlaced || 0,
          tetrises: stats.tetrises || 0,
          tSpins: stats.tSpins || 0,
          perfectClears: stats.perfectClears || 0,
          maxCombo: stats.maxCombo || 0,
          maxB2B: stats.maxB2B || 0
        };
        const res = await ApiClient.recordMatch(payload);

        if (res && res.elo) {
          setEloResult(res.elo);
          setPlayerRating(res.elo.newRating);
          await Promise.all([refreshProfile(), refreshMatchRatings(matchIdForRecord)]);
        }

        // The first ranked report is pending until the opponent reports. Poll
        // the server briefly so the loser also sees the final ELO change.
        if (res?.pending && matchIdForRecord) {
          pollRankedResult(matchIdForRecord);
        }
      } catch (e) {
        console.warn('Failed to record online match:', e);
      }
    }
  };

  const pollRankedResult = async (currentMatchId: string) => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (matchIdRef.current !== currentMatchId) return;
      try {
        const res = await ApiClient.getOnlineMatchResult(currentMatchId);
        if (res.settled && res.elo) {
          setEloResult(res.elo);
          setPlayerRating(res.elo.newRating);
          await Promise.all([refreshProfile(), refreshMatchRatings(currentMatchId)]);
          return;
        }
      } catch {
        return;
      }
    }
  };

  // Called when user clicks "Play Again" on online modal
  const handleRequestPlayAgain = () => {
    if (rematchPlayerReady || rematchOpponentLeft) return;
    setRematchPlayerReady(true);
    soundManager.playRotate();
    const currentMatchId = matchIdRef.current;
    if (currentMatchId) {
      FirebaseRealtimeService.requestRematch(currentMatchId);
    }
  };

  // Called when both players agreed and next match was created in the same room
  const handleStartRematch = (nextMatchId: string, seed: number) => {
    setIsGameOverOpen(false);
    setEloResult(null);
    setRematchPlayerReady(false);
    setRematchOpponentReady(false);
    setRematchOpponentLeft(false);
    nextMatchTriggeredRef.current = false;

    // Detach listeners from previous match
    cleanupSubscriptions();

    setMatchId(nextMatchId);
    matchIdRef.current = nextMatchId;

    // Register onDisconnect for current player on the new match
    FirebaseRealtimeService.registerDisconnect(nextMatchId);

    // Start next round with the new synchronized seed
    startLiveGame(seed, nextMatchId);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeaveRoom = () => {
    soundManager.stopBgm();
    if (cancelQuickSearchRef.current) {
      cancelQuickSearchRef.current().catch(() => {});
      cancelQuickSearchRef.current = null;
    }
    // Forfeit and notify opponent via Firebase
    const wasInGame = matchStatusRef.current === 'in_game';
    forfeitAndLeave();

    // sendBeacon is fire-and-forget; refresh shortly after so the rating shown
    // on this same screen reflects the loss just recorded by the server.
    if (wasInGame) {
      setTimeout(() => { refreshProfile().catch(() => {}); }, 1000);
    }

    cleanupSubscriptions();
    gameStartedRef.current = false;
    matchEndedRef.current = false;
    setRematchPlayerReady(false);
    setRematchOpponentReady(false);
    setRematchOpponentLeft(false);
    nextMatchTriggeredRef.current = false;
    setRankedMode(false);
    setMatchStatus('lobby');
    setMatchId(null);
    setRoomCode('');
    setOpponentCosmetics(null);
    setIsGameOverOpen(false);
  };

  // If user is not logged in, block access to online play completely
  if (!isAuthenticated) {
    return (
      <div style={{ width: '100%', maxWidth: '600px', textAlign: 'center', marginTop: '3rem' }}>
        <div className="panel-card" style={{ padding: '3rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{
            background: 'rgba(236, 72, 153, 0.15)',
            color: 'var(--accent-pink)',
            padding: '1.25rem',
            borderRadius: '50%',
            display: 'flex'
          }}>
            <Lock size={44} />
          </div>

          <div>
            <h1 style={{ fontSize: '2.1rem', fontWeight: 800, marginBottom: '0.4rem' }}>
              {t('Authentication Required')}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5, maxWidth: '440px', margin: '0 auto' }}>
              {t('Online 1v1 multiplayer is exclusively reserved for registered and logged-in players to ensure fair play, prevent abuse, and record official stats.')}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', width: '100%', maxWidth: '340px', marginTop: '0.75rem' }}>
            <button
              className="btn-primary"
              style={{ flex: 1, padding: '0.75rem', fontSize: '1rem', fontWeight: 700 }}
              onClick={() => onNavigate?.('login')}
            >
              {t('Log In')}
            </button>
            <button
              className="btn-secondary"
              style={{ flex: 1, padding: '0.75rem', fontSize: '1rem', fontWeight: 600 }}
              onClick={() => onNavigate?.('register')}
            >
              {t('Sign Up')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="versus-page">
      {errorMsg && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          color: 'var(--accent-red)',
          border: '1px solid var(--accent-red)',
          padding: '0.75rem 1.25rem',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1rem',
          maxWidth: '880px',
          width: '100%',
          textAlign: 'center',
          fontSize: '0.9rem'
        }}>
          {errorMsg}
        </div>
      )}

      {matchStatus === 'lobby' && (
        <div style={{ width: '100%', maxWidth: '980px', textAlign: 'center', marginTop: '1rem' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.4rem' }}>{t('Online Multiplayer')}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1rem' }}>
              {t('Real-time multiplayer. Play casual or ranked 1v1, team up against a boss, or duel in Blast.')}
            </p>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'rgba(6, 182, 212, 0.1)',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              borderRadius: '999px',
              padding: '0.4rem 1rem'
            }}>
              <Trophy size={16} color="var(--accent-cyan)" />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t('Your Rating:')}</span>
              <strong style={{ color: 'var(--accent-cyan)', fontSize: '0.95rem' }}>{user?.rating ?? 1000} ELO</strong>
            </div>
          </div>

          <section style={categorySectionStyle} aria-labelledby="online-pvp-heading">
            <div>
              <h2 id="online-pvp-heading" style={categoryTitleStyle}>
                <Users size={20} color="var(--accent-purple)" />
                {t('Player VS Player')}
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
                {t('Play online against another player.')}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.85rem' }}>
            {/* Quick Match / Quick Search Card */}
            <div className="panel-card" style={modeCardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.55rem' }}>
                <div style={{ background: 'rgba(6, 182, 212, 0.2)', color: 'var(--accent-cyan)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', display: 'flex' }}>
                  <Zap size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>{t('Quick Search')}</h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('Instant 1v1 Matchmaking')}</span>
                </div>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                {t('Jump into a casual match against another player in the Quick Search queue. Casual matches are recorded but never affect your ELO.')}
              </p>
              <button
                className="btn-primary"
                style={{
                  ...modeButtonStyle,
                  background: 'linear-gradient(135deg, #06b6d4, #a855f7)'
                }}
                onClick={() => handleQuickSearch(false)}
              >
                <Zap size={18} /> {t('Quick Play')}
              </button>
            </div>

            {/* Ranked Match Card */}
            <div className="panel-card" style={modeCardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.55rem' }}>
                <div style={{ background: 'rgba(234, 179, 8, 0.2)', color: 'var(--accent-yellow)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', display: 'flex' }}>
                  <Trophy size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>{t('Ranked Match')}</h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('Competitive ELO Matchmaking')}</span>
                </div>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                {t('Same instant matchmaking as Quick Search, but every win or loss updates your ELO rating.')}
              </p>
              <button
                className="btn-primary"
                style={{
                  ...modeButtonStyle,
                  background: 'linear-gradient(135deg, #eab308, #f97316)'
                }}
                onClick={() => handleQuickSearch(true)}
              >
                <Trophy size={18} /> {t('Find Ranked Match')}
              </button>
            </div>

            {/* Create Room Card */}
            <div className="panel-card" style={modeCardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.55rem' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-green)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', display: 'flex' }}>
                  <Plus size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>{t('Create Private Room')}</h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('Generate 6-letter room code')}</span>
                </div>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
{t('Host a casual private match and share the code with a friend. The game waits until your friend joins before starting. Does not affect ELO.')}
              </p>
              <button className="btn-secondary" style={modeButtonStyle} onClick={handleCreateRoom}>
                <Plus size={18} /> {t('Host Room')}
              </button>
            </div>

            {/* Join Room Card */}
            <div className="panel-card" style={modeCardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.55rem' }}>
                <div style={{ background: 'rgba(59, 130, 246, 0.2)', color: 'var(--accent-blue)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', display: 'flex' }}>
                  <LogIn size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>{t('Join with Room Code')}</h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t("Enter your friend's code")}</span>
                </div>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
{t('Enter the 6-letter code generated by the host to join their casual room immediately. Does not affect ELO.')}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', width: '100%', marginTop: 'auto' }}>
                <input
                  type="text"
                  placeholder={t('CODE')}
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    width: '100%',
                    padding: '0.55rem 0.6rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    textAlign: 'center',
                    letterSpacing: '0.15em'
                  }}
                  maxLength={6}
                />
                <button className="btn-secondary" style={{ padding: '0.55rem 1rem', whiteSpace: 'nowrap', fontWeight: 600, fontSize: '0.85rem' }} onClick={handleJoinRoom}>
                  {t('Join')}
                </button>
              </div>
              </div>
            </div>
          </section>

          <section style={{ ...categorySectionStyle, marginTop: '1.25rem' }} aria-labelledby="coop-boss-heading">
            <div>
              <h2 id="coop-boss-heading" style={categoryTitleStyle}>
                <Skull size={20} color="var(--accent-red)" />
                {t('Co-op Boss Battle')}
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
                {t('Team up with another player to defeat the boss.')}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.85rem' }}>
              <div className="panel-card" style={modeCardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.55rem' }}>
                  <div style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--accent-red)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', display: 'flex' }}>
                    <Users size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>{t('Co-op Quick Search')}</h3>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('Find a teammate')}</span>
                  </div>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                  {t('Team up with another player and fight the boss together.')}
                </p>
                <button className="btn-primary" style={modeButtonStyle} onClick={() => onStartCoop?.('quick')}>
                  <Users size={18} /> {t('Team Quick Play')}
                </button>
              </div>

              <div className="panel-card" style={modeCardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.55rem' }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-green)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', display: 'flex' }}>
                    <Plus size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>{t('Create Co-op Room')}</h3>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('Generate 6-letter room code')}</span>
                  </div>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                  {t('Host a co-op boss room and share the code with a friend.')}
                </p>
                <button className="btn-secondary" style={modeButtonStyle} onClick={() => onStartCoop?.('create')}>
                  <Plus size={18} /> {t('Host Co-op Room')}
                </button>
              </div>

              <div className="panel-card" style={modeCardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.55rem' }}>
                  <div style={{ background: 'rgba(59, 130, 246, 0.2)', color: 'var(--accent-blue)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', display: 'flex' }}>
                    <LogIn size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>{t('Join Co-op Room')}</h3>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t("Enter your friend's code")}</span>
                  </div>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                  {t('Enter the 6-letter co-op room code to join the fight immediately.')}
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', width: '100%', marginTop: 'auto' }}>
                  <input
                    type="text"
                    placeholder={t('CODE')}
                    value={coopInputCode}
                    onChange={(e) => setCoopInputCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && coopInputCode.trim()) onStartCoop?.('join', coopInputCode.trim());
                    }}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      width: '100%',
                      padding: '0.55rem 0.6rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      textAlign: 'center',
                      letterSpacing: '0.15em'
                    }}
                    maxLength={6}
                  />
                  <button
                    className="btn-secondary"
                    style={{ padding: '0.55rem 1rem', whiteSpace: 'nowrap', fontWeight: 600, fontSize: '0.85rem' }}
                    onClick={() => coopInputCode.trim() && onStartCoop?.('join', coopInputCode.trim())}
                  >
                    {t('Join')}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section style={{ ...categorySectionStyle, marginTop: '1.25rem' }} aria-labelledby="blast-heading">
            <div>
              <h2 id="blast-heading" style={categoryTitleStyle}>
                <Bomb size={20} color="var(--accent-orange)" />
                {t('Blast Battle')}
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
                {t('Duel another player in Blast to three round wins. Empty your board or make your opponent top out to win.')}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.85rem' }}>
              <div className="panel-card" style={modeCardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.55rem' }}>
                  <div style={{ background: 'rgba(249, 115, 22, 0.2)', color: 'var(--accent-orange)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', display: 'flex' }}>
                    <Search size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>{t('Blast Quick Search')}</h3>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('Find an opponent')}</span>
                  </div>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                  {t('Duel another player in Tetris Blast: bombs, chain reactions and garbage. First to 3 rounds wins.')}
                </p>
                <button className="btn-primary" style={modeButtonStyle} onClick={() => onStartBlast?.('quick')}>
                  <Bomb size={18} /> {t('Blast Quick Play')}
                </button>
              </div>

              <div className="panel-card" style={modeCardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.55rem' }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-green)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', display: 'flex' }}>
                    <Plus size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>{t('Create Blast Room')}</h3>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('Generate 6-letter room code')}</span>
                  </div>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                  {t('Host a Blast duel and share the code with a friend.')}
                </p>
                <button className="btn-secondary" style={modeButtonStyle} onClick={() => onStartBlast?.('create')}>
                  <Plus size={18} /> {t('Host Blast Room')}
                </button>
              </div>

              <div className="panel-card" style={modeCardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.55rem' }}>
                  <div style={{ background: 'rgba(59, 130, 246, 0.2)', color: 'var(--accent-blue)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', display: 'flex' }}>
                    <LogIn size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>{t('Join Blast Room')}</h3>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t("Enter your friend's code")}</span>
                  </div>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                  {t('Enter the 6-letter Blast room code to join the duel.')}
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', width: '100%', marginTop: 'auto' }}>
                  <input
                    type="text"
                    placeholder={t('CODE')}
                    value={blastInputCode}
                    onChange={(e) => setBlastInputCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && blastInputCode.trim()) onStartBlast?.('join', blastInputCode.trim());
                    }}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      width: '100%',
                      padding: '0.55rem 0.6rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      textAlign: 'center',
                      letterSpacing: '0.15em'
                    }}
                    maxLength={6}
                  />
                  <button
                    className="btn-secondary"
                    style={{ padding: '0.55rem 1rem', whiteSpace: 'nowrap', fontWeight: 600, fontSize: '0.85rem' }}
                    onClick={() => blastInputCode.trim() && onStartBlast?.('join', blastInputCode.trim())}
                  >
                    {t('Join')}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Quick Search Waiting Screen */}
      {matchStatus === 'quick_searching' && (
        <div style={{
          width: '100%',
          maxWidth: '560px',
          textAlign: 'center',
          marginTop: '3rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.5rem'
        }}>
          <div className="panel-card" style={{ padding: '2.5rem', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '84px',
              height: '84px',
              borderRadius: '50%',
              background: 'rgba(6, 182, 212, 0.15)',
              border: '2px solid rgba(6, 182, 212, 0.4)',
              color: 'var(--accent-cyan)'
            }}>
              <Search size={38} />
            </div>

            <div>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.4rem' }}>
                {isRankedMatch ? t('Searching for Ranked Opponent...') : t('Searching for Opponent...')}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {isRankedMatch
                  ? t('Looking for another player in the Ranked queue. ELO is on the line!')
                  : t('Looking for another player in the casual Quick Match queue. The match will launch automatically!')}
              </p>
              <div style={{
                marginTop: '1rem',
                fontFamily: 'monospace',
                fontSize: '1.35rem',
                fontWeight: 800,
                color: 'var(--accent-cyan)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'var(--bg-tertiary)',
                padding: '0.35rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)'
              }}>
                <Loader2 size={18} className="spin-icon" style={{ animation: 'spin 1.5s linear infinite' }} />
                <span>{Math.floor(quickSearchSeconds / 60)}:{(quickSearchSeconds % 60 < 10 ? '0' : '') + (quickSearchSeconds % 60)}</span>
              </div>
            </div>

            <button
              className="btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.75rem',
                fontSize: '0.95rem',
                fontWeight: 600,
                color: 'var(--accent-red)',
                borderColor: 'rgba(239, 68, 68, 0.4)'
              }}
              onClick={handleCancelQuickSearch}
            >
              <X size={18} /> {t('Cancel Search')}
            </button>
          </div>
        </div>
      )}

      {/* Waiting Lobby Screen */}
      {matchStatus === 'waiting' && (
        <div style={{
          width: '100%',
          maxWidth: '560px',
          textAlign: 'center',
          marginTop: '3rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.5rem'
        }}>
          <div className="panel-card" style={{ padding: '2.5rem', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{
              background: 'rgba(234, 179, 8, 0.15)',
              color: 'var(--accent-yellow)',
              padding: '1rem',
              borderRadius: '50%',
              display: 'flex'
            }}>
              <Users size={36} />
            </div>

            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.3rem' }}>{t('Waiting for Opponent...')}</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {t('Share this room code with your friend. The game will automatically start when they join!')}
              </p>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              background: 'var(--bg-tertiary)',
              padding: '0.75rem 1.5rem',
              borderRadius: 'var(--radius-md)',
              border: '2px dashed var(--accent-cyan)'
            }}>
              <span style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '0.2em', color: 'var(--accent-cyan)' }}>
                {roomCode}
              </span>
              <button className="icon-btn" onClick={copyCode} title={t('Copy Code')} style={{ padding: '0.5rem' }}>
                {copied ? <Check size={20} color="var(--accent-green)" /> : <Copy size={20} />}
              </button>
            </div>

            {copied && (
              <span style={{ color: 'var(--accent-green)', fontSize: '0.85rem', fontWeight: 600 }}>
                {t('Code copied to clipboard!')}
              </span>
            )}

            <button className="btn-secondary" style={{ marginTop: '0.5rem' }} onClick={handleLeaveRoom}>
              {t('Cancel & Back to Lobby')}
            </button>
          </div>
        </div>
      )}

      {/* Live In-Game Screen */}
      {(matchStatus === 'in_game' || matchStatus === 'finished') && (
        <div className="versus-page">
          {/* Room Banner */}
          <div className="versus-toolbar">
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('Room Code:')} </span>
              <strong style={{ fontSize: '1.1rem', letterSpacing: '0.1em', color: 'var(--accent-cyan)' }}>{roomCode}</strong>
            </div>

            <button className="icon-btn" onClick={copyCode} title={t('Copy Code')}>
              {copied ? <Check size={16} color="var(--accent-green)" /> : <Copy size={16} />}
            </button>

            <div style={{
              background: isRankedMatch ? 'rgba(234, 179, 8, 0.2)' : 'rgba(16, 185, 129, 0.2)',
              color: isRankedMatch ? 'var(--accent-yellow)' : 'var(--accent-green)',
              padding: '0.2rem 0.6rem',
              borderRadius: '4px',
              fontWeight: 800,
              fontSize: '0.8rem'
            }}>
              {isRankedMatch ? t('RANKED MATCH') : t('CASUAL MATCH')}
            </div>

            <button className="btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }} onClick={handleLeaveRoom}>
              {t('Leave Room')}
            </button>
          </div>

          {/* Dual Playfield View */}
          <VersusArena
            arenaRef={arenaRef}
            cellSize={cellSize}
            vsTone="green"
            player={{
              label: (
                <>
                  <UserName displayName={user?.display_name || t('Player 1')} cosmetics={user?.cosmetics} size="0.95rem" />
                  <span className="versus-elo-badge">{playerRating} ELO</span>
                </>
              ),
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
              label: (
                <>
                  <UserName displayName={opponentName} cosmetics={opponentCosmetics} size="0.95rem" />
                  <span className="versus-elo-badge">{opponentRating} ELO</span>
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
              garbage: opponentGarbage
            }}
            isCountingDown={isCountingDown}
            onCountdownComplete={handleCountdownComplete}
          />

          {/* Result Modal */}
          <GameOverModal
            isOpen={isGameOverOpen}
            isVictory={matchResult === 'win'}
            customMessage={winReason || undefined}
            mode="online_1v1"
            stats={playerEngine.getStats()}
            onRestart={handleRequestPlayAgain}
            onExit={handleLeaveRoom}
            rematchPlayerReady={rematchPlayerReady}
            rematchOpponentReady={rematchOpponentReady}
            rematchOpponentLeft={rematchOpponentLeft}
            eloChange={eloResult}
          />
        </div>
      )}
    </div>
  );
};
