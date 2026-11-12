import React, { useEffect, useRef, useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useGamepadActive, useGamepadBack, useGamepadNav } from '../context/GamepadNavContext';
import { DEFAULT_GAMEPAD_BINDINGS, GAMEPAD_BUTTON_NAMES } from '../game/input/gamepadManager';
import { Volume2, Keyboard, RotateCcw, Gamepad2, Check, ChevronDown, Languages } from 'lucide-react';
import { useI18n } from '../i18n/useI18n';
import { LANGUAGES, Language } from '../i18n/translations';

const ACTION_LABELS: Record<string, string> = {
  moveLeft: 'Move Left',
  moveRight: 'Move Right',
  softDrop: 'Soft Drop',
  hardDrop: 'Hard Drop',
  rotateCW: 'Rotate Cw',
  rotateCCW: 'Rotate Ccw',
  hold: 'Hold',
  pause: 'Pause',
  restart: 'Restart'
};

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings, resetDefaults } = useSettings();
  const { t } = useI18n();
  const [rebindingKeyAction, setRebindingKeyAction] = useState<string | null>(null);
  const [rebindingGamepadAction, setRebindingGamepadAction] = useState<string | null>(null);
  const [connectedGamepadName, setConnectedGamepadName] = useState<string | null>(null);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);
  const languageButtonRef = useRef<HTMLButtonElement | null>(null);
  const languageOptionRefs = useRef<Record<string, HTMLButtonElement | null>>({});
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
    if (!buttonIndices || buttonIndices.length === 0) return t('None');
    return buttonIndices.map(idx => t(GAMEPAD_BUTTON_NAMES[idx] || 'Button {index}', { index: idx })).join(', ');
  };

  const formatActionName = (action: string) => t(ACTION_LABELS[action] || action);

  const currentGamepadBindings = settings.gamepadBindings || DEFAULT_GAMEPAD_BINDINGS;
  const selectedLanguage = LANGUAGES.find((option) => option.code === settings.language) || LANGUAGES[0];

  const closeLanguageMenu = () => {
    setLanguageMenuOpen(false);
    requestAnimationFrame(() => setFocusedElement(languageButtonRef.current));
  };

  useGamepadBack(() => {
    if (!languageMenuOpen) return false;
    closeLanguageMenu();
    return true;
  }, [languageMenuOpen]);

  useEffect(() => {
    if (!languageMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (languageMenuRef.current && !languageMenuRef.current.contains(event.target as Node)) {
        closeLanguageMenu();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeLanguageMenu();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    const focusFrame = requestAnimationFrame(() => {
      setFocusedElement(languageOptionRefs.current[settings.language] || null);
    });

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      cancelAnimationFrame(focusFrame);
    };
  }, [languageMenuOpen, settings.language, setFocusedElement]);

  const handleLanguageSelect = (language: Language) => {
    updateSettings({ language });
    closeLanguageMenu();
  };

  return (
    <div style={{ width: '100%', maxWidth: '780px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.4rem' }}>{t('Settings')}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {t('Customize your audio, keyboard keybinds, and gamepad controller buttons.')}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {/* Language selector — a custom listbox for gamepad navigation */}
          <div ref={languageMenuRef} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }}>
            <label style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
              {t('Language')}
            </label>
            <button
              ref={languageButtonRef}
              type="button"
              className="btn-secondary"
              aria-label={t('Interface Language')}
              aria-haspopup="listbox"
              aria-expanded={languageMenuOpen}
              aria-controls="language-menu"
              title={t('Choose the language used across the game.')}
              onClick={() => {
                if (languageMenuOpen) {
                  closeLanguageMenu();
                } else {
                  setLanguageMenuOpen(true);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
                minWidth: '150px',
                padding: '0.4rem 0.6rem',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              <Languages size={16} color="var(--accent-cyan)" />
              <span>{selectedLanguage.label}</span>
              <ChevronDown size={16} />
            </button>

            {languageMenuOpen && (
              <div
                id="language-menu"
                role="listbox"
                aria-label={t('Interface Language')}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 0.35rem)',
                  right: 0,
                  zIndex: 80,
                  width: '180px',
                  padding: '0.35rem',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 14px 34px rgba(0, 0, 0, 0.4)'
                }}
              >
                {LANGUAGES.map((item) => {
                  const isSelected = item.code === settings.language;
                  return (
                    <button
                      key={item.code}
                      ref={(element) => { languageOptionRefs.current[item.code] = element; }}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleLanguageSelect(item.code)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        padding: '0.5rem 0.55rem',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        background: isSelected ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        textAlign: 'left',
                        cursor: 'pointer'
                      }}
                    >
                      <span>{item.label}</span>
                      {isSelected && <Check size={14} color="var(--accent-cyan)" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={resetDefaults}>
            <RotateCcw size={16} /> {t('Reset Defaults')}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Gamepad Configuration */}
        <div className="panel-card" style={{ alignItems: 'stretch', gap: '1rem', padding: '1.5rem', borderColor: 'rgba(56, 189, 248, 0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.1rem', color: 'var(--accent-cyan)' }}>
              <Gamepad2 size={22} />
              <span>{t('Gamepad Controller Buttons')}</span>
            </div>

            <div style={{
              fontSize: '0.8rem',
              padding: '0.2rem 0.6rem',
              borderRadius: '999px',
              background: connectedGamepadName ? 'rgba(34, 197, 94, 0.2)' : 'var(--bg-tertiary)',
              color: connectedGamepadName ? 'var(--accent-green)' : 'var(--text-muted)',
              fontWeight: 600
            }}>
              {connectedGamepadName ? t('Connected: {name}...', { name: connectedGamepadName.slice(0, 24) }) : t('No controller detected (Press any button)')}
            </div>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {t('Click on any action button below to rebind it by pressing a button on your gamepad. Left analog stick is also active for navigation.')}
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
                  {formatActionName(action)}
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
                  {rebindingGamepadAction === action ? t('Press button...') : formatGamepadButtons(btnIndices)}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Keyboard Keybindings Table */}
        <div className="panel-card" style={{ alignItems: 'stretch', gap: '1rem', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.1rem' }}>
            <Keyboard size={20} color="var(--accent-pink)" />                <span>{t('Keyboard Keybindings')}</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {t('Click on any action button below to rebind it to a new keyboard key.')}
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
                  {formatActionName(action)}
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
                  {rebindingKeyAction === action ? t('Press key...') : keys.join(', ')}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Audio Settings */}
        <div className="panel-card" style={{ alignItems: 'stretch', gap: '1.25rem', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.1rem' }}>
            <Volume2 size={20} color="var(--accent-blue)" />
            <span>{t('Sound & Volume')}</span>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{t('Music Volume')}</span>
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
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{t('Sound Effects Volume')}</span>
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

      </div>
    </div>
  );
};
