import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/engine/gameEngine';
import { AIController } from '../game/ai/aiController';
import { KeyboardManager } from '../game/input/keyboardManager';
import { GamepadManager, DEFAULT_GAMEPAD_BINDINGS } from '../game/input/gamepadManager';
import { soundManager } from '../game/audio/soundManager';
import { GameOverModal } from '../components/game/GameOverModal';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { ApiClient } from '../services/api';
import { useDynamicCellSize } from '../hooks/useDynamicCellSize';
import { useGamepadActive, useGamepadBack } from '../context/GamepadNavContext';
import { VersusArena } from '../components/game/VersusArena';
import { Bot, User as UserIcon, RotateCcw, ArrowLeft, Swords, Shield, Zap, Flame, Play, Pause } from 'lucide-react';

export const VersusAiPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { settings } = useSettings();
  const arenaRef = useRef<HTMLDivElement>(null);
  const cellSize = useDynamicCellSize(true, arenaRef);

  const [isSelectingDifficulty, setIsSelectingDifficulty] = useState<boolean>(true);
  const [isCountingDown, setIsCountingDown] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [difficulty, setDifficulty] = useState<number>(5);

  const handleCardKey = (action: () => void) => (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  };

  const [playerEngine, setPlayerEngine] = useState<GameEngine>(() => new GameEngine());
  const [aiEngine, setAiEngine] = useState<GameEngine>(() => new GameEngine());

  const [playerHold, setPlayerHold] = useState<any>(null);
  const [playerQueue, setPlayerQueue] = useState<any[]>([]);
  const [aiHold, setAiHold] = useState<any>(null);
  const [aiQueue, setAiQueue] = useState<any[]>([]);

  const [playerGarbage, setPlayerGarbage] = useState<number>(0);
  const [aiGarbage, setAiGarbage] = useState<number>(0);

  const [playerLinesDisplay, setPlayerLinesDisplay] = useState<number>(0);
  const [aiLinesDisplay, setAiLinesDisplay] = useState<number>(0);

  const [matchResult, setMatchResult] = useState<'win' | 'loss' | null>(null);
  const [isGameOverOpen, setIsGameOverOpen] = useState<boolean>(false);
  const [lastStats, setLastStats] = useState<any>(null);

  const isPlaying = !isSelectingDifficulty && !isGameOverOpen && (playerEngine.state === 'playing' || playerEngine.state === 'paused' || isCountingDown);
  useGamepadActive(isPlaying);

  useGamepadBack(() => {
    if (isGameOverOpen) {
      setIsGameOverOpen(false);
      setIsSelectingDifficulty(true);
      return true;
    }
    if (!isSelectingDifficulty) {
      setIsSelectingDifficulty(true);
      return true;
    }
    return false;
  }, [isGameOverOpen, isSelectingDifficulty]);

  useEffect(() => {
    return () => {
      keyboardRef.current?.detach();
      soundManager.stopBgm();
    };
  }, []);

  const playerEngineRef = useRef<GameEngine>(new GameEngine());
  const aiEngineRef = useRef<GameEngine>(new GameEngine());
  const difficultyRef = useRef<number>(5);
  const matchStartTimeRef = useRef<number>(0);
  const matchEndedRef = useRef<boolean>(false);

  const aiControllerRef = useRef<AIController | null>(null);
  const keyboardRef = useRef<KeyboardManager | null>(null);
  const gamepadRef = useRef<GamepadManager | null>(null);

  const togglePause = () => {
    const pEngine = playerEngineRef.current;
    const aEngine = aiEngineRef.current;

    if (pEngine.state === 'playing') {
      pEngine.pause();
      aEngine.pause();
      setIsPaused(true);
      soundManager.pauseBgm();
    } else if (pEngine.state === 'paused') {
      pEngine.resume();
      aEngine.resume();
      setIsPaused(false);
      soundManager.resumeBgm();
    }
  };

  const launchWithDifficulty = (level: number) => {
    difficultyRef.current = level;
    setDifficulty(level);
    setIsSelectingDifficulty(false);
    startMatch(level);
  };

  const startMatch = (overrideDiff?: number) => {
    soundManager.stopBgm();
    const activeDiff = overrideDiff ?? difficultyRef.current;
    difficultyRef.current = activeDiff;
    setDifficulty(activeDiff);

    const seed = Math.floor(Math.random() * 1000000);

    const pEngine = new GameEngine({
      seed,
      das: settings.das,
      arr: settings.arr,
      softDropFactor: settings.softDropFactor,
      lockDelay: settings.lockDelay
    });

    const aEngine = new GameEngine({
      seed,
      lockDelay: 500
    });

    playerEngineRef.current = pEngine;
    aiEngineRef.current = aEngine;
    matchEndedRef.current = false;
    matchStartTimeRef.current = 0;

    // Cross-link garbage pipelines
    pEngine.events.onGarbageSent = (amount) => {
      soundManager.playGarbageSent();
      aEngine.garbageManager.enqueueGarbage(amount);
      setAiGarbage(aEngine.garbageManager.getPendingCount());
    };

    aEngine.events.onGarbageSent = (amount) => {
      soundManager.playGarbageWarning();
      pEngine.garbageManager.enqueueGarbage(amount);
      setPlayerGarbage(pEngine.garbageManager.getPendingCount());
    };

    pEngine.events.onPieceMove = () => soundManager.playMove();
    pEngine.events.onPieceRotate = () => soundManager.playRotate();
    pEngine.events.onPieceLock = () => {
      soundManager.playLock();
      setPlayerGarbage(pEngine.garbageManager.getPendingCount());
    };
    pEngine.events.onLineClear = (res) => {
      soundManager.playClear(res.linesCleared);
      if (res.comboCount > 0) soundManager.playCombo(res.comboCount);
      setPlayerGarbage(pEngine.garbageManager.getPendingCount());
      setPlayerLinesDisplay(pEngine.lines);
    };

    aEngine.events.onPieceLock = () => {
      setAiGarbage(aEngine.garbageManager.getPendingCount());
    };
    aEngine.events.onLineClear = (res) => {
      setAiGarbage(aEngine.garbageManager.getPendingCount());
      setAiLinesDisplay(aEngine.lines);
    };

    // Game over listeners bound directly to active instances
    pEngine.events.onGameOver = () => handleEndMatch('loss', pEngine, aEngine, activeDiff);
    aEngine.events.onGameOver = () => handleEndMatch('win', pEngine, aEngine, activeDiff);

    setPlayerEngine(pEngine);
    setAiEngine(aEngine);
    setPlayerLinesDisplay(0);
    setAiLinesDisplay(0);
    setMatchResult(null);
    setIsGameOverOpen(false);
    setIsPaused(false);
    setPlayerGarbage(0);
    setAiGarbage(0);

    // AI Controller
    aiControllerRef.current = new AIController(aEngine, activeDiff);

    // Keyboard Manager
    if (keyboardRef.current) keyboardRef.current.detach();
    const km = new KeyboardManager(pEngine, settings.keybindings, {
      onRestart: () => startMatch(),
      onPause: togglePause
    });
    km.attach();
    keyboardRef.current = km;

    // Gamepad Manager
    gamepadRef.current = new GamepadManager(pEngine, settings.gamepadBindings || DEFAULT_GAMEPAD_BINDINGS, {
      onRestart: () => startMatch(),
      onPause: togglePause
    });

    // Before countdown: show exact upcoming pieces with the 1st falling piece on top
    pEngine.activePiece = null;
    aEngine.activePiece = null;
    setPlayerQueue([...pEngine.randomizer.peek(5)]);
    setAiQueue([...aEngine.randomizer.peek(5)]);

    // Start 3-second countdown
    setIsCountingDown(true);
  };

  const handleCountdownComplete = () => {
    setIsCountingDown(false);
    setIsPaused(false);
    matchStartTimeRef.current = Date.now();

    const pEngine = playerEngineRef.current;
    const aEngine = aiEngineRef.current;

    pEngine.state = 'playing';
    pEngine.startTime = Date.now();
    pEngine.spawnPiece();
    setPlayerQueue([...pEngine.randomizer.peek(5)]);

    aEngine.state = 'playing';
    aEngine.startTime = Date.now();
    aEngine.spawnPiece();
    setAiQueue([...aEngine.randomizer.peek(5)]);

    soundManager.startBgm();
  };

  // Main match update loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const delta = time - lastTime;
      lastTime = time;

      const pEng = playerEngineRef.current;
      const aEng = aiEngineRef.current;

      if (!isSelectingDifficulty && !isCountingDown) {
        // Poll the gamepad even while paused so Start/Options can resume.
        gamepadRef.current?.update(delta);

        if (pEng && pEng.state === 'playing') {
          pEng.update(delta);
          keyboardRef.current?.update(delta);
          setPlayerHold(pEng.holdPiece);
          setPlayerQueue([...pEng.randomizer.peek(5)]);
          setPlayerGarbage(pEng.garbageManager.getPendingCount());
          setPlayerLinesDisplay(pEng.lines);
        }

        if (aEng && aEng.state === 'playing') {
          aEng.update(delta);
          aiControllerRef.current?.update(delta);
          setAiHold(aEng.holdPiece);
          setAiQueue([...aEng.randomizer.peek(5)]);
          setAiGarbage(aEng.garbageManager.getPendingCount());
          setAiLinesDisplay(aEng.lines);
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isSelectingDifficulty, isCountingDown]);

  const handleEndMatch = async (
    result: 'win' | 'loss',
    pEngine: GameEngine = playerEngineRef.current,
    aEngine: GameEngine = aiEngineRef.current,
    diff: number = difficultyRef.current
  ) => {
    soundManager.stopBgm();
    if (matchEndedRef.current) return;
    matchEndedRef.current = true;

    pEngine.state = 'gameover';
    aEngine.state = 'gameover';
    setIsPaused(false);

    const pStats = pEngine.getStats();
    setLastStats(pStats);
    setMatchResult(result);
    setIsGameOverOpen(true);

    if (result === 'win') {
      soundManager.playClear(4);
    } else {
      soundManager.playGameOver();
    }

    const duration = pEngine.totalPlayTimeMs > 0
      ? pEngine.totalPlayTimeMs
      : (matchStartTimeRef.current > 0 ? Date.now() - matchStartTimeRef.current : 0);

    if (isAuthenticated) {
      try {
        await ApiClient.recordMatch({
          opponentName: `AI Level ${diff}`,
          opponentType: 'ai',
          difficulty: diff,
          result,
          playerScore: pEngine.score,
          playerLines: pEngine.lines,
          opponentScore: aEngine.score,
          opponentLines: aEngine.lines,
          duration: Math.round(duration),
          piecesPlaced: pStats.piecesPlaced || 0,
          tetrises: pStats.tetrises || 0,
          tSpins: pStats.tSpins || 0,
          perfectClears: pStats.perfectClears || 0,
          maxCombo: pStats.maxCombo || 0,
          maxB2B: pStats.maxB2B || 0
        });
      } catch (e) {
        console.warn('Failed to record match history:', e);
      }
    }
  };

  const getDifficultyLabel = (diff: number) => {
    if (diff <= 2) return 'Beginner';
    if (diff <= 4) return 'Casual';
    if (diff <= 6) return 'Intermediate';
    if (diff <= 8) return 'Advanced';
    return 'Master';
  };

  // Difficulty selection menu
  if (isSelectingDifficulty) {
    return (
      <div style={{ width: '100%', maxWidth: '880px', textAlign: 'center', marginTop: '1rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.4rem' }}>Player vs CPU</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Select an AI opponent difficulty level. The game begins with a 3-second countdown.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1.25rem',
          textAlign: 'left'
        }}>
          {/* Beginner Lv 2 */}
          <div className="panel-card" role="button" tabIndex={0} style={{ padding: '1.5rem', cursor: 'pointer' }} onClick={() => launchWithDifficulty(2)} onKeyDown={handleCardKey(() => launchWithDifficulty(2))}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ background: 'rgba(34, 197, 94, 0.2)', color: 'var(--accent-green)', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}>
                <Shield size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Beginner (Lv 2)</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Relaxed Pace</span>
              </div>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Slow placement speed (~700ms) with forgiving stacking and basic clears. Great for learning versus mechanics.
            </p>
          </div>

          {/* Casual Lv 4 */}
          <div className="panel-card" role="button" tabIndex={0} style={{ padding: '1.5rem', cursor: 'pointer' }} onClick={() => launchWithDifficulty(4)} onKeyDown={handleCardKey(() => launchWithDifficulty(4))}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ background: 'rgba(6, 182, 212, 0.2)', color: 'var(--accent-cyan)', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}>
                <Bot size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Casual (Lv 4)</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Balanced Battle</span>
              </div>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Solid flat stacking, downstacks when garbage arrives, and sends regular counter-attacks.
            </p>
          </div>

          {/* Intermediate Lv 6 */}
          <div className="panel-card" role="button" tabIndex={0} style={{ padding: '1.5rem', cursor: 'pointer' }} onClick={() => launchWithDifficulty(6)} onKeyDown={handleCardKey(() => launchWithDifficulty(6))}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ background: 'rgba(59, 130, 246, 0.2)', color: 'var(--accent-blue)', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}>
                <Zap size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Intermediate (Lv 6)</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Fast Paced</span>
              </div>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Maintains an open right-side well for Tetris clears, reacts quickly to attacks, and builds clean stacks.
            </p>
          </div>

          {/* Advanced Lv 8 */}
          <div className="panel-card" role="button" tabIndex={0} style={{ padding: '1.5rem', cursor: 'pointer' }} onClick={() => launchWithDifficulty(8)} onKeyDown={handleCardKey(() => launchWithDifficulty(8))}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ background: 'rgba(236, 72, 153, 0.2)', color: 'var(--accent-pink)', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}>
                <Flame size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Advanced (Lv 8)</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Aggressive AI</span>
              </div>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              High PPS (~200ms placements), deep heuristic evaluation, and proactive B2B Tetris attacks.
            </p>
          </div>

          {/* Master Lv 10 */}
          <div className="panel-card" role="button" tabIndex={0} style={{ padding: '1.5rem', cursor: 'pointer' }} onClick={() => launchWithDifficulty(10)} onKeyDown={handleCardKey(() => launchWithDifficulty(10))}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--accent-red)', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}>
                <Swords size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Grandmaster (Lv 10)</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Peak Competitive AI</span>
              </div>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Ultra-fast execution, lookahead optimization, ruthless garbage cancelling, and high APM.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="versus-page">
      {/* Top Bar with Difficulty and Menu return */}
      <div className="versus-toolbar">
        <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem' }} onClick={() => setIsSelectingDifficulty(true)}>
          <ArrowLeft size={16} /> Difficulty Menu
        </button>

        <div style={{
          background: 'rgba(59, 130, 246, 0.2)',
          color: 'var(--accent-blue)',
          padding: '0.2rem 0.6rem',
          borderRadius: '4px',
          fontWeight: 800,
          fontSize: '0.85rem'
        }}>
          Opponent: Lv {difficulty} ({getDifficultyLabel(difficulty)})
        </div>

        <button
          className="btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
          onClick={togglePause}
          disabled={isCountingDown || isGameOverOpen}
        >
          {isPaused ? <Play size={14} /> : <Pause size={14} />}
          {isPaused ? 'Resume' : 'Pause'}
        </button>

        <button className="btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }} onClick={() => startMatch()}>
          <RotateCcw size={14} /> Restart Match
        </button>
      </div>

      <VersusArena
        arenaRef={arenaRef}
        cellSize={cellSize}
        player={{
          label: <><UserIcon size={18} color="var(--accent-cyan)" /><span>You</span></>,
          tone: 'cyan',
          hold: playerHold,
          canHold: playerEngine.canHold,
          queue: playerQueue,
          score: playerEngine.score,
          lines: playerLinesDisplay,
          engine: playerEngine,
          garbage: playerGarbage
        }}
        opponent={{
          label: <><Bot size={18} color="var(--accent-purple)" /><span>Nint Bot (Lv {difficulty})</span></>,
          tone: 'purple',
          hold: aiHold,
          canHold: aiEngine.canHold,
          queue: aiQueue,
          score: aiEngine.score,
          lines: aiLinesDisplay,
          engine: aiEngine,
          garbage: aiGarbage
        }}
        isCountingDown={isCountingDown}
        onCountdownComplete={handleCountdownComplete}
        overlay={isPaused ? (
          <div className="versus-pause-overlay">
            <div className="versus-pause-card">
              <h2>PAUSED</h2>
              <p>Press Start / Escape or click Resume to continue.</p>
              <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={togglePause}>
                <Play size={18} /> Resume
              </button>
            </div>
          </div>
        ) : null}
      />

      {/* Match Result Modal */}
      <GameOverModal
        isOpen={isGameOverOpen}
        isVictory={matchResult === 'win'}
        mode="versus_ai"
        stats={lastStats || playerEngineRef.current.getStats()}
        customMessage={matchResult === 'win' ? `Victory against AI Level ${difficulty}!` : `Defeat against AI Level ${difficulty}`}
        onRestart={() => startMatch()}
        onExit={() => setIsSelectingDifficulty(true)}
      />
    </div>
  );
};
