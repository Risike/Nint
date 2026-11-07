import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/engine/gameEngine';
import { KeyboardManager } from '../game/input/keyboardManager';
import { GamepadManager } from '../game/input/gamepadManager';
import { soundManager } from '../game/audio/soundManager';
import { PlayfieldCanvas } from '../components/game/PlayfieldCanvas';
import { HoldDisplay } from '../components/game/HoldDisplay';
import { QueueDisplay } from '../components/game/QueueDisplay';
import { HUD } from '../components/game/HUD';
import { TouchControls } from '../components/game/TouchControls';
import { GameOverModal } from '../components/game/GameOverModal';
import { CountdownOverlay } from '../components/game/CountdownOverlay';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { ApiClient } from '../services/api';
import { LocalStorageManager } from '../services/storage';
import { Play, Pause, RotateCcw, ArrowLeft, Flame, Zap, Timer, Smile, Sliders } from 'lucide-react';

export const SoloPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const { settings } = useSettings();

  const [mode, setMode] = useState<'marathon' | 'sprint' | 'ultra' | 'zen' | 'custom'>('marathon');
  const [isSelectingMode, setIsSelectingMode] = useState<boolean>(true);
  const [isCountingDown, setIsCountingDown] = useState<boolean>(false);

  const [sprintGoal, setSprintGoal] = useState<number>(40);
  const [ultraDuration, setUltraDuration] = useState<number>(180000); // 3 mins

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

  const keyboardManagerRef = useRef<KeyboardManager | null>(null);
  const gamepadManagerRef = useRef<GamepadManager | null>(null);

  const launchSelectedMode = (selectedMode: 'marathon' | 'sprint' | 'ultra' | 'zen' | 'custom') => {
    setMode(selectedMode);
    setIsSelectingMode(false);
    initGame();
  };

  const initGame = () => {
    const newEngine = new GameEngine({
      das: settings.das,
      arr: settings.arr,
      lockDelay: settings.lockDelay
    }, {
      onPieceSpawn: () => {
        setNextQueue([...newEngine.randomizer.peek(5)]);
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
        setScore(s);
        setLines(l);
        setLevel(lvl);
      },
      onStateChange: (state) => setGameState(state),
      onGameOver: () => handleGameOver(false)
    });

    setEngine(newEngine);
    setGameState('ready');
    setScore(0);
    setLines(0);
    setLevel(1);
    setTimeMs(0);
    setCombo(-1);
    setB2B(false);
    setIsGameOverModalOpen(false);
    setIsSaved(false);

    // Prepare first piece & next queue for display
    newEngine.spawnPiece();
    setNextQueue([...newEngine.randomizer.peek(5)]);
    setHoldPiece(null);
    setCanHold(true);

    if (keyboardManagerRef.current) {
      keyboardManagerRef.current.detach();
    }

    const km = new KeyboardManager(newEngine, settings.keybindings, {
      onRestart: () => initGame(),
      onPause: () => {
        if (newEngine.state === 'playing') newEngine.pause();
        else if (newEngine.state === 'paused') newEngine.resume();
      }
    });
    km.attach();
    keyboardManagerRef.current = km;

    gamepadManagerRef.current = new GamepadManager(newEngine, {
      onRestart: () => initGame(),
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
    engine.state = 'playing';
    engine.startTime = Date.now();
    setGameState('playing');
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

          // Sprint mode victory condition
          if (mode === 'sprint' && engine.lines >= sprintGoal) {
            engine.state = 'completed';
            handleGameOver(true);
          }

          // Ultra mode timer expiration
          if (mode === 'ultra' && engine.totalPlayTimeMs >= ultraDuration) {
            engine.state = 'completed';
            handleGameOver(true);
          }

          // Marathon standard 150 lines victory
          if (mode === 'marathon' && engine.lines >= 150) {
            engine.state = 'completed';
            handleGameOver(true);
          }
        }
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [engine, mode, sprintGoal, ultraDuration, isSelectingMode, isCountingDown]);

  const handleGameOver = async (victory: boolean) => {
    setIsVictory(victory);
    setIsGameOverModalOpen(true);
    if (!victory) {
      soundManager.playGameOver();
    }

    const stats = engine.getStats();

    // Persist result
    const resultPayload = {
      mode: mode === 'sprint' ? `sprint_${sprintGoal}` : mode === 'ultra' ? 'ultra_3m' : 'marathon_150',
      score: stats.score,
      lines: stats.lines,
      level: stats.level,
      duration: stats.duration,
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
      } catch (err) {
        console.warn('Failed to save result:', err);
      }
    } else {
      const localResults = LocalStorageManager.getItem<any[]>('guest_results', []);
      localResults.unshift({ ...resultPayload, date: Date.now() });
      LocalStorageManager.setItem('guest_results', localResults.slice(0, 50));
      setIsSaved(true);
    }
  };

  const currentStats = engine.getStats();

  // Mode Selection Screen (When clicking Solo)
  if (isSelectingMode) {
    return (
      <div style={{ width: '100%', maxWidth: '880px', textAlign: 'center', marginTop: '1rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.4rem' }}>Solo Game Modes</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Choose a single-player mode to begin. Every game features a 3-second countdown before start.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1.25rem',
          textAlign: 'left'
        }}>
          {/* Marathon */}
          <div className="panel-card" style={{ padding: '1.5rem', cursor: 'pointer', transition: 'transform 0.2s' }} onClick={() => launchSelectedMode('marathon')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ background: 'rgba(6, 182, 212, 0.2)', color: 'var(--accent-cyan)', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}>
                <Flame size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Marathon</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>150 Lines Challenge</span>
              </div>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Clear 150 lines as gravity steadily speeds up every 10 lines. Push for the ultimate high score!
            </p>
          </div>

          {/* Sprint */}
          <div className="panel-card" style={{ padding: '1.5rem', cursor: 'pointer', transition: 'transform 0.2s' }} onClick={() => launchSelectedMode('sprint')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ background: 'rgba(234, 179, 8, 0.2)', color: 'var(--accent-yellow)', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}>
                <Zap size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Sprint (40 Lines)</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Speedrun Attack</span>
              </div>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Clear 40 lines as fast as humanly possible. Test your speed, execution, and personal best time.
            </p>
          </div>

          {/* Ultra */}
          <div className="panel-card" style={{ padding: '1.5rem', cursor: 'pointer', transition: 'transform 0.2s' }} onClick={() => launchSelectedMode('ultra')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ background: 'rgba(236, 72, 153, 0.2)', color: 'var(--accent-pink)', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}>
                <Timer size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Ultra</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>3 Minutes Score Attack</span>
              </div>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Score as many points as possible before the 3-minute timer expires. Maximize B2B chains and T-Spins.
            </p>
          </div>

          {/* Zen */}
          <div className="panel-card" style={{ padding: '1.5rem', cursor: 'pointer', transition: 'transform 0.2s' }} onClick={() => launchSelectedMode('zen')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ background: 'rgba(168, 85, 247, 0.2)', color: 'var(--accent-purple)', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}>
                <Smile size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Zen Mode</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Endless Practice</span>
              </div>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              No time pressure and fixed gentle gravity. Perfect for warming up or practicing downstacking.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Active Game Screen
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      {/* Top Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem' }} onClick={() => setIsSelectingMode(true)}>
          <ArrowLeft size={16} /> Mode Menu
        </button>
        <div style={{
          background: 'var(--bg-tertiary)',
          padding: '0.4rem 0.8rem',
          borderRadius: 'var(--radius-sm)',
          fontWeight: 700,
          fontSize: '0.85rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          Mode: {mode} {mode === 'sprint' ? `(${sprintGoal}L)` : mode === 'ultra' ? '(3m)' : ''}
        </div>
      </div>

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
            pps={currentStats.pps}
            apm={currentStats.apm}
          />
        </div>

        {/* Center: Playfield */}
        <div style={{ position: 'relative' }}>
          <PlayfieldCanvas engine={engine} cellSize={28} />

          {/* 3-Second Countdown Overlay */}
          <CountdownOverlay active={isCountingDown} onComplete={handleCountdownComplete} />

          {/* Pause overlay */}
          {gameState === 'paused' && (
            <div className="overlay-backdrop" style={{ position: 'absolute', borderRadius: 'var(--radius-md)' }}>
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '1rem' }}>PAUSED</h2>
                <button className="btn-primary" onClick={() => engine.resume()}>
                  <Play size={18} /> Resume
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Next Queue & Actions */}
        <div className="side-panel">
          <QueueDisplay queue={nextQueue} count={5} />
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
              <span>{gameState === 'paused' ? 'Resume' : 'Pause'}</span>
            </button>
            <button
              className="btn-secondary"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.5rem' }}
              onClick={initGame}
            >
              <RotateCcw size={16} />
              <span>Restart</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Touch Controls */}
      {settings.touchControlsEnabled && <TouchControls engine={engine} />}

      {/* Results / Game Over Modal */}
      <GameOverModal
        isOpen={isGameOverModalOpen}
        isVictory={isVictory}
        mode={mode}
        stats={currentStats}
        isSaved={isSaved}
        onRestart={initGame}
        onExit={() => setIsSelectingMode(true)}
      />
    </div>
  );
};
