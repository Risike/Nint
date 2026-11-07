import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/engine/gameEngine';
import { KeyboardManager } from '../game/input/keyboardManager';
import { soundManager } from '../game/audio/soundManager';
import { PlayfieldCanvas } from '../components/game/PlayfieldCanvas';
import { HoldDisplay } from '../components/game/HoldDisplay';
import { QueueDisplay } from '../components/game/QueueDisplay';
import { TouchControls } from '../components/game/TouchControls';
import { GameOverModal } from '../components/game/GameOverModal';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { FirebaseRealtimeService } from '../services/firebaseRealtime';
import { ApiClient } from '../services/api';
import { Globe, Users, Plus, LogIn, Copy, Check, RotateCcw } from 'lucide-react';

export const OnlineVersusPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const { settings } = useSettings();

  const [matchId, setMatchId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string>('');
  const [inputCode, setInputCode] = useState<string>('');
  const [matchStatus, setMatchStatus] = useState<'lobby' | 'waiting' | 'in_game' | 'finished'>('lobby');

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

    pEngine.start();
    oEngine.start();

    setPlayerQueue([...pEngine.randomizer.peek(5)]);
    setOpponentQueue([...oEngine.randomizer.peek(5)]);
  };

  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const delta = time - lastTime;
      lastTime = time;

      if (matchStatus === 'in_game' || matchStatus === 'waiting') {
        if (playerEngine.state === 'playing') {
          playerEngine.update(delta);
          keyboardRef.current?.update(delta);
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
  }, [playerEngine, opponentEngine, matchStatus]);

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
        <div className="panel-card" style={{ maxWidth: '480px', width: '100%', padding: '2rem', gap: '1.5rem', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-green)', padding: '1rem', borderRadius: '50%' }}>
              <Globe size={40} />
            </div>
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Online 1v1 Battle</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Challenge an opponent in real-time. Both players play identical piece sequences with low-latency garbage attacks.
          </p>

          <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} onClick={handleCreateRoom}>
            <Plus size={18} /> Create Private Room
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>OR JOIN WITH CODE</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="ROOM CODE"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              style={{
                flex: 1,
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                fontWeight: 700,
                textAlign: 'center',
                letterSpacing: '0.1em'
              }}
              maxLength={6}
            />
            <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={handleJoinRoom}>
              <LogIn size={18} /> Join
            </button>
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
                You ({user?.display_name || 'Guest'})
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div className="side-panel" style={{ minWidth: '80px' }}>
                  <HoldDisplay piece={playerHold} canHold={playerEngine.canHold} />
                  <div className="panel-card" style={{ padding: '0.5rem' }}>
                    <div className="stat-label">Lines</div>
                    <div className="stat-value" style={{ fontSize: '1.2rem' }}>{playerEngine.lines}</div>
                  </div>
                </div>

                <PlayfieldCanvas engine={playerEngine} incomingGarbage={playerGarbage} cellSize={24} />

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
