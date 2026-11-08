import React, { useEffect, useRef, useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useGamepadActive } from '../context/GamepadNavContext';
import { DEFAULT_GAMEPAD_BINDINGS, GAMEPAD_BUTTON_NAMES } from '../game/input/gamepadManager';
import { Volume2, Keyboard, Eye, RotateCcw, Gamepad2, Check } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings, resetDefaults } = useSettings();
  const [rebindingKeyAction, setRebindingKeyAction] = useState<string | null>(null);
  const [rebindingGamepadAction, setRebindingGamepadAction] = useState<string | null>(null);
  const [connectedGamepadName, setConnectedGamepadName] = useState<string | null>(null);

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap' }}>UI Theme</label>
            <select
              value={settings.theme}
              onChange={e => updateSettings({ theme: e.target.value })}
              style={{
                padding: '0.4rem 0.6rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              <optgroup label="Dark Themes">
                <option value="dark-01">Dark — Midnight</option>
                <option value="dark-02">Dark — Ocean</option>
                <option value="dark-03">Dark — Forest</option>
                <option value="dark-04">Dark — Ember</option>
                <option value="dark-05">Dark — Amethyst</option>
              </optgroup>
              <optgroup label="Light Themes">
                <option value="light-01">Light — Clean</option>
                <option value="light-02">Light — Sky</option>
                <option value="light-03">Light — Mint</option>
                <option value="light-04">Light — Peach</option>
                <option value="light-05">Light — Lavender</option>
              </optgroup>
            </select>
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
