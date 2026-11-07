import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/engine/gameEngine';
import { KeyboardManager } from '../game/input/keyboardManager';
import { soundManager } from '../game/audio/soundManager';
import { PlayfieldCanvas } from '../components/game/PlayfieldCanvas';
import { HoldDisplay } from '../components/game/HoldDisplay';
import { QueueDisplay } from '../components/game/QueueDisplay';
import { HUD } from '../components/game/HUD';
import { TouchControls } from '../components/game/TouchControls';
import { GameOverModal } from '../components/game/GameOverModal';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { ApiClient } from '../services/api';
import { LocalStorageManager } from '../services/storage';
import { Play, Pause, RotateCcw } from 'lucide-react';

export const SoloPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const { settings } = useSettings();

  const [mode, setMode] = useState<'marathon' | 'sprint' | 'ultra' | 'zen' | 'custom'>('marathon');
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

    newEngine.start();
    setNextQueue([...newEngine.randomizer.peek(5)]);
  };

  useEffect(() => {
    initGame();
    return () => {
      keyboardManagerRef.current?.detach();
    };
  }, [mode, sprintGoal, ultraDuration]);

  // Main game loop ticker
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const tick = (currentTime: number) => {
      const delta = currentTime - lastTime;
      lastTime = currentTime;

      if (engine.state === 'playing') {
        engine.update(delta);
        keyboardManagerRef.current?.update(delta);
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

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [engine, mode, sprintGoal, ultraDuration]);

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
      // Save locally for guest
      const localResults = LocalStorageManager.getItem<any[]>('guest_results', []);
      localResults.unshift({ ...resultPayload, date: Date.now() });
      LocalStorageManager.setItem('guest_results', localResults.slice(0, 50));
      setIsSaved(true);
    }
  };

  const currentStats = engine.getStats();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      {/* Mode Select Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          className={`btn-secondary ${mode === 'marathon' ? 'btn-primary' : ''}`}
          onClick={() => setMode('marathon')}
        >
          Marathon (150)
        </button>
        <button
          className={`btn-secondary ${mode === 'sprint' ? 'btn-primary' : ''}`}
          onClick={() => setMode('sprint')}
        >
          Sprint (40L)
        </button>
        <button
          className={`btn-secondary ${mode === 'ultra' ? 'btn-primary' : ''}`}
          onClick={() => setMode('ultra')}
        >
          Ultra (3m)
        </button>
        <button
          className={`btn-secondary ${mode === 'zen' ? 'btn-primary' : ''}`}
          onClick={() => setMode('zen')}
        >
          Zen
        </button>
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

        {/* Right Side: Next Queue */}
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
        onExit={() => setIsGameOverModalOpen(false)}
      />
    </div>
  );
};
