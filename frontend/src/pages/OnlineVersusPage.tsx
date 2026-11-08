import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/engine/gameEngine';
import { KeyboardManager } from '../game/input/keyboardManager';
import { GamepadManager } from '../game/input/gamepadManager';
import { soundManager } from '../game/audio/soundManager';
import { PlayfieldCanvas } from '../components/game/PlayfieldCanvas';
import { HoldDisplay } from '../components/game/HoldDisplay';
import { QueueDisplay } from '../components/game/QueueDisplay';
import { GameOverModal } from '../components/game/GameOverModal';
import { CountdownOverlay } from '../components/game/CountdownOverlay';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { FirebaseRealtimeService, RemotePlayerState } from '../services/firebaseRealtime';
import { ApiClient } from '../services/api';
import { useDynamicCellSize } from '../hooks/useDynamicCellSize';
import { useGamepadActive, useGamepadBack } from '../context/GamepadNavContext';
import { Users, Plus, LogIn, Copy, Check } from 'lucide-react';

export const OnlineVersusPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const { settings } = useSettings();
  const cellSize = useDynamicCellSize(true);

  const [matchId, setMatchId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string>('');
  const [inputCode, setInputCode] = useState<string>('');
  const [matchStatus, setMatchStatus] = useState<'lobby' | 'waiting' | 'in_game' | 'finished'>('lobby');
  const [isCountingDown, setIsCountingDown] = useState<boolean>(false);
  const [opponentName, setOpponentName] = useState<string>('Opponent');

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

  const isPlaying = matchStatus === 'in_game' && !isGameOverOpen && (playerEngine.state === 'playing' || isCountingDown);
  useGamepadActive(isPlaying);

  useGamepadBack(() => {
    if (isGameOverOpen) {
      setIsGameOverOpen(false);
      handleLeaveRoom();
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
  const unsubscribeAttacksRef = useRef<(() => void) | null>(null);
  const unsubscribeOpponentRef = useRef<(() => void) | null>(null);
  const unsubscribeMatchRef = useRef<(() => void) | null>(null);
  const gameStartedRef = useRef<boolean>(false);
  const lastSyncTimeRef = useRef<number>(0);
  const matchEndedRef = useRef<boolean>(false);
  const currentOpponentNameRef = useRef<string>('Online Opponent');
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
      FirebaseRealtimeService.leaveRoom(code, mId);
    }

    // Record defeat if in an active game
    if (status === 'in_game' && isAuthenticatedRef.current) {
      const stats = playerEngineRef.current.getStats();
      ApiClient.sendBeaconRecordMatch({
        opponentName: currentOpponentNameRef.current,
        opponentType: 'human',
        result: 'loss',
        playerScore: playerEngineRef.current.score,
        playerLines: playerEngineRef.current.lines,
        duration: playerEngineRef.current.totalPlayTimeMs,
        piecesPlaced: stats.piecesPlaced || 0,
        tetrises: stats.tetrises || 0,
        tSpins: stats.tSpins || 0,
        perfectClears: stats.perfectClears || 0,
        maxCombo: stats.maxCombo || 0,
        maxB2B: stats.maxB2B || 0
      });
    }
  };

  // Handle window unload / closing tab / browser close while match is in progress
  useEffect(() => {
    const handleBeforeUnload = () => {
      forfeitAndLeave();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Handle component unmount (user navigates to another page/tab in the app)
  useEffect(() => {
    return () => {
      soundManager.stopBgm();
      forfeitAndLeave();
      cleanupSubscriptions();
    };
  }, []);

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

    const code = generateRoomCode();
    setRoomCode(code);
    setMatchStatus('waiting');

    try {
      const displayName = user?.display_name || 'Player 1';
      await FirebaseRealtimeService.authenticate(displayName);
      const { matchId: mId, seed } = await FirebaseRealtimeService.createRoom(code, displayName);
      setMatchId(mId);

      // Listen strictly once for when status becomes 'active'
      unsubscribeMatchRef.current = FirebaseRealtimeService.listenToMatchStart(mId, (matchData) => {
        if (gameStartedRef.current) return;
        gameStartedRef.current = true;

        // Unsubscribe from match start listener to prevent any repeated calls
        if (unsubscribeMatchRef.current) {
          unsubscribeMatchRef.current();
          unsubscribeMatchRef.current = null;
        }

        // Find opponent name
        const myUid = FirebaseRealtimeService.getUid();
        if (matchData.players) {
          for (const [uid, p] of Object.entries<any>(matchData.players)) {
            if (uid !== myUid) {
              setOpponentName(p.displayName || 'Player 2');
              break;
            }
          }
        }

        startLiveGame(seed, mId);
      });
    } catch (e: any) {
      console.warn('Failed to create room:', e);
      setErrorMsg(e.message || 'Failed to create room on Firebase');
      setMatchStatus('lobby');
    }
  };

  // Guest enters room code to join
  const handleJoinRoom = async () => {
    if (!inputCode.trim()) return;
    setErrorMsg(null);
    cleanupSubscriptions();
    gameStartedRef.current = false;

    const code = inputCode.trim().toUpperCase();
    setRoomCode(code);

    try {
      const displayName = user?.display_name || 'Player 2';
      await FirebaseRealtimeService.authenticate(displayName);
      const { matchId: mId, seed } = await FirebaseRealtimeService.joinRoom(code, displayName);
      setMatchId(mId);
      setOpponentName('Host');

      gameStartedRef.current = true;
      startLiveGame(seed, mId);
    } catch (e: any) {
      console.warn('Failed to join room:', e);
      setErrorMsg(e.message || 'Failed to join room. Verify the code.');
    }
  };

  const startLiveGame = (seed: number, currentMatchId: string) => {
    setMatchStatus('in_game');
    matchEndedRef.current = false;

    const pEngine = new GameEngine({
      seed,
      das: settings.das,
      arr: settings.arr,
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
        currentOpponentNameRef.current = opponentState.displayName;
      }
      if (opponentState.connected === false) {
        // Opponent left or disconnected -> player wins by forfeit!
        handleEndMatch('win', pEngine, 'Opponent disconnected');
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
    });

    if (keyboardRef.current) keyboardRef.current.detach();
    const km = new KeyboardManager(pEngine, settings.keybindings);
    km.attach();
    keyboardRef.current = km;

    gamepadRef.current = new GamepadManager(pEngine);

    // Before countdown: show exact upcoming pieces with the 1st falling piece on top
    pEngine.activePiece = null;
    setPlayerQueue([...pEngine.randomizer.peek(5)]);

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
      queue: [...engine.randomizer.peek(5)],
      clearingRows: [...engine.clearingRows]
    });
  };

  const handleCountdownComplete = () => {
    setIsCountingDown(false);
    playerEngine.state = 'playing';
    playerEngine.startTime = Date.now();
    playerEngine.spawnPiece();
    setPlayerQueue([...playerEngine.randomizer.peek(5)]);
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
          setPlayerQueue([...playerEngine.randomizer.peek(5)]);
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

    if (result === 'win') {
      soundManager.playClear(4);
    } else {
      soundManager.playGameOver();
    }

    if (isAuthenticated) {
      try {
        const stats = engine.getStats();
        await ApiClient.recordMatch({
          opponentName,
          opponentType: 'human',
          result,
          playerScore: engine.score,
          playerLines: engine.lines,
          duration: Math.round(engine.totalPlayTimeMs),
          piecesPlaced: stats.piecesPlaced || 0,
          tetrises: stats.tetrises || 0,
          tSpins: stats.tSpins || 0,
          perfectClears: stats.perfectClears || 0,
          maxCombo: stats.maxCombo || 0,
          maxB2B: stats.maxB2B || 0
        });
      } catch (e) {
        console.warn('Failed to record online match:', e);
      }
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeaveRoom = () => {
    soundManager.stopBgm();
    // Forfeit and notify opponent via Firebase
    forfeitAndLeave();

    cleanupSubscriptions();
    gameStartedRef.current = false;
    matchEndedRef.current = false;
    setMatchStatus('lobby');
    setMatchId(null);
    setRoomCode('');
    setIsGameOverOpen(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
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
        <div style={{ width: '100%', maxWidth: '880px', textAlign: 'center', marginTop: '1rem' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.4rem' }}>Online Player vs Player</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Real-time competitive multiplayer. Create a private room and share your code, or enter a code to join.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.25rem',
            textAlign: 'left'
          }}>
            {/* Create Room Card */}
            <div className="panel-card" style={{ padding: '1.75rem', gap: '1rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-green)', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}>
                  <Plus size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Create Private Room</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Generate 6-letter room code</span>
                </div>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                Host a private match and share the code with a friend. The game waits until your friend joins before starting.
              </p>
              <button className="btn-primary" style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} onClick={handleCreateRoom}>
                <Plus size={18} /> Host Room
              </button>
            </div>

            {/* Join Room Card */}
            <div className="panel-card" style={{ padding: '1.75rem', gap: '1rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ background: 'rgba(59, 130, 246, 0.2)', color: 'var(--accent-blue)', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}>
                  <LogIn size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Join with Room Code</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Enter your friend's code</span>
                </div>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                Enter the 6-letter code generated by the host to join their room immediately.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', width: '100%', marginTop: 'auto' }}>
                <input
                  type="text"
                  placeholder="CODE"
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
                  Join
                </button>
              </div>
            </div>
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
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.3rem' }}>Waiting for Opponent...</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Share this room code with your friend. The game will automatically start when they join!
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
              <button className="icon-btn" onClick={copyCode} title="Copy Code" style={{ padding: '0.5rem' }}>
                {copied ? <Check size={20} color="var(--accent-green)" /> : <Copy size={20} />}
              </button>
            </div>

            {copied && (
              <span style={{ color: 'var(--accent-green)', fontSize: '0.85rem', fontWeight: 600 }}>
                Code copied to clipboard!
              </span>
            )}

            <button className="btn-secondary" style={{ marginTop: '0.5rem' }} onClick={handleLeaveRoom}>
              Cancel & Back to Lobby
            </button>
          </div>
        </div>
      )}

      {/* Live In-Game Screen */}
      {(matchStatus === 'in_game' || matchStatus === 'finished') && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          {/* Room Banner */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            marginBottom: '1rem',
            background: 'var(--bg-secondary)',
            padding: '0.6rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            flexWrap: 'wrap',
            justifyContent: 'center'
          }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Room Code: </span>
              <strong style={{ fontSize: '1.1rem', letterSpacing: '0.1em', color: 'var(--accent-cyan)' }}>{roomCode}</strong>
            </div>

            <button className="icon-btn" onClick={copyCode} title="Copy Code">
              {copied ? <Check size={16} color="var(--accent-green)" /> : <Copy size={16} />}
            </button>

            <div style={{
              background: 'rgba(16, 185, 129, 0.2)',
              color: 'var(--accent-green)',
              padding: '0.2rem 0.6rem',
              borderRadius: '4px',
              fontWeight: 800,
              fontSize: '0.8rem'
            }}>
              MATCH IN PROGRESS
            </div>

            <button className="btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }} onClick={handleLeaveRoom}>
              Leave Room
            </button>
          </div>

          {/* Dual Playfield View */}
          <div style={{ display: 'flex', gap: '1.25rem', justifyContent: 'center', flexWrap: 'nowrap', alignItems: 'flex-start', maxWidth: '100%', overflowX: 'auto', padding: '0 0.5rem' }}>
            {/* Player Side */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                You ({user?.display_name || 'Player 1'})
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div className="side-panel" style={{ minWidth: '80px' }}>
                  <HoldDisplay piece={playerHold} canHold={playerEngine.canHold} />
                  <div className="panel-card" style={{ padding: '0.5rem' }}>
                    <div className="stat-label">Lines</div>
                    <div className="stat-value" style={{ fontSize: '1.2rem' }}>{playerEngine.lines}</div>
                  </div>
                </div>

                <div style={{ position: 'relative' }}>
                  <PlayfieldCanvas engine={playerEngine} incomingGarbage={playerGarbage} cellSize={cellSize} />
                  <CountdownOverlay active={isCountingDown} onComplete={handleCountdownComplete} />
                </div>

                <div className="side-panel" style={{ minWidth: '70px' }}>
                  <QueueDisplay queue={playerQueue} count={5} />
                </div>
              </div>
            </div>

            {/* VS Divider Badge */}
            <div style={{
              alignSelf: 'center',
              fontWeight: 900,
              fontSize: '1.2rem',
              color: 'var(--accent-green)',
              background: 'rgba(16, 185, 129, 0.1)',
              padding: '0.5rem 0.8rem',
              borderRadius: '999px',
              border: '1px solid rgba(16, 185, 129, 0.3)'
            }}>
              VS
            </div>

            {/* Opponent Side */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--accent-orange)' }}>
                Opponent ({opponentName})
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div className="side-panel" style={{ minWidth: '80px' }}>
                  <HoldDisplay piece={opponentHold} canHold={false} />
                  <div className="panel-card" style={{ padding: '0.5rem' }}>
                    <div className="stat-label">Lines</div>
                    <div className="stat-value" style={{ fontSize: '1.2rem' }}>{opponentEngine.lines}</div>
                  </div>
                </div>

                <PlayfieldCanvas engine={opponentEngine} incomingGarbage={opponentGarbage} cellSize={cellSize} />

                <div className="side-panel" style={{ minWidth: '70px' }}>
                  <QueueDisplay queue={opponentQueue} count={5} />
                </div>
              </div>
            </div>
          </div>

          {/* Result Modal */}
          <GameOverModal
            isOpen={isGameOverOpen}
            isVictory={matchResult === 'win'}
            customMessage={winReason || undefined}
            mode="online_1v1"
            stats={playerEngine.getStats()}
            onRestart={() => handleCreateRoom()}
            onExit={handleLeaveRoom}
          />
        </div>
      )}
    </div>
  );
};
