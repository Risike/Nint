import React, { createContext, useContext, useEffect, useState } from 'react';
import { DEFAULT_KEYBINDINGS, KeyBindings } from '../game/input/keyboardManager';
import { soundManager } from '../game/audio/soundManager';
import { ApiClient } from '../services/api';
import { LocalStorageManager } from '../services/storage';
import { useAuth } from './AuthContext';

export interface SettingsState {
  theme: 'dark' | 'light';
  das: number;
  arr: number;
  softDropFactor: number;
  lockDelay: number;
  soundVolume: number;
  musicVolume: number;
  isMuted: boolean;
  ghostPiece: boolean;
  touchControlsEnabled: boolean;
  colorblindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  reducedMotion: boolean;
  keybindings: KeyBindings;
}

const DEFAULT_SETTINGS: SettingsState = {
  theme: 'dark',
  das: 167, // Official Guideline standard
  arr: 33,  // Official Guideline standard
  softDropFactor: 20,
  lockDelay: 500,
  soundVolume: 0.7,
  musicVolume: 0.5,
  isMuted: false,
  ghostPiece: true,
  touchControlsEnabled: true,
  colorblindMode: 'none',
  reducedMotion: false,
  keybindings: DEFAULT_KEYBINDINGS
};

interface SettingsContextType {
  settings: SettingsState;
  updateSettings: (newSettings: Partial<SettingsState>) => void;
  toggleTheme: () => void;
  resetDefaults: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [settings, setSettings] = useState<SettingsState>(() => {
    return LocalStorageManager.getItem<SettingsState>('settings', DEFAULT_SETTINGS);
  });

  // Apply theme to document attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  // Apply sound volume
  useEffect(() => {
    soundManager.setVolume(settings.soundVolume);
    soundManager.setMuted(settings.isMuted);
  }, [settings.soundVolume, settings.isMuted]);

  // Sync settings from backend when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      ApiClient.getSettings()
        .then((remote) => {
          if (remote) {
            setSettings((prev) => ({
              ...prev,
              theme: remote.theme || prev.theme,
              das: remote.das ?? prev.das,
              arr: remote.arr ?? prev.arr,
              soundVolume: remote.sound_volume ?? prev.soundVolume,
              keybindings: remote.keybindings || prev.keybindings,
              ghostPiece: remote.ghost_piece !== undefined ? Boolean(remote.ghost_piece) : prev.ghostPiece,
              touchControlsEnabled: remote.touch_controls_enabled !== undefined ? Boolean(remote.touch_controls_enabled) : prev.touchControlsEnabled
            }));
          }
        })
        .catch(console.warn);
    }
  }, [isAuthenticated]);

  const updateSettings = (newSettings: Partial<SettingsState>) => {
    setSettings((prev) => {
      const merged = { ...prev, ...newSettings };
      LocalStorageManager.setItem('settings', merged);

      if (isAuthenticated) {
        ApiClient.updateSettings({
          theme: merged.theme,
          das: merged.das,
          arr: merged.arr,
          sound_volume: merged.soundVolume,
          keybindings: merged.keybindings,
          ghost_piece: merged.ghostPiece ? 1 : 0,
          touch_controls_enabled: merged.touchControlsEnabled ? 1 : 0
        }).catch(console.warn);
      }

      return merged;
    });
  };

  const toggleTheme = () => {
    updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' });
  };

  const resetDefaults = () => {
    setSettings(DEFAULT_SETTINGS);
    LocalStorageManager.setItem('settings', DEFAULT_SETTINGS);
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, toggleTheme, resetDefaults }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
};
