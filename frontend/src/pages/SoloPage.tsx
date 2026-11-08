import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/engine/gameEngine';
import { KeyboardManager } from '../game/input/keyboardManager';
import { GamepadManager, DEFAULT_GAMEPAD_BINDINGS } from '../game/input/gamepadManager';
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
import { useDynamicCellSize } from '../hooks/useDynamicCellSize';
import { useGamepadActive, useGamepadBack } from '../context/GamepadNavContext';
import { Play, Pause, RotateCcw, ArrowLeft, Flame, Zap, Timer, Smile, Sliders, Shield, RefreshCw } from 'lucide-react';

interface SoloPageProps {
  initialMode?: string | null;
  onClearInitialMode?: () => void;
}

export const SoloPage: React.FC<SoloPageProps> = ({ initialMode, onClearInitialMode }) => {
  const { user, isAuthenticated } = useAuth();
  const { settings } = useSettings();
  const cellSize = useDynamicCellSize(false);

  const [mode, setMode] = useState<'marathon' | 'sprint' | 'ultra' | 'zen' | 'custom'>('marathon');
  const [isSelectingMode, setIsSelectingMode] = useState<boolean>(true);
  const [isCountingDown, setIsCountingDown] = useState<boolean>(false);

  // Zen Custom Options
  const [isConfiguringZen, setIsConfiguringZen] = useState<boolean>(false);
  const [zenLevel, setZenLevel] = useState<number>(1);
  const [zenFixedGravity, setZenFixedGravity] = useState<boolean>(true);
  const [zenImmortal, setZenImmortal] = useState<boolean>(true);
  const [zenGarbageLines, setZenGarbageLines] = useState<number>(0);
  const [zenLockDelay, setZenLockDelay] = useState<number>(settings.lockDelay || 500);

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

  const isPlaying = !isSelectingMode && !isConfiguringZen && !isGameOverModalOpen && (gameState === 'playing' || isCountingDown);
  useGamepadActive(isPlaying);

  useGamepadBack(() => {
    if (isGameOverModalOpen) {
      setIsGameOverModalOpen(false);
      setIsSelectingMode(true);
      return true;
    }
    if (isConfiguringZen) {
      setIsConfiguringZen(false);
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
  }, [isGameOverModalOpen, isConfiguringZen, isSelectingMode, gameState, engine]);

  const keyboardManagerRef = useRef<KeyboardManager | null>(null);
  const gamepadManagerRef = useRef<GamepadManager | null>(null);
  const zenTimeRecordedRef = useRef<number>(0);

  const saveZenSessionTime = () => {
    if (mode === 'zen') {
      const currentMs = Math.round(engine.totalPlayTimeMs);
      const deltaMs = currentMs - zenTimeRecordedRef.current;
      if (deltaMs >= 1000) {
        zenTimeRecordedRef.current = currentMs;
        if (isAuthenticated) {
          ApiClient.submitResult({ mode: 'zen', duration: deltaMs }).catch(console.warn);
        } else {
          const localResults = LocalStorageManager.getItem<any[]>('guest_results', []);
          localResults.unshift({ mode: 'zen', duration: deltaMs, date: Date.now() });
          LocalStorageManager.setItem('guest_results', localResults.slice(0, 50));
        }
      }
    }
  };

  // Save any accrued zen playtime on unmount or tab switch
  useEffect(() => {
    return () => {
      saveZenSessionTime();
      soundManager.stopBgm();
    };
  }, [mode, engine]);

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
      onClearInitialMode?.();
    } else if (m === 'marathon' || m === 'sprint' || m === 'ultra') {
      const validMode = m as 'marathon' | 'sprint' | 'ultra';
      setMode(validMode);
      setIsSelectingMode(false);
      setIsConfiguringZen(false);
      onClearInitialMode?.();
      // Use a microtask to ensure state is set before initGame reads it
      setTimeout(() => {
        initGame(validMode);
      }, 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMode]);

  const launchSelectedMode = (selectedMode: 'marathon' | 'sprint' | 'ultra' | 'zen' | 'custom') => {
    setMode(selectedMode);
    if (selectedMode === 'zen') {
      setIsSelectingMode(false);
      setIsConfiguringZen(true);
    } else {
      setIsSelectingMode(false);
      setIsConfiguringZen(false);
      initGame(selectedMode);
    }
  };

  const startZenGame = () => {
    setIsConfiguringZen(false);
    initGame('zen');
  };

  const initGame = (targetMode?: 'marathon' | 'sprint' | 'ultra' | 'zen' | 'custom') => {
    soundManager.stopBgm();
    const activeMode = (typeof targetMode === 'string') ? targetMode : mode;
    const isZen = activeMode === 'zen';
    const startingLevel = isZen ? zenLevel : 1;
    const fixedGravity = isZen ? zenFixedGravity : false;
    const immortal = isZen ? zenImmortal : false;
    const startingGarbageLines = isZen ? zenGarbageLines : 0;
    const lockDelay = isZen ? zenLockDelay : settings.lockDelay;

    const newEngine = new GameEngine({
      das: settings.das,
      arr: settings.arr,
      lockDelay,
      startingLevel,
      fixedGravity,
      immortal,
      startingGarbageLines
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
      onStateChange: (state) => {
        setGameState(state);
        if (state === 'paused') soundManager.pauseBgm();
        else if (state === 'playing') soundManager.resumeBgm();
        else if (state === 'gameover' || state === 'completed') soundManager.stopBgm();
      },
      onGameOver: () => handleGameOver(false)
    });

    setEngine(newEngine);
    zenTimeRecordedRef.current = 0;
    setGameState('ready');
    setScore(0);
    setLines(0);
    setLevel(startingLevel);
    setTimeMs(0);
    setCombo(-1);
    setB2B(false);
    setIsGameOverModalOpen(false);
    setIsSaved(false);

    // Next queue before countdown: show exact upcoming pieces with the 1st falling piece on top
    newEngine.activePiece = null;
    setNextQueue([...newEngine.randomizer.peek(5)]);
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
    engine.state = 'playing';
    engine.startTime = Date.now();
    engine.spawnPiece();
    setNextQueue([...engine.randomizer.peek(5)]);
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
            handleGameOver(true);
          }

          // Ultra mode timer expiration
          if (mode === 'ultra' && engine.totalPlayTimeMs >= ultraDuration && engine.clearingRows.length === 0) {
            engine.state = 'completed';
            handleGameOver(true);
          }

          // Marathon standard 150 lines victory
          if (mode === 'marathon' && engine.lines >= 150 && engine.clearingRows.length === 0) {
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
    soundManager.stopBgm();
    setIsVictory(victory);
    setIsGameOverModalOpen(true);
    if (!victory) {
      soundManager.playGameOver();
    } else {
      soundManager.playClear(4);
    }

    const stats = engine.getStats();

    // Zen Mode: ONLY track playtime, no other statistics or leaderboard submissions
    if (mode === 'zen') {
      const currentMs = Math.round(stats.duration);
      const deltaMs = currentMs - zenTimeRecordedRef.current;
      if (deltaMs >= 1000) {
        zenTimeRecordedRef.current = currentMs;
        if (isAuthenticated) {
          ApiClient.submitResult({ mode: 'zen', duration: deltaMs }).catch(console.warn);
        } else {
          const localResults = LocalStorageManager.getItem<any[]>('guest_results', []);
          localResults.unshift({ mode: 'zen', duration: deltaMs, date: Date.now() });
          LocalStorageManager.setItem('guest_results', localResults.slice(0, 50));
        }
      }
      setIsSaved(true);
      return;
    }

    // Persist result for competitive solo modes
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
      setIsSaved(false);
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
            Choose a single-player mode to begin.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1.25rem',
          textAlign: 'left'
        }}>
          {/* Marathon */}
          <div className="panel-card" role="button" tabIndex={0} style={{ padding: '1.5rem', cursor: 'pointer', transition: 'transform 0.2s' }} onClick={() => launchSelectedMode('marathon')}>
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
          <div className="panel-card" role="button" tabIndex={0} style={{ padding: '1.5rem', cursor: 'pointer', transition: 'transform 0.2s' }} onClick={() => launchSelectedMode('sprint')}>
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
          <div className="panel-card" role="button" tabIndex={0} style={{ padding: '1.5rem', cursor: 'pointer', transition: 'transform 0.2s' }} onClick={() => launchSelectedMode('ultra')}>
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
          <div className="panel-card" role="button" tabIndex={0} style={{ padding: '1.5rem', cursor: 'pointer', transition: 'transform 0.2s' }} onClick={() => launchSelectedMode('zen')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ background: 'rgba(168, 85, 247, 0.2)', color: 'var(--accent-purple)', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}>
                <Smile size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Zen & Custom Practice</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Configurable Endless</span>
              </div>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Configure gravity, immortal recovery, lock delays, and starting downstack lines to practice freely.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Zen Mode Pre-game Configuration Panel
  if (isConfiguringZen) {
    return (
      <div style={{ width: '100%', maxWidth: '720px', marginTop: '1rem' }}>
        <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: '50%', background: 'rgba(168, 85, 247, 0.15)', color: 'var(--accent-purple)', marginBottom: '0.5rem' }}>
            <Smile size={32} />
          </div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.3rem' }}>Zen & Practice Settings</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Configure your custom session parameters before playing.
          </p>
        </div>

        <div className="panel-card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Starting Speed / Level */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ fontWeight: 700, fontSize: '0.95rem' }}>Starting Speed / Level</label>
              <span style={{ color: 'var(--accent-cyan)', fontWeight: 800, fontSize: '0.95rem' }}>
                Level {zenLevel} ({GameEngine.defaultGravityCurve(zenLevel)}ms)
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              {[
                { label: 'Relaxed (Lv 1)', lvl: 1 },
                { label: 'Chill (Lv 5)', lvl: 5 },
                { label: 'Brisk (Lv 10)', lvl: 10 },
                { label: 'Intense (Lv 15)', lvl: 15 },
                { label: '20G Instant (Lv 20)', lvl: 20 }
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
              onChange={(e) => setZenLevel(parseInt(e.target.value, 10))}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>

          {/* Speed Behavior: Fixed vs Dynamic */}
          <div>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.5rem' }}>
              Speed Progression
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setZenFixedGravity(true)}
                onKeyDown={(e) => e.key === 'Enter' && setZenFixedGravity(true)}
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: `2px solid ${zenFixedGravity ? 'var(--accent-purple)' : 'var(--border-color)'}`,
                  background: zenFixedGravity ? 'rgba(168, 85, 247, 0.1)' : 'var(--bg-tertiary)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.2rem' }}>🧘 Fixed Speed (Constant)</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Gravity never accelerates. Zero pressure endless meditation.
                </div>
              </div>

              <div
                role="button"
                tabIndex={0}
                onClick={() => setZenFixedGravity(false)}
                onKeyDown={(e) => e.key === 'Enter' && setZenFixedGravity(false)}
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: `2px solid ${!zenFixedGravity ? 'var(--accent-purple)' : 'var(--border-color)'}`,
                  background: !zenFixedGravity ? 'rgba(168, 85, 247, 0.1)' : 'var(--bg-tertiary)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.2rem' }}>⚡ Dynamic (Accelerates)</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Gravity steadily speeds up every 10 lines as in Marathon.
                </div>
              </div>
            </div>
          </div>

          {/* Anti-Game Over / Board Recovery */}
          <div>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.5rem' }}>
              Anti-Game Over (Zen Immortality)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setZenImmortal(true)}
                onKeyDown={(e) => e.key === 'Enter' && setZenImmortal(true)}
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: `2px solid ${zenImmortal ? 'var(--accent-green)' : 'var(--border-color)'}`,
                  background: zenImmortal ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-tertiary)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.2rem', color: zenImmortal ? 'var(--accent-green)' : 'inherit' }}>
                  🛡️ Auto-Recovery (No Game Over)
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Touching the ceiling clears the board and continues smoothly without ending the game.
                </div>
              </div>

              <div
                role="button"
                tabIndex={0}
                onClick={() => setZenImmortal(false)}
                onKeyDown={(e) => e.key === 'Enter' && setZenImmortal(false)}
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: `2px solid ${!zenImmortal ? 'var(--accent-red)' : 'var(--border-color)'}`,
                  background: !zenImmortal ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-tertiary)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.2rem', color: !zenImmortal ? 'var(--accent-red)' : 'inherit' }}>
                  🛑 Standard Game Over
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Overfilling the board results in a normal game over screen.
                </div>
              </div>
            </div>
          </div>

          {/* Downstacking Practice: Starting Garbage Lines */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label style={{ fontWeight: 700, fontSize: '0.95rem' }}>Downstack Practice (Starting Lines)</label>
              <span style={{ color: 'var(--accent-yellow)', fontWeight: 800, fontSize: '0.9rem' }}>
                {zenGarbageLines === 0 ? 'Clean Board' : `${zenGarbageLines} Lines`}
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>
              Pre-fill the board with garbage rows with single holes to practice digging and downstacking.
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
                  {count === 0 ? 'Empty (0)' : `${count} Lines`}
                </button>
              ))}
            </div>
          </div>

          {/* Lock Delay */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label style={{ fontWeight: 700, fontSize: '0.95rem' }}>Lock Delay</label>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{zenLockDelay}ms</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[
                { label: 'Standard (500ms)', ms: 500 },
                { label: 'Relaxed (1000ms)', ms: 1000 },
                { label: 'Uncapped (2000ms)', ms: 2000 }
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

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <button
              className="btn-secondary"
              onClick={() => { setIsConfiguringZen(false); setIsSelectingMode(true); }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem' }}
            >
              <ArrowLeft size={18} />
              <span>Back to Modes</span>
            </button>

            <button
              className="btn-primary"
              onClick={startZenGame}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.75rem',
                fontSize: '1.05rem',
                background: 'linear-gradient(135deg, #a855f7, #06b6d4)'
              }}
            >
              <Play size={20} />
              <span>Start Zen Session</span>
            </button>
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
        <button
          className="btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem' }}
          onClick={() => {
            saveZenSessionTime();
            soundManager.stopBgm();
            setIsSelectingMode(true);
          }}
        >
          <ArrowLeft size={16} /> Mode Menu
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
            <Sliders size={16} color="var(--accent-purple)" /> Zen Settings
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
          Mode: {mode} {mode === 'sprint' ? `(${sprintGoal}L)` : mode === 'ultra' ? '(3m)' : mode === 'zen' ? `(Lv ${zenLevel}${zenFixedGravity ? ' • Fixed' : ''}${zenImmortal ? ' • Immortal' : ''})` : ''}
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
            b2bChain={engine.b2bChain}
            pps={currentStats.pps}
            apm={currentStats.apm}
          />
        </div>

        {/* Center: Playfield */}
        <div style={{ position: 'relative' }}>
          <PlayfieldCanvas engine={engine} cellSize={cellSize} />

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
              onClick={() => initGame()}
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
        onRestart={() => initGame()}
        onExit={() => setIsSelectingMode(true)}
      />
    </div>
  );
};
