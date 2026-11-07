import React, { useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { Settings, Sliders, Volume2, Keyboard, Eye, RotateCcw } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings, resetDefaults } = useSettings();
  const [rebindingAction, setRebindingAction] = useState<string | null>(null);

  const handleKeyCapture = (action: string) => {
    setRebindingAction(action);
    const listener = (e: KeyboardEvent) => {
      e.preventDefault();
      const newKey = e.key;
      updateSettings({
        keybindings: {
          ...settings.keybindings,
          [action]: [newKey]
        }
      });
      setRebindingAction(null);
      window.removeEventListener('keydown', listener);
    };
    window.addEventListener('keydown', listener, { once: true });
  };

  return (
    <div style={{ width: '100%', maxWidth: '780px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.4rem' }}>Settings</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Tune your competitive handling, keybinds, audio, and accessibility.
          </p>
        </div>

        <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={resetDefaults}>
          <RotateCcw size={16} /> Reset Defaults
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Handling & Timings */}
        <div className="panel-card" style={{ alignItems: 'stretch', gap: '1.25rem', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.1rem' }}>
            <Sliders size={20} color="var(--accent-cyan)" />
            <span>Handling & Timings</span>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>DAS (Delayed Auto Shift)</span>
              <span style={{ fontSize: '0.85rem', fontFamily: 'monospace', color: 'var(--accent-cyan)' }}>{settings.das} ms</span>
            </div>
            <input
              type="range"
              min="50"
              max="250"
              step="5"
              value={settings.das}
              onChange={(e) => updateSettings({ das: parseInt(e.target.value, 10) })}
              style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Delay before a held left/right key starts repeating.
            </p>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>ARR (Auto Repeat Rate)</span>
              <span style={{ fontSize: '0.85rem', fontFamily: 'monospace', color: 'var(--accent-cyan)' }}>{settings.arr} ms</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              step="2"
              value={settings.arr}
              onChange={(e) => updateSettings({ arr: parseInt(e.target.value, 10) })}
              style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Speed of continuous piece movement when DAS is active. 0 is instantaneous.
            </p>
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

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Mobile Touch Controls</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Displays on-screen D-pad and action buttons.</div>
            </div>
            <input
              type="checkbox"
              checked={settings.touchControlsEnabled}
              onChange={(e) => updateSettings({ touchControlsEnabled: e.target.checked })}
              style={{ width: '18px', height: '18px', accentColor: 'var(--accent-purple)' }}
            />
          </div>
        </div>

        {/* Keybindings Table */}
        <div className="panel-card" style={{ alignItems: 'stretch', gap: '1rem', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.1rem' }}>
            <Keyboard size={20} color="var(--accent-pink)" />
            <span>Keybindings</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Click on any action button below to rebind it to a new key.
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
                    background: rebindingAction === action ? 'var(--accent-pink)' : undefined,
                    color: rebindingAction === action ? '#fff' : undefined
                  }}
                  onClick={() => handleKeyCapture(action)}
                >
                  {rebindingAction === action ? 'Press key...' : keys.join(', ')}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
