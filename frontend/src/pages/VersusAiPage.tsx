import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/engine/gameEngine';
import { AIController } from '../game/ai/aiController';
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
import { ApiClient } from '../services/api';
import { Bot, User as UserIcon, RotateCcw, ArrowLeft, Swords, Shield, Zap, Flame } from 'lucide-react';

export const VersusAiPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { settings } = useSettings();

  const [isSelectingDifficulty, setIsSelectingDifficulty] = useState<boolean>(true);
  const [isCountingDown, setIsCountingDown] = useState<boolean>(false);
  const [difficulty, setDifficulty] = useState<number>(5);

  const [playerEngine, setPlayerEngine] = useState<GameEngine>(() => new GameEngine());
  const [aiEngine, setAiEngine] = useState<GameEngine>(() => new GameEngine());

  const [playerHold, setPlayerHold] = useState<any>(null);
  const [playerQueue, setPlayerQueue] = useState<any[]>([]);
  const [aiHold, setAiHold] = useState<any>(null);
  const [aiQueue, setAiQueue] = useState<any[]>([]);

  const [playerGarbage, setPlayerGarbage] = useState<number>(0);
  const [aiGarbage, setAiGarbage] = useState<number>(0);

  const [matchResult, setMatchResult] = useState<'win' | 'loss' | null>(null);
  const [isGameOverOpen, setIsGameOverOpen] = useState<boolean>(false);

  const aiControllerRef = useRef<AIController | null>(null);
  const keyboardRef = useRef<KeyboardManager | null>(null);
  const gamepadRef = useRef<GamepadManager | null>(null);

  const launchWithDifficulty = (level: number) => {
    setDifficulty(level);
    setIsSelectingDifficulty(false);
    startMatch(level);
  };

  const startMatch = (overrideDiff?: number) => {
    const activeDiff = overrideDiff ?? difficulty;
    const seed = Math.floor(Math.random() * 1000000);

    const pEngine = new GameEngine({
      seed,
      das: settings.das,
      arr: settings.arr,
      lockDelay: settings.lockDelay
    });

    const aEngine = new GameEngine({
      seed,
      lockDelay: 500
    });

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
    };

    // Game over listeners
    pEngine.events.onGameOver = () => handleEndMatch('loss');
    aEngine.events.onGameOver = () => handleEndMatch('win');

    setPlayerEngine(pEngine);
    setAiEngine(aEngine);
    setMatchResult(null);
    setIsGameOverOpen(false);
    setPlayerGarbage(0);
    setAiGarbage(0);

    // AI Controller
    aiControllerRef.current = new AIController(aEngine, activeDiff);

    // Keyboard Manager
    if (keyboardRef.current) keyboardRef.current.detach();
    const km = new KeyboardManager(pEngine, settings.keybindings, {
      onRestart: () => startMatch()
    });
    km.attach();
    keyboardRef.current = km;

    // Gamepad Manager
    gamepadRef.current = new GamepadManager(pEngine, {
      onRestart: () => startMatch()
    });

    // Prepare pieces
    pEngine.spawnPiece();
    aEngine.spawnPiece();
    setPlayerQueue([...pEngine.randomizer.peek(5)]);
    setAiQueue([...aEngine.randomizer.peek(5)]);

    // Start 3-second countdown
    setIsCountingDown(true);
  };

  const handleCountdownComplete = () => {
    setIsCountingDown(false);
    playerEngine.state = 'playing';
    playerEngine.startTime = Date.now();
    aiEngine.state = 'playing';
    aiEngine.startTime = Date.now();
  };

  // Main match update loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const delta = time - lastTime;
      lastTime = time;

      if (!isSelectingDifficulty && !isCountingDown) {
        if (playerEngine.state === 'playing') {
          playerEngine.update(delta);
          keyboardRef.current?.update(delta);
          gamepadRef.current?.update(delta);
          setPlayerHold(playerEngine.holdPiece);
          setPlayerQueue([...playerEngine.randomizer.peek(5)]);
          setPlayerGarbage(playerEngine.garbageManager.getPendingCount());
        }

        if (aiEngine.state === 'playing') {
          aiEngine.update(delta);
          aiControllerRef.current?.update(delta);
          setAiHold(aiEngine.holdPiece);
          setAiQueue([...aiEngine.randomizer.peek(5)]);
          setAiGarbage(aiEngine.garbageManager.getPendingCount());
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [playerEngine, aiEngine, isSelectingDifficulty, isCountingDown]);

  const handleEndMatch = async (result: 'win' | 'loss') => {
    setMatchResult(result);
    setIsGameOverOpen(true);

    if (result === 'win') {
      soundManager.playClear(4);
    } else {
      soundManager.playGameOver();
    }

    if (isAuthenticated) {
      try {
        await ApiClient.recordMatch({
          opponentName: `AI Level ${difficulty}`,
          opponentType: 'ai',
          difficulty,
          result,
          playerScore: playerEngine.score,
          playerLines: playerEngine.lines,
          opponentScore: aiEngine.score,
          opponentLines: aiEngine.lines,
          duration: playerEngine.totalPlayTimeMs
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
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.4rem' }}>1v1 Versus AI</h1>
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
          <div className="panel-card" style={{ padding: '1.5rem', cursor: 'pointer' }} onClick={() => launchWithDifficulty(2)}>
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
          <div className="panel-card" style={{ padding: '1.5rem', cursor: 'pointer' }} onClick={() => launchWithDifficulty(4)}>
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
          <div className="panel-card" style={{ padding: '1.5rem', cursor: 'pointer' }} onClick={() => launchWithDifficulty(6)}>
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
          <div className="panel-card" style={{ padding: '1.5rem', cursor: 'pointer' }} onClick={() => launchWithDifficulty(8)}>
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
          <div className="panel-card" style={{ padding: '1.5rem', cursor: 'pointer' }} onClick={() => launchWithDifficulty(10)}>
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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      {/* Top Bar with Difficulty and Menu return */}
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

        <button className="btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }} onClick={() => startMatch()}>
          <RotateCcw size={14} /> Restart Match
        </button>
      </div>

      {/* Dual Arena: Player vs AI */}
      <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Player Side */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.95rem' }}>
            <UserIcon size={18} color="var(--accent-cyan)" />
            <span>You</span>
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
          color: 'var(--accent-red)',
          background: 'rgba(239, 68, 68, 0.1)',
          padding: '0.5rem 0.8rem',
          borderRadius: '999px',
          border: '1px solid rgba(239, 68, 68, 0.3)'
        }}>
          VS
        </div>

        {/* AI Opponent Side */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.95rem' }}>
            <Bot size={18} color="var(--accent-purple)" />
            <span>Nint Bot (Lv {difficulty})</span>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <div className="side-panel" style={{ minWidth: '80px' }}>
              <HoldDisplay piece={aiHold} canHold={aiEngine.canHold} />
              <div className="panel-card" style={{ padding: '0.5rem' }}>
                <div className="stat-label">Lines</div>
                <div className="stat-value" style={{ fontSize: '1.2rem' }}>{aiEngine.lines}</div>
              </div>
            </div>

            <PlayfieldCanvas engine={aiEngine} incomingGarbage={aiGarbage} cellSize={24} />

            <div className="side-panel" style={{ minWidth: '70px' }}>
              <QueueDisplay queue={aiQueue} count={3} />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Touch Controls */}
      {settings.touchControlsEnabled && <TouchControls engine={playerEngine} />}

      {/* Match Result Modal */}
      <GameOverModal
        isOpen={isGameOverOpen}
        isVictory={matchResult === 'win'}
        mode="versus_ai"
        stats={playerEngine.getStats()}
        onRestart={() => startMatch()}
        onExit={() => setIsSelectingDifficulty(true)}
      />
    </div>
  );
};
