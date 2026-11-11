import React, { createContext, useContext, useEffect, useState } from 'react';
import { DEFAULT_KEYBINDINGS, KeyBindings } from '../game/input/keyboardManager';
import { DEFAULT_GAMEPAD_BINDINGS, GamepadBindings } from '../game/input/gamepadManager';
import { soundManager } from '../game/audio/soundManager';
import { ApiClient } from '../services/api';
import { LocalStorageManager } from '../services/storage';
import { useAuth } from './AuthContext';
import { Language, isLanguage } from '../i18n/translations';

export interface SettingsState {
  language: Language;
  theme: string; // e.g., 'dark-01', 'light-03', etc.
  das: number;
  arr: number;
  softDropFactor: number;
  lockDelay: number;
  soundVolume: number;
  musicVolume: number;
  isMuted: boolean;
  ghostPiece: boolean;
  colorblindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  reducedMotion: boolean;
  keybindings: KeyBindings;
  gamepadBindings: GamepadBindings;
}

const DEV_SOUND_DEFAULT_KEY = 'dev_sound_default_muted';

const DEFAULT_SETTINGS: SettingsState = {
  language: 'en',
  theme: 'dark-01',
  das: 167,
  arr: 33,
  softDropFactor: 20,
  lockDelay: 500,
  soundVolume: 0.7,
  musicVolume: 0.5,
  isMuted: import.meta.env.DEV,
  ghostPiece: true,
  colorblindMode: 'none',
  reducedMotion: false,
  keybindings: DEFAULT_KEYBINDINGS,
  gamepadBindings: DEFAULT_GAMEPAD_BINDINGS
};

interface SettingsContextType {
  settings: SettingsState;
  updateSettings: (newSettings: Partial<SettingsState>) => void;
  toggleTheme: () => void;
  toggleMute: () => void;
  resetDefaults: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

function toRemoteSettings(settings: SettingsState) {
  return {
    language: settings.language,
    theme: settings.theme,
    das: settings.das,
    arr: settings.arr,
    soft_drop_factor: settings.softDropFactor,
    lock_delay: settings.lockDelay,
    sound_volume: settings.soundVolume,
    music_volume: settings.musicVolume,
    keybindings: settings.keybindings,
    gamepad_bindings: settings.gamepadBindings,
    ghost_piece: settings.ghostPiece ? 1 : 0,
    colorblind_mode: settings.colorblindMode,
    reduced_motion: settings.reducedMotion ? 1 : 0
  };
}

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [settings, setSettings] = useState<SettingsState>(() => {
    const stored = LocalStorageManager.getItem<Partial<SettingsState>>('settings', {});
    const initial: SettingsState = {
      ...DEFAULT_SETTINGS,
      ...stored,
      // Older saved settings may miss fields added later; merge defaults instead of
      // letting undefined values reach the engine or the API.
      language: isLanguage(stored.language) ? stored.language : DEFAULT_SETTINGS.language,
      theme: /^(dark|light)-0[1-5]$/.test(stored.theme || '')
        ? (stored.theme as string)
        : DEFAULT_SETTINGS.theme,
      keybindings: { ...DEFAULT_KEYBINDINGS, ...(stored.keybindings || {}) },
      gamepadBindings: { ...DEFAULT_GAMEPAD_BINDINGS, ...(stored.gamepadBindings || {}) }
    };

    // Dev builds start muted once, even for an existing local profile. After
    // that one-time migration the player's explicit mute choice is preserved.
    if (import.meta.env.DEV && !LocalStorageManager.getItem<boolean>(DEV_SOUND_DEFAULT_KEY, false)) {
      initial.isMuted = true;
      LocalStorageManager.setItem('settings', initial);
      LocalStorageManager.setItem(DEV_SOUND_DEFAULT_KEY, true);
    }

    return initial;
  });

  // Apply theme and language to document attributes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    document.documentElement.setAttribute('lang', settings.language);
  }, [settings.language]);

  // Apply sound and music volume
  useEffect(() => {
    soundManager.setVolume(settings.soundVolume);
    soundManager.setMusicVolume(settings.musicVolume);
    soundManager.setMuted(settings.isMuted);
  }, [settings.soundVolume, settings.musicVolume, settings.isMuted]);

  // Sync the full settings set from the backend when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    ApiClient.getSettings()
      .then((remote) => {
        if (!remote) return;
        setSettings((prev) => {
          const merged: SettingsState = {
            ...prev,
            language: isLanguage(remote.language) ? remote.language : prev.language,
            theme: typeof remote.theme === 'string' ? remote.theme : prev.theme,
            das: typeof remote.das === 'number' ? remote.das : prev.das,
            arr: typeof remote.arr === 'number' ? remote.arr : prev.arr,
            softDropFactor: typeof remote.soft_drop_factor === 'number' ? remote.soft_drop_factor : prev.softDropFactor,
            lockDelay: typeof remote.lock_delay === 'number' ? remote.lock_delay : prev.lockDelay,
            soundVolume: typeof remote.sound_volume === 'number' ? remote.sound_volume : prev.soundVolume,
            musicVolume: typeof remote.music_volume === 'number' ? remote.music_volume : prev.musicVolume,
            ghostPiece: remote.ghost_piece !== undefined ? Boolean(remote.ghost_piece) : prev.ghostPiece,
            keybindings: remote.keybindings || prev.keybindings,
            gamepadBindings: remote.gamepad_bindings || prev.gamepadBindings,
            colorblindMode: remote.colorblind_mode || prev.colorblindMode,
            reducedMotion: remote.reduced_motion !== undefined ? Boolean(remote.reduced_motion) : prev.reducedMotion
          };
          LocalStorageManager.setItem('settings', merged);
          return merged;
        });
      })
      .catch(console.warn);
  }, [isAuthenticated]);

  const updateSettings = (newSettings: Partial<SettingsState>) => {
    setSettings((prev) => {
      const merged = { ...prev, ...newSettings };
      LocalStorageManager.setItem('settings', merged);

      if (isAuthenticated) {
        ApiClient.updateSettings(toRemoteSettings(merged)).catch(console.warn);
      }

      return merged;
    });
  };

  const toggleTheme = () => {
    const match = /^(dark|light)-0([1-5])$/.exec(settings.theme);
    const nextTheme = match
      ? `${match[1] === 'dark' ? 'light' : 'dark'}-0${match[2]}`
      : 'dark-01';
    updateSettings({ theme: nextTheme });
  };

  const toggleMute = () => {
    updateSettings({ isMuted: !settings.isMuted });
  };

  const resetDefaults = () => {
    setSettings(DEFAULT_SETTINGS);
    LocalStorageManager.setItem('settings', DEFAULT_SETTINGS);
    if (isAuthenticated) {
      ApiClient.updateSettings(toRemoteSettings(DEFAULT_SETTINGS)).catch(console.warn);
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, toggleTheme, toggleMute, resetDefaults }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
};
