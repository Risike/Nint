import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/engine/gameEngine';
import { KeyboardManager } from '../game/input/keyboardManager';
import { GamepadManager } from '../game/input/gamepadManager';
import { soundManager } from '../game/audio/soundManager';
import { PlayfieldCanvas } from '../components/game/PlayfieldCanvas';
import { HoldDisplay } from '../components/game/HoldDisplay';
import { QueueDisplay } from '../components/game/QueueDisplay';
import { TouchControls } from '../components/game/TouchControls';
import { GameOverModal } from '../components/game/GameOverModal';
import { CountdownOverlay } from '../components/game/CountdownOverlay';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { FirebaseRealtimeService } from '../services/firebaseRealtime';
import { ApiClient } from '../services/api';
import { Globe, Users, Plus, LogIn, Copy, Check, RotateCcw, Zap } from 'lucide-react';

export const OnlineVersusPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const { settings } = useSettings();

  const [matchId, setMatchId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string>('');
  const [inputCode, setInputCode] = useState<string>('');
  const [matchStatus, setMatchStatus] = useState<'lobby' | 'waiting' | 'in_game' | 'finished'>('lobby');
  const [isCountingDown, setIsCountingDown] = useState<boolean>(false);

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

  const keyboardRef = useRef<KeyboardManager | null>(null);
  const gamepadRef = useRef<GamepadManager | null>(null);
  const unsubscribeAttacksRef = useRef<(() => void) | null>(null);

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleCreateRoom = async () => {
    const code = generateRoomCode();
    setRoomCode(code);
    setMatchStatus('waiting');

    try {
      const displayName = user?.display_name || 'Player 1';
      await FirebaseRealtimeService.authenticate(displayName);
      const mId = await FirebaseRealtimeService.createRoom(code, displayName);
      setMatchId(mId);
      setupGame(12345, mId);
    } catch (e) {
      console.warn('Failed to create room:', e);
    }
  };

  const handleJoinRoom = async () => {
    if (!inputCode.trim()) return;
    const code = inputCode.trim().toUpperCase();
    setRoomCode(code);

    try {
      const displayName = user?.display_name || 'Player 2';
      await FirebaseRealtimeService.authenticate(displayName);
      const { matchId: mId, seed } = await FirebaseRealtimeService.joinRoom(code, displayName);
      setMatchId(mId);
      setMatchStatus('in_game');
      setupGame(seed, mId);
    } catch (e: any) {
      alert(e.message || 'Failed to join room');
    }
  };

  const setupGame = (seed: number, currentMatchId: string) => {
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

    // Attacks hook to Firebase Realtime Database
    pEngine.events.onGarbageSent = (amount) => {
      soundManager.playGarbageSent();
      FirebaseRealtimeService.sendAttack(currentMatchId, amount);
      oEngine.garbageManager.enqueueGarbage(amount);
      setOpponentGarbage(oEngine.garbageManager.getPendingCount());
    };

    pEngine.events.onPieceMove = () => soundManager.playMove();
    pEngine.events.onPieceRotate = () => soundManager.playRotate();
    pEngine.events.onPieceLock = () => {
      soundManager.playLock();
      setPlayerGarbage(pEngine.garbageManager.getPendingCount());
      FirebaseRealtimeService.updateState(currentMatchId, {
        score: pEngine.score,
        lines: pEngine.lines,
        alive: true
      });
    };
    pEngine.events.onLineClear = (res) => {
      soundManager.playClear(res.linesCleared);
      if (res.comboCount > 0) soundManager.playCombo(res.comboCount);
      setPlayerGarbage(pEngine.garbageManager.getPendingCount());
    };

    // End match detection
    pEngine.events.onGameOver = () => handleEndMatch('loss');
    oEngine.events.onGameOver = () => handleEndMatch('win');

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

    if (keyboardRef.current) keyboardRef.current.detach();
    const km = new KeyboardManager(pEngine, settings.keybindings);
    km.attach();
    keyboardRef.current = km;

    gamepadRef.current = new GamepadManager(pEngine);

    pEngine.spawnPiece();
    oEngine.spawnPiece();

    setPlayerQueue([...pEngine.randomizer.peek(5)]);
    setOpponentQueue([...oEngine.randomizer.peek(5)]);

    // Start 3-second countdown
    setIsCountingDown(true);
  };

  const handleCountdownComplete = () => {
    setIsCountingDown(false);
    playerEngine.state = 'playing';
    playerEngine.startTime = Date.now();
    opponentEngine.state = 'playing';
    opponentEngine.startTime = Date.now();
  };

  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const delta = time - lastTime;
      lastTime = time;

      if (!isCountingDown && (matchStatus === 'in_game' || matchStatus === 'waiting')) {
        if (playerEngine.state === 'playing') {
          playerEngine.update(delta);
          keyboardRef.current?.update(delta);
          gamepadRef.current?.update(delta);
          setPlayerHold(playerEngine.holdPiece);
          setPlayerQueue([...playerEngine.randomizer.peek(5)]);
          setPlayerGarbage(playerEngine.garbageManager.getPendingCount());
        }

        if (opponentEngine.state === 'playing') {
          opponentEngine.update(delta);
          setOpponentHold(opponentEngine.holdPiece);
          setOpponentQueue([...opponentEngine.randomizer.peek(5)]);
          setOpponentGarbage(opponentEngine.garbageManager.getPendingCount());
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [playerEngine, opponentEngine, matchStatus, isCountingDown]);

  const handleEndMatch = async (result: 'win' | 'loss') => {
    setMatchResult(result);
    setMatchStatus('finished');
    setIsGameOverOpen(true);

    if (result === 'win') {
      soundManager.playClear(4);
    } else {
      soundManager.playGameOver();
    }

    if (isAuthenticated) {
      try {
        await ApiClient.recordMatch({
          opponentName: 'Online Opponent',
          opponentType: 'human',
          result,
          playerScore: playerEngine.score,
          playerLines: playerEngine.lines,
          duration: playerEngine.totalPlayTimeMs
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      {matchStatus === 'lobby' && (
        <div style={{ width: '100%', maxWidth: '880px', textAlign: 'center', marginTop: '1rem' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.4rem' }}>Online 1v1 Arena</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Real-time competitive multiplayer. Create a private room or enter a code to join. Matches start with a 3-second countdown.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.25rem',
            textAlign: 'left'
          }}>
            {/* Create Room Card */}
            <div className="panel-card" style={{ padding: '1.75rem', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-green)', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}>
                  <Plus size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Create Private Room</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Generate 6-letter room code</span>
                </div>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Host a private match and share the code with a friend. Both players start synchronously with identical seeds.
              </p>
              <button className="btn-primary" style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} onClick={handleCreateRoom}>
                <Plus size={18} /> Host Room
              </button>
            </div>

            {/* Join Room Card */}
            <div className="panel-card" style={{ padding: '1.75rem', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ background: 'rgba(59, 130, 246, 0.2)', color: 'var(--accent-blue)', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}>
                  <LogIn size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Join with Room Code</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Enter your friend's code</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="ROOM CODE"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  style={{
                    flex: 1,
                    padding: '0.7rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    fontWeight: 700,
                    textAlign: 'center',
                    letterSpacing: '0.1em'
                  }}
                  maxLength={6}
                />
                <button className="btn-secondary" style={{ padding: '0.7rem 1.25rem' }} onClick={handleJoinRoom}>
                  Join
                </button>
              </div>
            </div>

            {/* Quick Match Card */}
            <div className="panel-card" style={{ padding: '1.75rem', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ background: 'rgba(234, 179, 8, 0.2)', color: 'var(--accent-yellow)', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}>
                  <Zap size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Quick Matchmaking</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Auto Match</span>
                </div>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Instant peer matchup. Jump straight into an active match or auto-host for the next available challenger.
              </p>
              <button className="btn-primary" style={{ marginTop: 'auto', background: 'linear-gradient(135deg, var(--accent-yellow), var(--accent-orange))', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} onClick={handleCreateRoom}>
                <Zap size={18} /> Quick Match
              </button>
            </div>
          </div>
        </div>
      )}

      {(matchStatus === 'waiting' || matchStatus === 'in_game' || matchStatus === 'finished') && (
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
              background: matchStatus === 'waiting' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(16, 185, 129, 0.2)',
              color: matchStatus === 'waiting' ? 'var(--accent-yellow)' : 'var(--accent-green)',
              padding: '0.2rem 0.6rem',
              borderRadius: '4px',
              fontWeight: 800,
              fontSize: '0.8rem'
            }}>
              {matchStatus === 'waiting' ? 'Waiting for Player 2...' : 'MATCH IN PROGRESS'}
            </div>

            <button className="btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }} onClick={() => setMatchStatus('lobby')}>
              Leave Room
            </button>
          </div>

          {/* Dual Playfield View */}
          <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'flex-start' }}>
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
                  <PlayfieldCanvas engine={playerEngine} incomingGarbage={playerGarbage} cellSize={24} />
                  <CountdownOverlay active={isCountingDown} onComplete={handleCountdownComplete} />
                </div>

                <div className="side-panel" style={{ minWidth: '70px' }}>
                  <QueueDisplay queue={playerQueue} count={3} />
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
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                Opponent
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div className="side-panel" style={{ minWidth: '80px' }}>
                  <HoldDisplay piece={opponentHold} canHold={opponentEngine.canHold} />
                  <div className="panel-card" style={{ padding: '0.5rem' }}>
                    <div className="stat-label">Lines</div>
                    <div className="stat-value" style={{ fontSize: '1.2rem' }}>{opponentEngine.lines}</div>
                  </div>
                </div>

                <PlayfieldCanvas engine={opponentEngine} incomingGarbage={opponentGarbage} cellSize={24} />

                <div className="side-panel" style={{ minWidth: '70px' }}>
                  <QueueDisplay queue={opponentQueue} count={3} />
                </div>
              </div>
            </div>
          </div>

          {/* Mobile controls */}
          {settings.touchControlsEnabled && <TouchControls engine={playerEngine} />}

          {/* Result Modal */}
          <GameOverModal
            isOpen={isGameOverOpen}
            isVictory={matchResult === 'win'}
            mode="online_1v1"
            stats={playerEngine.getStats()}
            onRestart={() => setupGame(Date.now(), matchId || 'rematch')}
            onExit={() => {
              setIsGameOverOpen(false);
              setMatchStatus('lobby');
            }}
          />
        </div>
      )}
    </div>
  );
};
