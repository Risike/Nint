import React, { useEffect, useRef, useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useGamepadActive, useGamepadBack, useGamepadNav } from '../context/GamepadNavContext';
import { DEFAULT_GAMEPAD_BINDINGS, GAMEPAD_BUTTON_NAMES } from '../game/input/gamepadManager';
import { Volume2, Keyboard, Eye, RotateCcw, Gamepad2, Check, ChevronDown } from 'lucide-react';

const THEME_OPTIONS: { value: string; label: string; group: 'Dark Themes' | 'Light Themes' }[] = [
  { value: 'dark-01', label: 'Dark — Midnight', group: 'Dark Themes' },
  { value: 'dark-02', label: 'Dark — Ocean', group: 'Dark Themes' },
  { value: 'dark-03', label: 'Dark — Forest', group: 'Dark Themes' },
  { value: 'dark-04', label: 'Dark — Ember', group: 'Dark Themes' },
  { value: 'dark-05', label: 'Dark — Amethyst', group: 'Dark Themes' },
  { value: 'light-01', label: 'Light — Clean', group: 'Light Themes' },
  { value: 'light-02', label: 'Light — Sky', group: 'Light Themes' },
  { value: 'light-03', label: 'Light — Mint', group: 'Light Themes' },
  { value: 'light-04', label: 'Light — Peach', group: 'Light Themes' },
  { value: 'light-05', label: 'Light — Lavender', group: 'Light Themes' }
];

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings, resetDefaults } = useSettings();
  const [rebindingKeyAction, setRebindingKeyAction] = useState<string | null>(null);
  const [rebindingGamepadAction, setRebindingGamepadAction] = useState<string | null>(null);
  const [connectedGamepadName, setConnectedGamepadName] = useState<string | null>(null);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement | null>(null);
  const themeButtonRef = useRef<HTMLButtonElement | null>(null);
  const themeOptionRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const { setFocusedElement } = useGamepadNav();

  useGamepadActive(rebindingGamepadAction !== null);

  // Monitor gamepad connection
  useEffect(() => {
    const checkGamepad = () => {
      if (typeof navigator !== 'undefined' && navigator.getGamepads) {
        const gamepads = navigator.getGamepads();
        const gp = Array.from(gamepads).find(g => g && g.connected);
        if (gp) {
          setConnectedGamepadName(gp.id);
        } else {
          setConnectedGamepadName(null);
        }
      }
    };

    checkGamepad();
    const interval = setInterval(checkGamepad, 1000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard rebind handler
  const handleKeyCapture = (action: string) => {
    setRebindingKeyAction(action);
    const listener = (e: KeyboardEvent) => {
      e.preventDefault();
      const newKey = e.key;
      updateSettings({
        keybindings: {
          ...settings.keybindings,
          [action]: [newKey]
        }
      });
      setRebindingKeyAction(null);
      window.removeEventListener('keydown', listener);
    };
    window.addEventListener('keydown', listener, { once: true });
  };

  // Gamepad rebind listener loop
  useEffect(() => {
    if (!rebindingGamepadAction) return;

    let animId: number;
    let initialPressed = new Set<number>();

    // Detect currently held buttons so they aren't immediately registered
    const pollInitial = () => {
      const gps = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = Array.from(gps).find(g => g && g.connected);
      if (gp) {
        gp.buttons.forEach((b, idx) => {
          if (b.pressed) initialPressed.add(idx);
        });
      }
    };
    pollInitial();

    const pollGamepad = () => {
      const gps = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = Array.from(gps).find(g => g && g.connected);
      if (gp) {
        for (let i = 0; i < gp.buttons.length; i++) {
          const btn = gp.buttons[i];
          if (btn.pressed && !initialPressed.has(i)) {
            // Found pressed button!
            updateSettings({
              gamepadBindings: {
                ...(settings.gamepadBindings || DEFAULT_GAMEPAD_BINDINGS),
                [rebindingGamepadAction]: [i]
              }
            });
            setRebindingGamepadAction(null);
            return;
          }
        }
      }
      animId = requestAnimationFrame(pollGamepad);
    };

    animId = requestAnimationFrame(pollGamepad);
    return () => cancelAnimationFrame(animId);
  }, [rebindingGamepadAction, settings.gamepadBindings]);

  const formatGamepadButtons = (buttonIndices: number[] = []) => {
    if (!buttonIndices || buttonIndices.length === 0) return 'None';
    return buttonIndices.map(idx => GAMEPAD_BUTTON_NAMES[idx] || `Button ${idx}`).join(', ');
  };

  const currentGamepadBindings = settings.gamepadBindings || DEFAULT_GAMEPAD_BINDINGS;
  const selectedTheme = THEME_OPTIONS.find((option) => option.value === settings.theme) || THEME_OPTIONS[0];

  const closeThemeMenu = () => {
    setThemeMenuOpen(false);
    requestAnimationFrame(() => setFocusedElement(themeButtonRef.current));
  };

  useGamepadBack(() => {
    if (!themeMenuOpen) return false;
    closeThemeMenu();
    return true;
  }, [themeMenuOpen]);

  useEffect(() => {
    if (!themeMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        closeThemeMenu();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeThemeMenu();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    const focusFrame = requestAnimationFrame(() => {
      setFocusedElement(themeOptionRefs.current[settings.theme] || null);
    });

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      cancelAnimationFrame(focusFrame);
    };
  }, [themeMenuOpen, settings.theme, setFocusedElement]);

  const handleThemeSelect = (theme: string) => {
    updateSettings({ theme });
    closeThemeMenu();
  };

  return (
    <div style={{ width: '100%', maxWidth: '780px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.4rem' }}>Settings</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Customize your audio, keyboard keybinds, gamepad controller buttons, and accessibility.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {/* Theme selector */}
          <div ref={themeMenuRef} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }}>
            <label style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap' }}>UI Theme</label>
            <button
              ref={themeButtonRef}
              type="button"
              className="btn-secondary"
              aria-label="UI Theme"
              aria-haspopup="listbox"
              aria-expanded={themeMenuOpen}
              onClick={() => {
                if (themeMenuOpen) {
                  closeThemeMenu();
                } else {
                  setThemeMenuOpen(true);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.6rem',
                minWidth: '185px',
                padding: '0.4rem 0.6rem',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              <span>{selectedTheme.label}</span>
              <ChevronDown size={16} />
            </button>

            {themeMenuOpen && (
              <div
                role="listbox"
                aria-label="UI Theme"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 0.35rem)',
                  right: 0,
                  zIndex: 80,
                  width: '240px',
                  maxHeight: '330px',
                  overflowY: 'auto',
                  padding: '0.35rem',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 14px 34px rgba(0, 0, 0, 0.4)'
                }}
              >
                {(['Dark Themes', 'Light Themes'] as const).map((group) => (
                  <div key={group}>
                    <div style={{
                      padding: '0.35rem 0.5rem 0.2rem',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)'
                    }}>
                      {group}
                    </div>
                    {THEME_OPTIONS.filter((option) => option.group === group).map((option) => {
                      const isSelected = option.value === settings.theme;
                      return (
                        <button
                          key={option.value}
                          ref={(element) => { themeOptionRefs.current[option.value] = element; }}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => handleThemeSelect(option.value)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                            padding: '0.45rem 0.5rem',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            background: isSelected ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                            color: 'var(--text-primary)',
                            fontSize: '0.82rem',
                            textAlign: 'left',
                            cursor: 'pointer'
                          }}
                        >
                          <span>{option.label}</span>
                          {isSelected && <Check size={14} color="var(--accent-cyan)" />}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={resetDefaults}>
            <RotateCcw size={16} /> Reset Defaults
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Gamepad Configuration */}
        <div className="panel-card" style={{ alignItems: 'stretch', gap: '1rem', padding: '1.5rem', borderColor: 'rgba(56, 189, 248, 0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.1rem', color: 'var(--accent-cyan)' }}>
              <Gamepad2 size={22} />
              <span>Gamepad Controller Buttons / Manette</span>
            </div>

            <div style={{
              fontSize: '0.8rem',
              padding: '0.2rem 0.6rem',
              borderRadius: '999px',
              background: connectedGamepadName ? 'rgba(34, 197, 94, 0.2)' : 'var(--bg-tertiary)',
              color: connectedGamepadName ? 'var(--accent-green)' : 'var(--text-muted)',
              fontWeight: 600
            }}>
              {connectedGamepadName ? `Connected: ${connectedGamepadName.slice(0, 24)}...` : 'No controller detected (Press any button)'}
            </div>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Click on any action button below to rebind it by pressing a button on your gamepad. Left analog stick is also active for navigation.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
            {Object.entries(currentGamepadBindings).map(([action, btnIndices]) => (
              <div
                key={action}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--bg-tertiary)',
                  padding: '0.6rem 0.8rem',
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                <span style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'capitalize' }}>
                  {action.replace(/([A-Z])/g, ' $1')}
                </span>
                <button
                  className="btn-secondary"
                  style={{
                    padding: '0.25rem 0.6rem',
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    background: rebindingGamepadAction === action ? 'var(--accent-cyan)' : undefined,
                    color: rebindingGamepadAction === action ? '#000' : undefined
                  }}
                  onClick={() => setRebindingGamepadAction(rebindingGamepadAction === action ? null : action)}
                >
                  {rebindingGamepadAction === action ? 'Press button...' : formatGamepadButtons(btnIndices)}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Keyboard Keybindings Table */}
        <div className="panel-card" style={{ alignItems: 'stretch', gap: '1rem', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.1rem' }}>
            <Keyboard size={20} color="var(--accent-pink)" />
            <span>Keyboard Keybindings</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Click on any action button below to rebind it to a new keyboard key.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
            {Object.entries(settings.keybindings).map(([action, keys]) => (
              <div
                key={action}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--bg-tertiary)',
                  padding: '0.6rem 0.8rem',
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                <span style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'capitalize' }}>
                  {action.replace(/([A-Z])/g, ' $1')}
                </span>
                <button
                  className="btn-secondary"
                  style={{
                    padding: '0.25rem 0.6rem',
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    background: rebindingKeyAction === action ? 'var(--accent-pink)' : undefined,
                    color: rebindingKeyAction === action ? '#fff' : undefined
                  }}
                  onClick={() => handleKeyCapture(action)}
                >
                  {rebindingKeyAction === action ? 'Press key...' : keys.join(', ')}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Audio Settings */}
        <div className="panel-card" style={{ alignItems: 'stretch', gap: '1.25rem', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.1rem' }}>
            <Volume2 size={20} color="var(--accent-blue)" />
            <span>Sound & Volume</span>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Music Volume</span>
              <span style={{ fontSize: '0.85rem', fontFamily: 'monospace' }}>{Math.round(settings.musicVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.musicVolume}
              onChange={(e) => updateSettings({ musicVolume: parseFloat(e.target.value) })}
              style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Sound Effects Volume</span>
              <span style={{ fontSize: '0.85rem', fontFamily: 'monospace' }}>{Math.round(settings.soundVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.soundVolume}
              onChange={(e) => updateSettings({ soundVolume: parseFloat(e.target.value) })}
              style={{ width: '100%', accentColor: 'var(--accent-blue)' }}
            />
          </div>
        </div>

        {/* Display & Gameplay Toggles */}
        <div className="panel-card" style={{ alignItems: 'stretch', gap: '1.25rem', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.1rem' }}>
            <Eye size={20} color="var(--accent-purple)" />
            <span>Display & Accessibility</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Ghost Piece</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Shows translucent outline of piece landing location.</div>
            </div>
            <input
              type="checkbox"
              checked={settings.ghostPiece}
              onChange={(e) => updateSettings({ ghostPiece: e.target.checked })}
              style={{ width: '18px', height: '18px', accentColor: 'var(--accent-purple)' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
