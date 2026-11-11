import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/engine/gameEngine';
import { KeyboardManager } from '../game/input/keyboardManager';
import { GamepadManager, DEFAULT_GAMEPAD_BINDINGS } from '../game/input/gamepadManager';
import { soundManager } from '../game/audio/soundManager';
import { PlayfieldCanvas } from '../components/game/PlayfieldCanvas';
import { HoldDisplay } from '../components/game/HoldDisplay';
import { QueueDisplay } from '../components/game/QueueDisplay';
import { HUD } from '../components/game/HUD';
import { GameOverModal } from '../components/game/GameOverModal';
import { CountdownOverlay } from '../components/game/CountdownOverlay';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { ApiClient } from '../services/api';
import { LocalStorageManager } from '../services/storage';
import { useDynamicCellSize } from '../hooks/useDynamicCellSize';
import { useGamepadActive, useGamepadBack, scrollElementIntoViewSmart } from '../context/GamepadNavContext';
import { useI18n } from '../i18n/useI18n';
import { SoloModeMenu } from './SoloModeMenu';
import { Play, Pause, RotateCcw, ArrowLeft, Flame, Smile, Sliders, Shield } from 'lucide-react';

type SoloMode = 'marathon' | 'sprint' | 'ultra' | 'zen' | 'custom';

interface SoloPageProps {
  initialMode?: string | null;
  onClearInitialMode?: () => void;
  onStartCpu?: (level: number) => void;
}

export const SoloPage: React.FC<SoloPageProps> = ({ initialMode, onClearInitialMode, onStartCpu }) => {
  const { user, isAuthenticated } = useAuth();
  const { settings } = useSettings();
  const { t } = useI18n();
  const cellSize = useDynamicCellSize(false);

  const [mode, setMode] = useState<SoloMode>('marathon');
  const [isSelectingMode, setIsSelectingMode] = useState<boolean>(true);
  const [isCountingDown, setIsCountingDown] = useState<boolean>(false);

  // Zen Custom Options
  const [isConfiguringZen, setIsConfiguringZen] = useState<boolean>(false);
  const [isConfiguringMarathon, setIsConfiguringMarathon] = useState<boolean>(false);
  const [zenLevel, setZenLevel] = useState<number>(1);
  const [zenFixedGravity, setZenFixedGravity] = useState<boolean>(true);
  const [zenImmortal, setZenImmortal] = useState<boolean>(true);
  const [zenGarbageLines, setZenGarbageLines] = useState<number>(0);
  const [zenLockDelay, setZenLockDelay] = useState<number>(settings.lockDelay || 500);
  // Zen gamepad section focus (0=level, 1=speed, 2=immortal, 3=garbage, 4=lockdelay, 5=back, 6=start)
  const [zenFocusSection, setZenFocusSection] = useState<number>(0);
  // Trigger flags for zen actions (avoids stale closures in RAF loop)
  const [zenActionPending, setZenActionPending] = useState<'start' | 'back' | null>(null);

  const [sprintGoal, setSprintGoal] = useState<number>(40);
  const [ultraDuration, setUltraDuration] = useState<number>(180000); // 3 mins
  const [marathonStartLevel, setMarathonStartLevel] = useState<number>(1);

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
  // Also suppress global gamepad nav during zen config (we handle it ourselves)
  useGamepadActive(isPlaying || isConfiguringZen);

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
    if (isConfiguringMarathon) {
      setIsConfiguringMarathon(false);
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
  }, [isGameOverModalOpen, isConfiguringZen, isConfiguringMarathon, isSelectingMode, gameState, engine]);

  const keyboardManagerRef = useRef<KeyboardManager | null>(null);
  const gamepadManagerRef = useRef<GamepadManager | null>(null);
  const zenTimeRecordedRef = useRef<number>(0);

  // Refs for zen gamepad loop (always read fresh values, no stale closures)
  const zenLevelRef = useRef(zenLevel);
  zenLevelRef.current = zenLevel;
  const zenFixedGravityRef = useRef(zenFixedGravity);
  zenFixedGravityRef.current = zenFixedGravity;
  const zenImmortalRef = useRef(zenImmortal);
  zenImmortalRef.current = zenImmortal;
  const zenGarbageLinesRef = useRef(zenGarbageLines);
  zenGarbageLinesRef.current = zenGarbageLines;
  const zenLockDelayRef = useRef(zenLockDelay);
  zenLockDelayRef.current = zenLockDelay;
  const zenFocusSectionRef = useRef(zenFocusSection);
  zenFocusSectionRef.current = zenFocusSection;

  const saveZenSessionTime = (sourceEngine: GameEngine = engine, sourceMode: string = mode) => {
    if (sourceMode === 'zen') {
      const currentMs = Math.round(sourceEngine.totalPlayTimeMs);
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
      saveZenSessionTime(engine, mode);
      soundManager.stopBgm();
    };
  }, [mode, engine]);

  // Detach the global keyboard listener when leaving the page
  useEffect(() => {
    return () => {
      keyboardManagerRef.current?.detach();
    };
  }, []);

  // Handle zen action triggers (avoids stale closure in RAF loop)
  useEffect(() => {
    if (!zenActionPending) return;
    setZenActionPending(null);
    if (zenActionPending === 'back') {
      setIsConfiguringZen(false);
      setIsSelectingMode(true);
    } else if (zenActionPending === 'start') {
      startZenGame();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zenActionPending]);

  // Reset focus section when entering zen config
  useEffect(() => {
    if (isConfiguringZen) setZenFocusSection(0);
  }, [isConfiguringZen]);

  // Keep zen focused section in visible viewport (clearing sticky navbar and gamepad bar)
  useEffect(() => {
    if (!isConfiguringZen) return;
    const target = document.querySelector(`[data-zen-section="${zenFocusSection}"]`) as HTMLElement;
    if (target) {
      scrollElementIntoViewSmart(target);
    }
  }, [zenFocusSection, isConfiguringZen]);

  // Dedicated gamepad loop for zen config panel (bypasses spatial nav entirely)
  useEffect(() => {
    if (!isConfiguringZen) return;

    const ZEN_SECTIONS = 7;
    const levelPresets = [1, 5, 10, 15, 20];
    const garbageOptions = [0, 2, 4, 6, 8, 10, 14];
    const lockOptions = [500, 1000, 2000];

    let animId: number;
    let prevButtons: boolean[] = [];
    let dpadTimer = 0;
    let lastDir: string | null = null;
    let lastTime = performance.now();
    const DAS = 280;
    const ARR = 130;

    const handleZenInput = (dir: 'up' | 'down' | 'left' | 'right' | 'select' | 'back') => {
      const section = zenFocusSectionRef.current;

      if (dir === 'back') {
        setZenActionPending('back');
        soundManager.playMove();
        return;
      }

      if (dir === 'select') {
        switch (section) {
          case 1: // Speed Progression: toggle
            setZenFixedGravity(v => !v);
            soundManager.playRotate();
            break;
          case 2: // Anti-Game Over: toggle
            setZenImmortal(v => !v);
            soundManager.playRotate();
            break;
          case 5: // Back
            setZenActionPending('back');
            soundManager.playMove();
            break;
          case 6: // Start
            setZenActionPending('start');
            soundManager.playRotate();
            break;
          default:
            soundManager.playMove();
        }
        return;
      }

      if (dir === 'up') {
        setZenFocusSection(s => Math.max(0, s - 1));
        soundManager.playMove();
        return;
      }
      if (dir === 'down') {
        setZenFocusSection(s => Math.min(ZEN_SECTIONS - 1, s + 1));
        soundManager.playMove();
        return;
      }

      // Left / Right: change value within current section
      switch (section) {
        case 0: { // Starting Level
          const idx = levelPresets.indexOf(zenLevelRef.current);
          const cur = idx >= 0 ? idx : 0;
          const next = dir === 'left' ? Math.max(0, cur - 1) : Math.min(levelPresets.length - 1, cur + 1);
          if (next !== cur) { setZenLevel(levelPresets[next]); soundManager.playMove(); }
          break;
        }
        case 1: { // Speed Progression: Left=Fixed, Right=Dynamic
          const val = dir === 'left';
          if (zenFixedGravityRef.current !== val) { setZenFixedGravity(val); soundManager.playMove(); }
          break;
        }
        case 2: { // Anti-Game Over: Left=Auto-Recovery, Right=Standard
          const val = dir === 'left';
          if (zenImmortalRef.current !== val) { setZenImmortal(val); soundManager.playMove(); }
          break;
        }
        case 3: { // Downstack Lines
          const idx = garbageOptions.indexOf(zenGarbageLinesRef.current);
          const cur = idx >= 0 ? idx : 0;
          const next = dir === 'left' ? Math.max(0, cur - 1) : Math.min(garbageOptions.length - 1, cur + 1);
          if (next !== cur) { setZenGarbageLines(garbageOptions[next]); soundManager.playMove(); }
          break;
        }
        case 4: { // Lock Delay
          const idx = lockOptions.indexOf(zenLockDelayRef.current);
          const cur = idx >= 0 ? idx : 0;
          const next = dir === 'left' ? Math.max(0, cur - 1) : Math.min(lockOptions.length - 1, cur + 1);
          if (next !== cur) { setZenLockDelay(lockOptions[next]); soundManager.playMove(); }
          break;
        }
        case 5: // Back button row: Right → Start
          if (dir === 'right') { setZenFocusSection(6); soundManager.playMove(); }
          break;
        case 6: // Start button row: Left → Back
          if (dir === 'left') { setZenFocusSection(5); soundManager.playMove(); }
          break;
      }
    };

    const poll = (time: number) => {
      const delta = time - lastTime;
      lastTime = time;

      const gamepads = typeof navigator !== 'undefined' ? navigator.getGamepads?.() : null;
      const gp = gamepads ? Array.from(gamepads).find(g => g && g.connected) : null;

      if (gp) {
        const buttons = gp.buttons.map(b => (typeof b === 'object' ? b.pressed : b === 1.0));
        const axes = gp.axes;
        const justPressed = (i: number) => buttons[i] && !prevButtons[i];

        if (justPressed(0)) handleZenInput('select');
        if (justPressed(1) || justPressed(8)) handleZenInput('back');

        const stickX = axes[0] || 0;
        const stickY = axes[1] || 0;
        const upP    = buttons[12] || stickY < -0.55;
        const downP  = buttons[13] || stickY > 0.55;
        const leftP  = buttons[14] || stickX < -0.55;
        const rightP = buttons[15] || stickX > 0.55;

        let activeDir: 'up' | 'down' | 'left' | 'right' | null = null;
        if (upP)    activeDir = 'up';
        else if (downP)  activeDir = 'down';
        else if (leftP)  activeDir = 'left';
        else if (rightP) activeDir = 'right';

        if (activeDir) {
          if (lastDir !== activeDir) {
            lastDir = activeDir;
            dpadTimer = 0;
            handleZenInput(activeDir);
          } else {
            dpadTimer += delta;
            if (dpadTimer >= DAS) {
              const excess = dpadTimer - DAS;
              if (excess >= ARR) {
                dpadTimer = DAS;
                handleZenInput(activeDir);
              }
            }
          }
        } else {
          lastDir = null;
          dpadTimer = 0;
        }

        prevButtons = buttons;
      }

      animId = requestAnimationFrame(poll);
    };

    animId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(animId);
  }, [isConfiguringZen]); // Only restart when zen config opens/closes

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
      setIsConfiguringMarathon(false);
      onClearInitialMode?.();
    } else if (m === 'marathon') {
      setMode('marathon');
      setIsSelectingMode(false);
      setIsConfiguringZen(false);
      setIsConfiguringMarathon(true);
      onClearInitialMode?.();
    } else if (m === 'sprint' || m === 'ultra') {
      const validMode = m as 'sprint' | 'ultra';
      setMode(validMode);
      setIsSelectingMode(false);
      setIsConfiguringZen(false);
      setIsConfiguringMarathon(false);
      onClearInitialMode?.();
      // Use a microtask to ensure state is set before initGame reads it
      setTimeout(() => {
        initGame(validMode);
      }, 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMode]);

  const launchSelectedMode = (selectedMode: SoloMode) => {
    setMode(selectedMode);
    if (selectedMode === 'zen') {
      setIsSelectingMode(false);
      setIsConfiguringZen(true);
      setIsConfiguringMarathon(false);
    } else if (selectedMode === 'marathon') {
      setIsSelectingMode(false);
      setIsConfiguringZen(false);
      setIsConfiguringMarathon(true);
    } else {
      setIsSelectingMode(false);
      setIsConfiguringZen(false);
      setIsConfiguringMarathon(false);
      initGame(selectedMode);
    }
  };

  const startZenGame = () => {
    setIsConfiguringZen(false);
    initGame('zen');
  };

  const startMarathonGame = () => {
    setIsConfiguringMarathon(false);
    initGame('marathon');
  };

  const initGame = (targetMode?: SoloMode) => {
    soundManager.stopBgm();
    const activeMode = (typeof targetMode === 'string') ? targetMode : mode;
    const isZen = activeMode === 'zen';
    const startingLevel = isZen ? zenLevel : activeMode === 'marathon' ? marathonStartLevel : 1;
    const fixedGravity = isZen ? zenFixedGravity : false;
    const immortal = isZen ? zenImmortal : false;
    const startingGarbageLines = isZen ? zenGarbageLines : 0;
    const lockDelay = isZen ? zenLockDelay : settings.lockDelay;

    const newEngine = new GameEngine({
      das: settings.das,
      arr: settings.arr,
      softDropFactor: settings.softDropFactor,
      lockDelay,
      startingLevel,
      fixedGravity,
      immortal,
      startingGarbageLines
    }, {
      onPieceSpawn: () => {
        setNextQueue([...newEngine.randomizer.peek(6)]);
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
      onGameOver: () => handleGameOver(false, newEngine, activeMode)
    });

    setEngine(newEngine);
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
    setNextQueue([...newEngine.randomizer.peek(6)]);
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
    // A fresh session starts here; previous zen time has already been saved.
    zenTimeRecordedRef.current = 0;
    engine.state = 'playing';
    engine.startTime = Date.now();
    engine.spawnPiece();
    setNextQueue([...engine.randomizer.peek(6)]);
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
            handleGameOver(true, engine, mode);
          }

          // Ultra mode timer expiration
          if (mode === 'ultra' && engine.totalPlayTimeMs >= ultraDuration && engine.clearingRows.length === 0) {
            engine.state = 'completed';
            handleGameOver(true, engine, mode);
          }

          // Marathon standard 150 lines victory
          if (mode === 'marathon' && engine.lines >= 150 && engine.clearingRows.length === 0) {
            engine.state = 'completed';
            handleGameOver(true, engine, mode);
          }
        }
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [engine, mode, sprintGoal, ultraDuration, isSelectingMode, isCountingDown]);

  const handleGameOver = async (victory: boolean, sourceEngine: GameEngine = engine, sourceMode: string = mode) => {
    soundManager.stopBgm();
    setIsVictory(victory);
    setIsGameOverModalOpen(true);
    if (!victory) {
      soundManager.playGameOver();
    } else {
      soundManager.playClear(4);
    }

    const stats = sourceEngine.getStats();

    // Zen Mode: ONLY track playtime, no other statistics or leaderboard submissions
    if (sourceMode === 'zen') {
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
      mode: sourceMode === 'sprint' ? `sprint_${sprintGoal}` : sourceMode === 'ultra' ? 'ultra_3m' : 'marathon_150',
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
      <SoloModeMenu
        onSelectMode={launchSelectedMode}
        onStartCpu={onStartCpu}
      />
    );
  }

  // Marathon pre-game configuration panel
  if (isConfiguringMarathon) {
    return (
      <div style={{ width: '100%', maxWidth: '720px', marginTop: '1rem' }}>
        <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: '50%', background: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent-cyan)', marginBottom: '0.5rem' }}>
            <Flame size={32} />
          </div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.3rem' }}>{t('Marathon')}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {t('Choose your Marathon starting level before the game begins.')}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.3rem' }}>
            {t('🎮 ↑↓ Navigate · ←→ Change value · A Confirm · B Back')}
          </p>
        </div>

        <div className="panel-card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '0.65rem' }}>
              <label htmlFor="marathon-start-level" style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                {t('Marathon Starting Level')}
              </label>
              <span style={{ color: 'var(--accent-cyan)', fontWeight: 800, fontSize: '0.95rem' }}>
                {t('Level {level} ({ms}ms)', { level: marathonStartLevel, ms: GameEngine.defaultGravityCurve(marathonStartLevel) })}
              </span>
            </div>
            <input
              id="marathon-start-level"
              type="range"
              min="1"
              max="15"
              step="1"
              value={marathonStartLevel}
              onChange={(e) => setMarathonStartLevel(parseInt(e.target.value, 10))}
              style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
            />
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              {t('The Marathon starts at the selected speed and scoring level.')}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              onClick={() => {
                setIsConfiguringMarathon(false);
                setIsSelectingMode(true);
              }}
            >
              <ArrowLeft size={16} /> {t('Back')}
            </button>
            <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={startMarathonGame}>
              <Play size={16} /> {t('Start Marathon')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Zen Mode Pre-game Configuration Panel
  if (isConfiguringZen) {
    const zenSec = (n: number): React.CSSProperties => ({
      borderRadius: 'var(--radius-sm)',
      padding: '0.4rem',
      margin: '-0.4rem',
      boxShadow: zenFocusSection === n ? '0 0 0 2px var(--accent-cyan), 0 0 12px rgba(6,182,212,0.3)' : 'none',
      transition: 'box-shadow 0.1s ease',
    });
    const optBtn = (active: boolean, activeColor: string, activeBg: string): React.CSSProperties => ({
      flex: 1,
      padding: '1rem',
      borderRadius: 'var(--radius-sm)',
      border: `2px solid ${active ? activeColor : 'var(--border-color)'}`,
      background: active ? activeBg : 'var(--bg-tertiary)',
      cursor: 'pointer',
      textAlign: 'left' as const,
    });

    return (
      <div style={{ width: '100%', maxWidth: '720px', marginTop: '1rem' }}>
        <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: '50%', background: 'rgba(168, 85, 247, 0.15)', color: 'var(--accent-purple)', marginBottom: '0.5rem' }}>
            <Smile size={32} />
          </div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.3rem' }}>{t('Zen & Practice Settings')}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {t('Configure your custom session parameters before playing.')}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.3rem' }}>
            {t('🎮 ↑↓ Navigate · ←→ Change value · A Confirm · B Back')}
          </p>
        </div>

        <div className="panel-card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Section 0 — Starting Speed / Level */}
          <div data-zen-section="0" style={zenSec(0)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ fontWeight: 700, fontSize: '0.95rem' }}>{t('Starting Speed / Level')}</label>
              <span style={{ color: 'var(--accent-cyan)', fontWeight: 800, fontSize: '0.95rem' }}>
                {t('Level {level} ({ms}ms)', { level: zenLevel, ms: GameEngine.defaultGravityCurve(zenLevel) })}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              {[
                { label: t('Relaxed (Lv 1)'), lvl: 1 },
                { label: t('Chill (Lv 5)'), lvl: 5 },
                { label: t('Brisk (Lv 10)'), lvl: 10 },
                { label: t('Intense (Lv 15)'), lvl: 15 },
                { label: t('20G Instant (Lv 20)'), lvl: 20 }
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
              tabIndex={-1}
              onChange={(e) => setZenLevel(parseInt(e.target.value, 10))}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>

          {/* Section 1 — Speed Progression */}
          <div data-zen-section="1" style={zenSec(1)}>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.5rem' }}>
              {t('Speed Progression')}
            </label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" onClick={() => setZenFixedGravity(true)} style={optBtn(zenFixedGravity, 'var(--accent-purple)', 'rgba(168, 85, 247, 0.1)')}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.2rem', color: zenFixedGravity ? 'var(--accent-purple)' : 'var(--text-primary)' }}>
                  {t('🧘 Fixed Speed (Constant)')}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {t('Gravity never accelerates. Zero pressure endless meditation.')}
                </div>
              </button>
              <button type="button" onClick={() => setZenFixedGravity(false)} style={optBtn(!zenFixedGravity, 'var(--accent-purple)', 'rgba(168, 85, 247, 0.1)')}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.2rem', color: !zenFixedGravity ? 'var(--accent-purple)' : 'var(--text-primary)' }}>
                  {t('⚡ Dynamic (Accelerates)')}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {t('Gravity steadily speeds up every 10 lines as in Marathon.')}
                </div>
              </button>
            </div>
          </div>

          {/* Section 2 — Anti-Game Over */}
          <div data-zen-section="2" style={zenSec(2)}>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.5rem' }}>
              {t('Anti-Game Over (Zen Immortality)')}
            </label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" onClick={() => setZenImmortal(true)} style={optBtn(zenImmortal, 'var(--accent-green)', 'rgba(34, 197, 94, 0.1)')}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.2rem', color: zenImmortal ? 'var(--accent-green)' : 'var(--text-primary)' }}>
                  {t('🛡️ Auto-Recovery (No Game Over)')}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {t('Touching the ceiling clears the board and continues smoothly without ending the game.')}
                </div>
              </button>
              <button type="button" onClick={() => setZenImmortal(false)} style={optBtn(!zenImmortal, 'var(--accent-red)', 'rgba(239, 68, 68, 0.1)')}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.2rem', color: !zenImmortal ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                  {t('🛑 Standard Game Over')}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {t('Overfilling the board results in a normal game over screen.')}
                </div>
              </button>
            </div>
          </div>

          {/* Section 3 — Downstack Practice */}
          <div data-zen-section="3" style={zenSec(3)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label style={{ fontWeight: 700, fontSize: '0.95rem' }}>{t('Downstack Practice (Starting Lines)')}</label>
              <span style={{ color: 'var(--accent-yellow)', fontWeight: 800, fontSize: '0.9rem' }}>
                {zenGarbageLines === 0 ? t('Clean Board') : t('{count} Lines', { count: zenGarbageLines })}
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>
              {t('Pre-fill the board with garbage rows with single holes to practice digging and downstacking.')}
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
                  {count === 0 ? t('Empty (0)') : t('{count} Lines', { count })}
                </button>
              ))}
            </div>
          </div>

          {/* Section 4 — Lock Delay */}
          <div data-zen-section="4" style={zenSec(4)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label style={{ fontWeight: 700, fontSize: '0.95rem' }}>{t('Lock Delay')}</label>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{zenLockDelay}ms</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[
                { label: t('Standard (500ms)'), ms: 500 },
                { label: t('Relaxed (1000ms)'), ms: 1000 },
                { label: t('Uncapped (2000ms)'), ms: 2000 }
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

          {/* Sections 5 & 6 — Action Buttons */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <button
              data-zen-section="5"
              className="btn-secondary"
              onClick={() => { setIsConfiguringZen(false); setIsSelectingMode(true); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '0.5rem', padding: '0.75rem 1.25rem',
                boxShadow: zenFocusSection === 5 ? '0 0 0 2px var(--accent-cyan), 0 0 12px rgba(6,182,212,0.3)' : 'none',
                transition: 'box-shadow 0.1s ease',
              }}
            >
              <ArrowLeft size={18} />
              <span>{t('Back to Modes')}</span>
            </button>
            <button
              data-zen-section="6"
              className="btn-primary"
              onClick={startZenGame}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '0.5rem', padding: '0.75rem', fontSize: '1.05rem',
                background: 'linear-gradient(135deg, #a855f7, #06b6d4)',
                boxShadow: zenFocusSection === 6 ? '0 0 0 2px var(--accent-cyan), 0 0 12px rgba(6,182,212,0.3)' : 'none',
                transition: 'box-shadow 0.1s ease',
              }}
            >
              <Play size={20} />
              <span>{t('Start Zen Session')}</span>
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
          <ArrowLeft size={16} /> {t('Mode Menu')}
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
            <Sliders size={16} color="var(--accent-purple)" /> {t('Zen Settings')}
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
          {t('Mode: {mode}', { mode: t(mode === 'marathon' ? 'Marathon' : mode === 'sprint' ? 'Sprint (40 Lines)' : mode === 'ultra' ? 'Ultra' : 'Practice') })}{mode === 'sprint' ? ` (${sprintGoal}L)` : mode === 'ultra' ? ' (3m)' : mode === 'zen' ? ` (${t('Level')} ${zenLevel}${zenFixedGravity ? ` • ${t('Fixed')}` : ''}${zenImmortal ? ` • ${t('Immortal')}` : ''})` : ''}
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
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '1rem' }}>{t('PAUSED')}</h2>
                <button className="btn-primary" onClick={() => engine.resume()}>
                  <Play size={18} /> {t('Resume')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Next Queue & Actions */}
        <div className="side-panel">
          <QueueDisplay queue={nextQueue} count={6} />
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
              <span>{gameState === 'paused' ? t('Resume') : t('Pause')}</span>
            </button>
            <button
              className="btn-secondary"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.5rem' }}
              onClick={() => initGame()}
            >
              <RotateCcw size={16} />
              <span>{t('Restart')}</span>
            </button>
          </div>
        </div>
      </div>

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
